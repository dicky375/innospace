import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure .env is loaded correctly in a microservices structure
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

/**
 * Main Authentication Middleware
 * Validates the JWT and attaches user payload to req.user
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access token is required'
    });
  }

  const token = authHeader.split(' ')[1];

  if (!JWT_ACCESS_SECRET) {
    console.error("[AUTH ERROR]: JWT_ACCESS_SECRET is not defined in .env");
    return res.status(500).json({ success: false, error: "Internal server config error" });
  }

  jwt.verify(token, JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      console.log("JWT Auth Error:", err.message);
      
      const errorMessage = err.name === 'TokenExpiredError' 
        ? 'Access token expired' 
        : 'Invalid access token';
        
      return res.status(401).json({
        success: false,
        error: errorMessage,
        code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
      });
    }

    // Success: Attach decoded payload to request
    req.user = decoded; 
    next();
  });
};

/**
 * Role Check: Affiliates Only
 */
export const requireAffiliate = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  if (req.user.role !== 'affiliate') {
    return res.status(403).json({
      success: false,
      error: 'Only affiliates are allowed to perform this action'
    });
  }

  next();
};

/**
 * Role Check: Admins Only
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access only'
    });
  }

  next();
};

/**
 * Generic Auth Check: Allows any authenticated user (Admin or Affiliate)
 */
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
};

export default { authenticate, requireAffiliate, requireAdmin, requireAuth };