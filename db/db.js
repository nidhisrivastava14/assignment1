import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const FALLBACK_FILE_PATH = path.resolve(process.cwd(), 'db', 'fallback_db.json');

// Check if we are running in production or have PostgreSQL connection info
const hasPgConfig = !!(process.env.DATABASE_URL || process.env.PGHOST);

let pool = null;
let isFallback = true;
let mockDb = {
  schemas: [],
  app_data: [],
  audit_log: []
};

// Seed default schemas in mock database if empty
const DEFAULT_SCHEMAS = [
  {
    id: "schema-user-profiles",
    name: "users",
    config: {
      name: "User Profiles",
      version: 1,
      layout: "form",
      sections: [
        {
          id: "basic_info",
          name: "Basic Information",
          fields: [
            { name: "username", label: "User Name", type: "text", required: true, placeholder: "e.g. johndoe" },
            { name: "email", label: "Email Address", type: "text", required: true, pattern: "^\\S+@\\S+\\.\\S+$", placeholder: "e.g. john@example.com" },
            { name: "age", label: "Age", type: "number", placeholder: "e.g. 25" }
          ]
        },
        {
          id: "preferences",
          name: "System Preferences",
          fields: [
            { name: "role", label: "System Role", type: "select", options: ["User", "Admin", "Moderator"], defaultValue: "User" },
            { name: "newsletter", label: "Subscribe to Newsletter", type: "checkbox" },
            { name: "birthdate", label: "Date of Birth", type: "date" },
            { name: "bio", label: "Biography Description", type: "textarea" },
            { name: "custom_token", label: "Secret Code (Custom Type)", type: "custom-token-input" },
            { label: "Broken Field (Missing Name)" } // missing name, should skip
          ]
        }
      ]
    },
    version: 1,
    created_by: "system",
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "schema-dashboard-metrics",
    name: "dashboard",
    config: {
      name: "Operational Metrics",
      version: 1,
      layout: "dashboard",
      sections: [
        {
          id: "metrics_section",
          name: "Performance Statistics",
          type: "dashboard",
          widgets: [
            { id: "w-1", title: "Active Accounts", type: "metric", value: "8,924", grid: { x: 0, y: 0, w: 4, h: 2 } },
            { id: "w-2", title: "API Request Load", type: "metric", value: "99.8%", grid: { x: 4, y: 0, w: 4, h: 2 } },
            { id: "w-3", title: "Revenue Growth", type: "chart", value: "$45,210", grid: { x: 8, y: 0, w: 4, h: 4 } }
          ]
        }
      ]
    },
    version: 1,
    created_by: "system",
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Seed default dynamic user records for users schema
const DEFAULT_APP_DATA = [
  {
    id: "data-user-1",
    schema_id: "schema-user-profiles",
    data: {
      username: "nidhi_srivastava",
      email: "nidhi@example.com",
      age: 28,
      role: "Admin",
      newsletter: true,
      birthdate: "1998-05-12",
      bio: "Software Architect working on DynamicStack systems."
    },
    user_id: "user_1", // Alice
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "data-user-2",
    schema_id: "schema-user-profiles",
    data: {
      username: "bob_developer",
      email: "bob@dev.com",
      age: 34,
      role: "User",
      newsletter: false,
      birthdate: "1992-09-24",
      bio: "Frontend Dev specializing in React meta-renderers."
    },
    user_id: "user_2", // Bob
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Initialize Fallback DB File
function initFallbackFile() {
  try {
    const dir = path.dirname(FALLBACK_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(FALLBACK_FILE_PATH)) {
      const content = fs.readFileSync(FALLBACK_FILE_PATH, 'utf-8');
      mockDb = JSON.parse(content);
    } else {
      mockDb = {
        schemas: [...DEFAULT_SCHEMAS],
        app_data: [...DEFAULT_APP_DATA],
        audit_log: []
      };
      saveFallbackDb();
    }
  } catch (err) {
    console.error("Failed to load fallback JSON database. Initializing in-memory.", err);
  }
}

function saveFallbackDb() {
  try {
    fs.writeFileSync(FALLBACK_FILE_PATH, JSON.stringify(mockDb, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to write to fallback JSON file:", err);
  }
}

// Check database connection
async function testConnection() {
  if (!hasPgConfig) {
    console.warn("⚠️ No PostgreSQL configuration found in environment variables. Falling back to local JSON database.");
    isFallback = true;
    initFallbackFile();
    return;
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    // Try a simple query
    await pool.query('SELECT NOW()');
    console.log("🚀 PostgreSQL database connected successfully.");
    isFallback = false;
  } catch (err) {
    console.error("⚠️ PostgreSQL connection failed. Falling back to local JSON database. Error:", err.message);
    isFallback = true;
    initFallbackFile();
  }
}

// Initialize Database connection on module load
testConnection();

export const db = {
  isFallback: () => isFallback,

  // General SQL query interface.
  // Supports basic query patterns dynamically mapped to the fallback DB to make code transparent.
  query: async (text, params = []) => {
    if (!isFallback) {
      return pool.query(text, params);
    }

    // Normalized SQL parser helper for mock DB
    const sql = text.replace(/\s+/g, ' ').trim();
    
    // ── SCHEMAS QUERIES ──
    if (sql.startsWith('SELECT * FROM schemas')) {
      // Schema queries: SELECT * WHERE created_by = ? OR is_public = true
      // Or select schema by name: WHERE name = ?
      if (sql.includes('name = $1')) {
        const name = params[0];
        const rows = mockDb.schemas.filter(s => s.name === name);
        return { rows };
      }
      if (sql.includes('created_by = $1 OR is_public = true')) {
        const userId = params[0];
        const rows = mockDb.schemas.filter(s => s.created_by === userId || s.is_public === true);
        return { rows };
      }
      return { rows: mockDb.schemas };
    }

    if (sql.startsWith('INSERT INTO schemas')) {
      // INSERT INTO schemas (name, config, version, created_by, is_public) VALUES ($1, $2, $3, $4, $5) RETURNING *
      const [name, config, version, created_by, is_public] = params;
      
      // Check unique constraint
      if (mockDb.schemas.some(s => s.name === name)) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        throw err;
      }

      const newSchema = {
        id: crypto.randomUUID(),
        name,
        config: typeof config === 'string' ? JSON.parse(config) : config,
        version: version || 1,
        created_by,
        is_public: is_public ?? false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockDb.schemas.push(newSchema);
      saveFallbackDb();
      return { rows: [newSchema] };
    }

    if (sql.startsWith('UPDATE schemas')) {
      // UPDATE schemas SET config = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *
      const [config, id] = params;
      const index = mockDb.schemas.findIndex(s => s.id === id);
      if (index === -1) return { rows: [] };

      mockDb.schemas[index].config = typeof config === 'string' ? JSON.parse(config) : config;
      mockDb.schemas[index].version += 1;
      mockDb.schemas[index].updated_at = new Date().toISOString();
      saveFallbackDb();
      return { rows: [mockDb.schemas[index]] };
    }

    // ── APP DATA QUERIES ──
    if (sql.startsWith('SELECT * FROM app_data')) {
      if (sql.includes('id = $1')) {
        const id = params[0];
        const row = mockDb.app_data.find(d => d.id === id);
        return { rows: row ? [row] : [] };
      }
      if (sql.includes('schema_id = $1 AND user_id = $2')) {
        const [schemaId, userId] = params;
        const rows = mockDb.app_data.filter(d => d.schema_id === schemaId && d.user_id === userId);
        return { rows };
      }
      if (sql.includes('schema_id = $1')) {
        const schemaId = params[0];
        const rows = mockDb.app_data.filter(d => d.schema_id === schemaId);
        return { rows };
      }
      return { rows: mockDb.app_data };
    }

    if (sql.startsWith('INSERT INTO app_data')) {
      // INSERT INTO app_data (schema_id, data, user_id) VALUES ($1, $2, $3) RETURNING *
      const [schemaId, data, userId] = params;
      const newRecord = {
        id: crypto.randomUUID(),
        schema_id: schemaId,
        data: typeof data === 'string' ? JSON.parse(data) : data,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockDb.app_data.push(newRecord);
      saveFallbackDb();
      return { rows: [newRecord] };
    }

    if (sql.startsWith('UPDATE app_data')) {
      // UPDATE app_data SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *
      const [data, id] = params;
      const index = mockDb.app_data.findIndex(d => d.id === id);
      if (index === -1) return { rows: [] };

      mockDb.app_data[index].data = typeof data === 'string' ? JSON.parse(data) : data;
      mockDb.app_data[index].updated_at = new Date().toISOString();
      saveFallbackDb();
      return { rows: [mockDb.app_data[index]] };
    }

    if (sql.startsWith('DELETE FROM app_data')) {
      // DELETE FROM app_data WHERE id = $1
      const id = params[0];
      const index = mockDb.app_data.findIndex(d => d.id === id);
      if (index === -1) return { rowCount: 0 };

      mockDb.app_data.splice(index, 1);
      saveFallbackDb();
      return { rowCount: 1 };
    }

    // ── AUDIT LOG QUERIES ──
    if (sql.startsWith('INSERT INTO audit_log')) {
      // INSERT INTO audit_log (resource, action, user_id, old_data, new_data) VALUES ($1, $2, $3, $4, $5)
      const [resource, action, userId, oldData, newData] = params;
      const log = {
        id: crypto.randomUUID(),
        resource,
        action,
        user_id: userId,
        timestamp: new Date().toISOString(),
        old_data: typeof oldData === 'string' ? JSON.parse(oldData) : oldData,
        new_data: typeof newData === 'string' ? JSON.parse(newData) : newData
      };
      mockDb.audit_log.push(log);
      saveFallbackDb();
      return { rows: [log] };
    }

    console.warn("⚠️ Unhandled mock query matching template:", sql);
    return { rows: [] };
  }
};
