import { Router } from 'express';
import { db } from '../db/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Retrieve all schemas visible to the authenticated user
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM schemas WHERE created_by = $1 OR is_public = true ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to query schemas:", err);
    res.status(500).json({ error: "Failed to fetch schemas", code: "DATABASE_ERROR" });
  }
});

// Fetch a single schema config by name
router.get('/:name', authenticate, async (req, res) => {
  const { name } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM schemas WHERE name = $1',
      [name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: `Schema not found for resource: ${name}`,
        code: "SCHEMA_NOT_FOUND"
      });
    }

    const schema = result.rows[0];

    // Ownership check: must be owner or admin or public
    if (schema.created_by !== req.user.id && !schema.is_public && req.user.role !== 'admin') {
      return res.status(403).json({
        error: "Access denied to schema definition",
        code: "FORBIDDEN"
      });
    }

    res.json(schema);
  } catch (err) {
    console.error("Failed to fetch schema detail:", err);
    res.status(500).json({ error: "Internal server error fetching schema", code: "DATABASE_ERROR" });
  }
});

// Create a new schema config
router.post('/', authenticate, async (req, res) => {
  const { name, config, is_public } = req.body;

  if (!name || !config) {
    return res.status(400).json({
      error: "Missing fields name and config in payload",
      code: "BAD_REQUEST"
    });
  }

  try {
    const result = await db.query(
      'INSERT INTO schemas (name, config, version, created_by, is_public) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, typeof config === 'string' ? config : JSON.stringify(config), 1, req.user.id, !!is_public]
    );

    // Audit log schema creation
    await db.query(
      'INSERT INTO audit_log (resource, action, user_id, old_data, new_data) VALUES ($1, $2, $3, $4, $5)',
      ['schema', 'CREATE', req.user.id, null, JSON.stringify(result.rows[0])]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to create schema:", err);
    
    // Map Unique Constraint Error (PostgreSQL code 23505)
    if (err.code === '23505' || err.message.includes('unique')) {
      return res.status(409).json({
        error: `Schema with name '${name}' already exists`,
        code: "DUPLICATE_ENTRY"
      });
    }

    res.status(500).json({ error: "Failed to create schema configuration", code: "DATABASE_ERROR" });
  }
});

// Update a schema (increments config_version / version)
router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { config } = req.body;

  if (!config) {
    return res.status(400).json({ error: "Missing config in update payload", code: "BAD_REQUEST" });
  }

  try {
    // 1. Fetch current schema version to check permissions
    const checkResult = await db.query('SELECT * FROM schemas WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Schema not found", code: "RESOURCE_NOT_FOUND" });
    }

    const currentSchema = checkResult.rows[0];

    // Check authorization: only owner or admin can update schemas
    if (currentSchema.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: "You do not own this schema config and cannot modify it",
        code: "FORBIDDEN"
      });
    }

    // 2. Perform schema update (version increases automatically in SQL or adapter)
    const result = await db.query(
      'UPDATE schemas SET config = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [typeof config === 'string' ? config : JSON.stringify(config), id]
    );

    // Audit log schema update
    await db.query(
      'INSERT INTO audit_log (resource, action, user_id, old_data, new_data) VALUES ($1, $2, $3, $4, $5)',
      ['schema', 'UPDATE', req.user.id, JSON.stringify(currentSchema), JSON.stringify(result.rows[0])]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to update schema configuration:", err);
    res.status(500).json({ error: "Internal server error updating schema", code: "DATABASE_ERROR" });
  }
});

export default router;
