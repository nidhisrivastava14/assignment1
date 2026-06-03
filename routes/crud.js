import { Router } from 'express';
import { db } from '../db/db.js';
import { authenticate } from '../middleware/auth.js';
import { validatePayload } from '../middleware/validation.js';

const router = Router();

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

export default router;
