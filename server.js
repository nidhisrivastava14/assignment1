import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import schemaRouter from './routes/schemas.js';
import crudRouter from './routes/crud.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dynamic_stack_secret_key_12345';

// 1. CORS Configuration to support local dev client integrations
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Schema'],
  exposedHeaders: ['X-Schema'] // Crucial for client-side custom hooks to read versions
}));

// 2. Request ID tracker for premium diagnostic capabilities
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  next();
});

app.use(express.json());

// 3. Mock Authentication Token Endpoint (facilitates frontend client user switches)
app.post('/api/auth/token', (req, res) => {
  const { user_id, role, username } = req.body;

  if (!user_id || !username) {
    return res.status(400).json({
      error: "Missing user_id or username",
      code: "BAD_REQUEST"
    });
  }

  const payload = {
    user_id,
    username,
    role: role || 'user'
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  
  res.json({
    token,
    user: payload
  });
});

// 4. API Route Registrations
app.use('/api/schemas', schemaRouter);
app.use('/api', crudRouter); // Handles /api/:resource and /api/:resource/:id dynamically

// 5. Global Error Fallback (Strictly prunes stack traces in API response)
app.use((err, req, res, next) => {
  const requestId = req.id || 'N/A';
  console.error(`[Unhandled Error][ReqId: ${requestId}]:`, err);
  
  res.status(500).json({
    error: "An unexpected runtime error occurred on the server",
    code: "UNEXPECTED_SERVER_ERROR",
    requestId
  });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 DynamicStack Server running on port ${PORT}`);
  console.log(`📂 Node Mode: ESM`);
  console.log(`🔐 Mock auth active (POST /api/auth/token)`);
  console.log(`==================================================`);
});
