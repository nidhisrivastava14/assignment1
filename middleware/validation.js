import { db } from '../db/db.js';

// Custom validation pipeline middleware
export async function validatePayload(req, res, next) {
  const { resource } = req.params;

  try {
    // 1. Fetch schema config from database
    const schemaResult = await db.query(
      'SELECT * FROM schemas WHERE name = $1',
      [resource]
    );

    if (schemaResult.rows.length === 0) {
      return res.status(404).json({
        error: `Schema not found for resource: ${resource}`,
        code: "SCHEMA_NOT_FOUND"
      });
    }

    const schema = schemaResult.rows[0];
    const config = schema.config;

    // Attach active schema to request object for downstream CRUD routes
    req.activeSchema = schema;

    // Skip validation for GET and DELETE requests
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next();
    }

    // 2. Extract valid fields from schema sections
    const schemaFields = [];
    if (config && config.sections && Array.isArray(config.sections)) {
      for (const section of config.sections) {
        // Graceful degradation: skip invalid section objects
        if (!section || typeof section !== 'object') {
          console.warn(`[Validator] Skipped invalid section configuration in schema: ${resource}`);
          continue;
        }
        if (section.fields && Array.isArray(section.fields)) {
          for (const field of section.fields) {
            // Graceful degradation: skip fields without definitions or names
            if (!field || typeof field !== 'object') continue;
            if (!field.name) {
              console.warn(`[Validator] Skipped field definition missing name in schema: ${resource}`);
              continue;
            }
            schemaFields.push(field);
          }
        }
      }
    }

    const payload = req.body || {};
    const cleanData = {};
    const validationErrors = [];

    // 3. Process and validate defined schema fields
    for (const field of schemaFields) {
      const value = payload[field.name];

      // A. Check required fields
      const isMissing = value === undefined || value === null || value === '';
      if (field.required && isMissing) {
        return res.status(400).json({
          error: `Missing required field: ${field.name}`,
          code: "VALIDATION_ERROR"
        });
      }

      // If optional and missing, just skip validation
      if (isMissing) {
        continue;
      }

      // B. Type and structure validation
      let coercedValue = value;
      let fieldValid = true;

      // Handle unknown types gracefully (treat as read-only or raw strings)
      const normalizedType = (field.type || 'text').toLowerCase();

      switch (normalizedType) {
        case 'number':
          const parsedNum = Number(value);
          if (isNaN(parsedNum)) {
            validationErrors.push({
              field: field.name,
              message: "Must be a number"
            });
            fieldValid = false;
          } else {
            coercedValue = parsedNum;
          }
          break;

        case 'email':
          const emailStr = String(value).trim();
          const emailRegex = /^\S+@\S+\.\S+$/;
          if (!emailRegex.test(emailStr)) {
            validationErrors.push({
              field: field.name,
              message: "Invalid email format"
            });
            fieldValid = false;
          } else {
            coercedValue = emailStr;
          }
          break;

        case 'date':
          const timestamp = Date.parse(value);
          if (isNaN(timestamp)) {
            validationErrors.push({
              field: field.name,
              message: "Invalid date format"
            });
            fieldValid = false;
          }
          break;

        case 'checkbox':
          if (typeof value === 'string') {
            coercedValue = value.toLowerCase() === 'true' || value === '1';
          } else {
            coercedValue = Boolean(value);
          }
          break;

        case 'select':
          if (field.options && Array.isArray(field.options)) {
            const matchesOption = field.options.some(
              opt => String(opt).toLowerCase() === String(value).toLowerCase()
            );
            if (!matchesOption) {
              validationErrors.push({
                field: field.name,
                message: `Value must be one of: ${field.options.join(', ')}`
              });
              fieldValid = false;
            }
          }
          break;

        default:
          // Treat any other type or custom component type as text/string
          // If structure is nested, check it and log warnings but proceed
          if (typeof value === 'object') {
            console.warn(`[Validator Warning] Field ${field.name} contains nested object structure. Storing as is.`);
          }
          break;
      }

      // C. Regex Pattern check (if specified)
      if (fieldValid && field.pattern) {
        try {
          const regex = new RegExp(field.pattern);
          if (!regex.test(String(coercedValue))) {
            validationErrors.push({
              field: field.name,
              message: `Value does not match required pattern: ${field.pattern}`
            });
            fieldValid = false;
          }
        } catch (err) {
          console.warn(`[Validator Warning] Invalid regex pattern "${field.pattern}" for field ${field.name}`);
        }
      }

      // D. If valid, save to cleanData (ignores extra properties on defined fields)
      if (fieldValid) {
        cleanData[field.name] = coercedValue;
      }
    }

    // 4. Return accumulated validation errors
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        fields: validationErrors
      });
    }

    // 5. Replace req.body with cleanData (ignores extra fields not in schema)
    req.body = cleanData;
    next();
  } catch (err) {
    console.error("Validation middleware crash:", err);
    return res.status(500).json({
      error: "Internal server error during validation pipeline",
      code: "INTERNAL_ERROR"
    });
  }
}
