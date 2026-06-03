import { Router } from 'express';
import { db } from '../db/db.js';
import { authenticate } from '../middleware/auth.js';
import { validatePayload } from '../middleware/validation.js';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to set X-Schema response headers and expose it to client JS
function setSchemaHeader(res, schema) {
  if (schema) {
    const payload = {
      id: schema.id,
      name: schema.name,
      version: schema.version,
      config: schema.config
    };
    res.setHeader('X-Schema', JSON.stringify(payload));
    res.setHeader('Access-Control-Expose-Headers', 'X-Schema');
  }
}

// 1. GET /api/:resource/ (Read Collection)
router.get('/:resource', authenticate, validatePayload, async (req, res) => {
  const { resource } = req.params;
  const requestId = req.id || 'N/A';
  
  try {
    const schema = req.activeSchema;
    let queryResult;

    // Admin can see everything, normal users are scoped to their own data
    if (req.user.role === 'admin') {
      queryResult = await db.query(
        'SELECT * FROM app_data WHERE schema_id = $1 ORDER BY created_at DESC',
        [schema.id]
      );
    } else {
      queryResult = await db.query(
        'SELECT * FROM app_data WHERE schema_id = $1 AND user_id = $2 ORDER BY created_at DESC',
        [schema.id, req.user.id]
      );
    }

    // Format output with resource payload properties
    const dataRecords = queryResult.rows.map(row => ({
      id: row.id,
      ...row.data,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    setSchemaHeader(res, schema);
    res.json(dataRecords);
  } catch (err) {
    console.error(`[Error][ReqId: ${requestId}] GET /${resource} failed:`, err);
    res.status(500).json({
      error: "Internal server error reading data collection",
      code: "INTERNAL_ERROR",
      requestId
    });
  }
});

// 2. GET /api/:resource/:id (Read Member)
router.get('/:resource/:id', authenticate, validatePayload, async (req, res) => {
  const { resource, id } = req.params;
  const requestId = req.id || 'N/A';

  try {
    const schema = req.activeSchema;
    
    const queryResult = await db.query(
      'SELECT * FROM app_data WHERE id = $1 AND schema_id = $2',
      [id, schema.id]
    );

    if (queryResult.rows.length === 0) {
      return res.status(404).json({
        error: "Resource not found",
        code: "RESOURCE_NOT_FOUND"
      });
    }

    const row = queryResult.rows[0];

    // Ownership check: must be owner or admin
    if (row.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: "You do not have permission to access this resource",
        code: "FORBIDDEN"
      });
    }

    setSchemaHeader(res, schema);
    res.json({
      id: row.id,
      ...row.data,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  } catch (err) {
    console.error(`[Error][ReqId: ${requestId}] GET /${resource}/${id} failed:`, err);
    res.status(500).json({
      error: "Internal server error fetching resource",
      code: "INTERNAL_ERROR",
      requestId
    });
  }
});

// 3. POST /api/:resource/ (Create Member)
router.post('/:resource', authenticate, validatePayload, async (req, res) => {
  const { resource } = req.params;
  const requestId = req.id || 'N/A';

  try {
    const schema = req.activeSchema;

    const queryResult = await db.query(
      'INSERT INTO app_data (schema_id, data, user_id) VALUES ($1, $2, $3) RETURNING *',
      [schema.id, JSON.stringify(req.body), req.user.id]
    );

    const newRecord = queryResult.rows[0];

    // Log Mutation to Audit Log
    await db.query(
      'INSERT INTO audit_log (resource, action, user_id, old_data, new_data) VALUES ($1, $2, $3, $4, $5)',
      [resource, 'INSERT', req.user.id, null, JSON.stringify(newRecord)]
    );

    setSchemaHeader(res, schema);
    res.status(201).json({
      id: newRecord.id,
      ...newRecord.data,
      created_at: newRecord.created_at,
      updated_at: newRecord.updated_at
    });
  } catch (err) {
    console.error(`[Error][ReqId: ${requestId}] POST /${resource} failed:`, err);
    
    // Database unique constraint violation mapping
    if (err.code === '23505' || err.message.includes('unique')) {
      return res.status(409).json({
        error: "Record with unique identifier already exists",
        code: "DUPLICATE_ENTRY"
      });
    }

    // Type mismatch errors
    if (err.code === '22P02' || err.message.includes('invalid input syntax')) {
      return res.status(400).json({
        error: "Database rejected input formatting",
        code: "INVALID_DATA_TYPE"
      });
    }

    res.status(500).json({
      error: "Failed to create resource data record",
      code: "DATABASE_ERROR",
      requestId
    });
  }
});

// 4. PUT /api/:resource/:id (Update Member)
router.put('/:resource/:id', authenticate, validatePayload, async (req, res) => {
  const { resource, id } = req.params;
  const requestId = req.id || 'N/A';

  try {
    const schema = req.activeSchema;

    // Retrieve old data to check permissions and record details
    const checkResult = await db.query(
      'SELECT * FROM app_data WHERE id = $1 AND schema_id = $2',
      [id, schema.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: "Resource not found",
        code: "RESOURCE_NOT_FOUND"
      });
    }

    const currentRecord = checkResult.rows[0];

    // Ownership check: must be owner or admin
    if (currentRecord.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: "You do not have permission to modify this resource",
        code: "FORBIDDEN"
      });
    }

    // Perform database record update
    const queryResult = await db.query(
      'UPDATE app_data SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [JSON.stringify(req.body), id]
    );

    const updatedRecord = queryResult.rows[0];

    // Log Mutation to Audit Log
    await db.query(
      'INSERT INTO audit_log (resource, action, user_id, old_data, new_data) VALUES ($1, $2, $3, $4, $5)',
      [resource, 'UPDATE', req.user.id, JSON.stringify(currentRecord), JSON.stringify(updatedRecord)]
    );

    setSchemaHeader(res, schema);
    res.json({
      id: updatedRecord.id,
      ...updatedRecord.data,
      created_at: updatedRecord.created_at,
      updated_at: updatedRecord.updated_at
    });
  } catch (err) {
    console.error(`[Error][ReqId: ${requestId}] PUT /${resource}/${id} failed:`, err);

    if (err.code === '23505' || err.message.includes('unique')) {
      return res.status(409).json({
        error: "Update violates unique data integrity parameters",
        code: "DUPLICATE_ENTRY"
      });
    }

    if (err.code === '22P02' || err.message.includes('invalid input syntax')) {
      return res.status(400).json({
        error: "Database rejected data types in payload update",
        code: "INVALID_DATA_TYPE"
      });
    }

    res.status(500).json({
      error: "Failed to update resource data record",
      code: "DATABASE_ERROR",
      requestId
    });
  }
});

// 5. DELETE /api/:resource/:id (Delete Member)
router.delete('/:resource/:id', authenticate, validatePayload, async (req, res) => {
  const { resource, id } = req.params;
  const requestId = req.id || 'N/A';

  try {
    const schema = req.activeSchema;

    const checkResult = await db.query(
      'SELECT * FROM app_data WHERE id = $1 AND schema_id = $2',
      [id, schema.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: "Resource not found",
        code: "RESOURCE_NOT_FOUND"
      });
    }

    const record = checkResult.rows[0];

    // Ownership check: must be owner or admin
    if (record.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: "You do not have permission to delete this resource",
        code: "FORBIDDEN"
      });
    }

    await db.query('DELETE FROM app_data WHERE id = $1', [id]);

    // Log Mutation to Audit Log
    await db.query(
      'INSERT INTO audit_log (resource, action, user_id, old_data, new_data) VALUES ($1, $2, $3, $4, $5)',
      [resource, 'DELETE', req.user.id, JSON.stringify(record), null]
    );

    setSchemaHeader(res, schema);
    res.json({ success: true, message: "Resource deleted successfully" });
  } catch (err) {
    console.error(`[Error][ReqId: ${requestId}] DELETE /${resource}/${id} failed:`, err);
    res.status(500).json({
      error: "Internal server error removing resource",
      code: "DATABASE_ERROR",
      requestId
    });
  }
});

// 6. POST /api/:resource/import-csv (CSV Stream Parser & Bulk Loader)
router.post('/:resource/import-csv', authenticate, upload.single('file'), async (req, res) => {
  const { resource } = req.params;
  const results = [];
  const requestId = req.id || 'N/A';
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded", code: "NO_FILE" });
    }
    
    // Fetch schema details manually
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
    
    // Extract schema fields to filter/cast cells
    const schemaFields = [];
    if (schema.config && schema.config.sections && Array.isArray(schema.config.sections)) {
      for (const section of schema.config.sections) {
        if (section && section.fields && Array.isArray(section.fields)) {
          for (const field of section.fields) {
            if (field && field.name) {
              schemaFields.push(field);
            }
          }
        }
      }
    }
    
    // Parse CSV buffer stream
    const stream = Readable.from([req.file.buffer]);
    const parseStream = stream.pipe(csvParser());
    
    parseStream.on('data', (row) => {
      const cleanedRow = {};
      for (const field of schemaFields) {
        const val = row[field.name];
        if (val !== undefined && val !== null && val !== '') {
          let coercedVal = val;
          const normalizedType = (field.type || 'text').toLowerCase();
          if (normalizedType === 'number') {
            coercedVal = Number(val);
            if (isNaN(coercedVal)) coercedVal = val;
          } else if (normalizedType === 'checkbox') {
            coercedVal = val.toLowerCase() === 'true' || val === '1';
          }
          cleanedRow[field.name] = coercedVal;
        }
      }
      if (Object.keys(cleanedRow).length > 0) {
        results.push(cleanedRow);
      }
    });
    
    parseStream.on('error', (err) => {
      console.error("CSV parse error:", err);
      res.status(400).json({ error: "Invalid CSV format", code: "PARSE_ERROR" });
    });
    
    parseStream.on('end', async () => {
      let inserted = 0;
      const errors = [];
      
      for (const row of results) {
        try {
          // Perform required validations
          let rowValid = true;
          for (const field of schemaFields) {
            if (field.required && (row[field.name] === undefined || row[field.name] === null || row[field.name] === '')) {
              errors.push({ row, error: `Missing required field: ${field.name}` });
              rowValid = false;
              break;
            }
            if (field.type === 'email' && row[field.name]) {
              const emailRegex = /^\S+@\S+\.\S+$/;
              if (!emailRegex.test(String(row[field.name]))) {
                errors.push({ row, error: `Invalid email format for ${field.name}` });
                rowValid = false;
                break;
              }
            }
            if (field.pattern && row[field.name]) {
              try {
                const regex = new RegExp(field.pattern);
                if (!regex.test(String(row[field.name]))) {
                  errors.push({ row, error: `Value does not match required pattern for ${field.name}: ${field.pattern}` });
                  rowValid = false;
                  break;
                }
              } catch (e) {
                // ignore invalid pattern configuration
              }
            }
          }
          
          if (!rowValid) continue;

          await db.query(
            'INSERT INTO app_data (schema_id, data, user_id) VALUES ($1, $2, $3)',
            [schema.id, JSON.stringify(row), req.user.id]
          );
          inserted++;
        } catch (err) {
          console.error("Row insert failed:", err);
          errors.push({ row, error: err.message });
        }
      }
      
      // Log CSV Import inside audit_log table
      await db.query(
        'INSERT INTO audit_log (resource, action, user_id, old_data, new_data) VALUES ($1, $2, $3, $4, $5)',
        [resource, 'CSV_IMPORT', req.user.id, null, JSON.stringify({ imported: inserted, total: results.length, failed: results.length - inserted, errors })]
      );
      
      res.json({ success: true, imported: inserted, total: results.length, failed: results.length - inserted, errors });
    });
    
  } catch (err) {
    console.error(`[Error][ReqId: ${requestId}] CSV Import failed:`, err);
    res.status(500).json({ error: "CSV import failed", code: "IMPORT_ERROR" });
  }
});

// 7. GET /api/:resource/audit (Fetch Audit Timeline Logs)
router.get('/:resource/audit', authenticate, validatePayload, async (req, res) => {
  const { resource } = req.params;
  const requestId = req.id || 'N/A';
  
  try {
    const logs = await db.query(
      `SELECT * FROM audit_log 
       WHERE resource = $1 
       ORDER BY timestamp DESC 
       LIMIT 50`,
      [resource]
    );
    
    setSchemaHeader(res, req.activeSchema);
    res.json(logs.rows);
  } catch (err) {
    console.error(`[Error][ReqId: ${requestId}] GET /${resource}/audit failed:`, err);
    res.status(500).json({
      error: "Internal server error fetching audit logs",
      code: "DATABASE_ERROR",
      requestId
    });
  }
});

export default router;
