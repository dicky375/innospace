import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

// ===== DEBUG (remove in production) =====
if (process.env.NODE_ENV !== 'production') {
  console.log('[AUTH] JWT_ACCESS_SECRET:', JWT_ACCESS_SECRET ? '✅ Set' : '❌ Missing');
}

// ===== AUTHENTICATE =====
export const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access token is required'
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token is required'
    });
  }

  if (!JWT_ACCESS_SECRET) {
    console.error('[AUTH] JWT_ACCESS_SECRET is not defined in .env');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error'
    });
  }

  jwt.verify(token, JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      console.log('[AUTH] JWT verification failed:', err.message);
      
      const errorMessage = err.name === 'TokenExpiredError' 
        ? 'Access token expired' 
        : 'Invalid access token';
        
      const errorCode = err.name === 'TokenExpiredError' 
        ? 'TOKEN_EXPIRED' 
        : 'INVALID_TOKEN';

      return res.status(401).json({
        success: false,
        error: errorMessage,
        code: errorCode
      });
    }

    // Attach user to request
    req.user = decoded;
    next();
  });
};

// ===== OPTIONAL AUTHENTICATION =====
export const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  if (!JWT_ACCESS_SECRET) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      req.user = null;
    } else {
      req.user = decoded;
    }
    next();
  });
};

// ===== ROLE CHECKS =====
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
};

export const requireAffiliate = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.role !== 'affiliate') {
    return res.status(403).json({
      success: false,
      error: 'Only affiliates are allowed to perform this action'
    });
  }

  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access only'
    });
  }

  next();
};

// ===== OWNER CHECK =====
export const requireOwnership = (resourceGetter) => {
  return async (req, res, next) => {
    try {
      const resource = await resourceGetter(req);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
      }

      // Check if user owns the resource or is admin
      if (req.user.role === 'admin') {
        return next();
      }

      const ownerId = resource.userId || resource.affiliateId || resource.createdBy;
      
      if (ownerId && ownerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to access this resource'
        });
      }

      next();
    } catch (err) {
      console.error('[AUTH] Ownership check error:', err);
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  };
};

// ===== ISOLATE (for service-to-service communication) =====
export const requireServiceSecret = (req, res, next) => {
  const serviceSecret = req.headers['x-service-secret'];
  
  if (!serviceSecret || serviceSecret !== process.env.INTERNAL_SERVICE_SECRET) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid service secret'
    });
  }

  next();
};

// ===== EXPORTS =====
export default {
  authenticate,
  optionalAuthenticate,
  requireAuth,
  requireAffiliate,
  requireAdmin,
  requireOwnership,
  requireServiceSecret
};