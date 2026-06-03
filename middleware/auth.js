import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dynamic_stack_secret_key_12345';

// Authenticate requests and extract user scoping
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: "Authentication token required",
      code: "UNAUTHORIZED"
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach credentials to request scope
    req.user = {
      id: decoded.user_id || decoded.id,
      username: decoded.username,
      role: decoded.role || 'user'
    };
    
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({
      error: "Invalid or expired authentication token",
      code: "UNAUTHORIZED"
    });
  }
}

// Authorize admin-only endpoints
export function authorizeAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: "Access denied: admin credentials required",
      code: "FORBIDDEN"
    });
  }
  next();
}
