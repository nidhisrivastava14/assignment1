-- DDL Migration for DynamicStack
-- PostgreSQL database schema definition

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Schemas Table: stores application dynamic configurations
CREATE TABLE IF NOT EXISTS schemas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    config JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_by VARCHAR(255) NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index schemas by name for faster lookups
CREATE INDEX IF NOT EXISTS idx_schemas_name ON schemas(name);

-- 2. Application Data Table: stores config-driven resource records
CREATE TABLE IF NOT EXISTS app_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_id UUID NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index app_data by schema and user for multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_app_data_schema_user ON app_data(schema_id, user_id);

-- 3. Audit Log Table: logs mutations (POST, PUT, DELETE)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    user_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    old_data JSONB,
    new_data JSONB
);

-- Index audit logs for reporting
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource);
