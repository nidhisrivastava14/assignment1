# DynamicStack: Metadata-Driven App Runtime

DynamicStack is a premium, metadata-driven application runtime that converts JSON configurations into fully functional React frontends and auto-generated RESTful backends. It features robust tenant security, streaming bulk data loading, audit logging, and advanced diagnostics tools.

```mermaid
graph TD
    Client[React App Workspace] -->|1. Request /api/:resource| API[Express Router routes/crud.js]
    API -->|2. Get Schema name| Validator[Validation middleware/validation.js]
    Validator -->|3. Query Schema config| DB[Database Adapter db/db.js]
    DB -->|4a. Query PG| PG[(PostgreSQL Database)]
    DB -->|4b. Connection Fails: Fallback| JSONDB[(Local JSON file db/fallback_db.json)]
    API -->|5. Inject Header: X-Schema| Client
    Client -->|6. Check Version Mismatch| Cache[Local Cache Sync]
```

---

## ✨ Features

### 1. Frontend Architecture (TypeScript & React)
- **Config-Driven UI Rendering**: Parses dynamic JSON configurations to build responsive layout interfaces including interactive forms (`FormBuilder.tsx`), searchable/sortable grids (`TableRenderer.tsx`), and customizable widgets (`DashboardGrid.tsx`).
- **Graceful Degradation & Resiliency**: Isolated using `ErrorBoundary.tsx`. Unknown field types render as read-only blocks, missing field attributes fail silently (skipped), and broken sections display localized alerts rather than crashing the page.
- **Premium Live Debug Console**:
  - **Live JSON Schema Editor**: Modify configurations and apply them on the fly.
  - **Schema Compliance Auditor**: Visual alerts detailing exactly what config warnings occurred (e.g. missing name, invalid patterns).
  - **Multi-Tenant JWT Switchboard**: Swap tokens between Alice (Admin), Bob (User), and Charlie (User) to instantly see scoping and permission changes.
  - **Real-Time HTTP Traffic Console**: Logs endpoint paths, methods, response codes, and query latency (ms).
  - **Live Audit Timeline Feed**: Lists collection-wide mutations (Inserts, Updates, Deletes, and CSV imports) with exact payloads.

### 2. Backend Architecture (Express ESM)
- **Auto-Generated RESTful APIs**: Exposes CRUD endpoints mapped directly to `:resource` parameters under `/api/:resource`.
- **Exposed Schema Versioning**: Mounts an `X-Schema` header on response payloads. Custom React hooks read this header to warn the user if local configurations are out of date compared to the database.
- **Multi-Tenant Isolation**: Enforces tenant-level scoping. Users only view and modify their own records (`user_id` scope), while `admin` users bypass filters. Accessing unauthorized tenant items returns a `403 Forbidden` error.
- **Input Cleansing & Validation**: Prunes properties not declared in the active schema and validates field rules (e.g., email format, required checks, number conversions, regex constraints).
- **Dual-Mode Database Fallback**: Connects to PostgreSQL when variables are provided, otherwise automatically degrades to a local JSON database file (`db/fallback_db.json`) with seeded mock data.
- **Bulk CSV Importing**: `POST /api/:resource/import-csv` streams and processes multi-part file payloads, validates rules per row, bulk-inserts valid rows, and records validation failures inside the audit trail.

---

## 📂 Project Structure

```
├── db/
│   ├── db.js                 # Dual-mode DB connector (PostgreSQL or local fallback)
│   ├── fallback_db.json      # Zero-config local JSON persistence database
│   └── migrations/
│       └── init.sql          # PostgreSQL table schemas (schemas, app_data, audit_log)
├── middleware/
│   ├── auth.js               # JWT security scoping & admin permission validation
│   └── validation.js         # Input validation & schema-based field pruning
├── routes/
│   ├── crud.js               # Collection-level dynamic CRUD routes & CSV streaming
│   └── schemas.js            # Schema CRUD, configuration management, and version increments
├── src/
│   ├── components/
│   │   ├── App.tsx           # Dashboard workspace, side editors, and debug consoles
│   │   ├── FormBuilder.tsx   # Config-driven forms & CSV upload triggers
│   │   ├── TableRenderer.tsx # Data grid with column visibility, sorting, and search
│   │   ├── DashboardGrid.tsx # Coordinate grid container mapping widgets
│   │   └── ErrorBoundary.tsx # UI isolation boundaries to capture element crashes
│   ├── hooks/
│   │   ├── useApiConfig.js   # Client fetch wrappers, HTTP interceptor, & version checkers
│   │   └── useFormConfig.js  # Dynamic form controllers, defaults, & validations
│   ├── App.css               # Premium CSS design variables, animations, and dark mode variables
│   └── main.tsx              # React entrypoint
├── server.js                 # Express app initialization & server entry
├── package.json              # System configuration & dependencies
└── tsconfig.json             # TypeScript compiler rules
```

---

## ⚙️ Setup & Local Development

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `yarn`

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Selection
- **JSON Fallback Mode (Default)**: If no environment variables are set, the application automatically runs using `db/fallback_db.json`. No setup is required.
- **PostgreSQL Mode**: Add connection parameters to a `.env` file in the root directory:
  ```env
  DATABASE_URL=postgres://username:password@localhost:5432/dynamicstack
  JWT_SECRET=your_custom_jwt_secret_key
  ```
  Run the initialization script inside `db/migrations/init.sql` to generate the schema tables.

### 4. Run the Servers

#### Start the Express API Server (Port 5000)
```bash
npm run server
```

#### Start the Vite React Dev Server (Port 5173)
```bash
npm run dev
```

#### Build for Production
```bash
npm run build
```

---

## 🧪 Automated Testing

We have included automated integration tests to verify endpoint scoping, schema validation, CSV parsing, and security permissions.

### 1. Run Backend Integration Tests
Ensure the Express server is running, then execute:
```bash
node c:/Users/DELL/.gemini/antigravity/brain/255a6bcd-befb-4b30-a8cc-c4f6dca076e8/scratch/test_backend.js
```
This tests:
- JWT Token auth generation.
- Schema retrieval.
- Scope-limiting collection lookups (ensuring Bob only sees Bob's records).
- Payload schema validation (missing required fields, format mismatches, extra field pruning).
- Access control violation checking (preventing Charlie from querying Bob's records).
- Schema configuration version auto-increments.

### 2. Run CSV Import Verification Tests
```bash
node c:/Users/DELL/.gemini/antigravity/brain/255a6bcd-befb-4b30-a8cc-c4f6dca076e8/scratch/test_csv_import.js
```
This tests:
- Multipurpart streaming parsing.
- Row-level required, type, and regex validations.
- Error recording for failed rows inside the audit timeline.
- Collection-wide updates verification.
