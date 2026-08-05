// middleware/auth.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ===== ENVIRONMENT VALIDATION =====
if (!JWT_ACCESS_SECRET) {
  console.error('[AUTH] ❌ JWT_ACCESS_SECRET is not defined in .env');
}

if (!JWT_REFRESH_SECRET) {
  console.warn('[AUTH] ⚠️ JWT_REFRESH_SECRET is not defined (optional)');
}

// Only log in non-production environments
if (NODE_ENV !== 'production') {
  console.log('[AUTH] ✅ JWT_ACCESS_SECRET:', JWT_ACCESS_SECRET ? 'Set' : 'Missing');
  console.log('[AUTH] ✅ JWT_REFRESH_SECRET:', JWT_REFRESH_SECRET ? 'Set' : 'Not set');
  console.log('[AUTH] 🔧 Environment:', NODE_ENV);
}

// ===== CONSTANTS =====
const ROLES = {
  ADMIN: 'admin',
  AFFILIATE: 'affiliate',
  USER: 'user',
  STUDENT: 'student'
};

const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 4,
  [ROLES.AFFILIATE]: 3,
  [ROLES.USER]: 2,
  [ROLES.STUDENT]: 1
};

const ALLOWED_ROLES = Object.values(ROLES);

// ===== HELPER FUNCTIONS =====

/**
 * Extract token from Authorization header
 */
const extractToken = (req) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  // If no Bearer prefix, treat the whole header as token
  return authHeader;
};

/**
 * Verify JWT token with error handling
 */
const verifyToken = (token, secret) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
};

/**
 * Check if user has required role
 */
const hasRole = (user, requiredRole) => {
  if (!user) return false;
  
  // Admin has access to everything
  if (user.role === ROLES.ADMIN) return true;
  
  // Check if user role matches required role
  return user.role === requiredRole;
};

/**
 * Check if user has at least minimum role level
 */
const hasMinRoleLevel = (user, minRole) => {
  if (!user) return false;
  
  const userLevel = ROLE_HIERARCHY[user.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
  
  return userLevel >= requiredLevel;
};

// ===== MAIN AUTHENTICATION MIDDLEWARES =====

/**
 * Authenticate - Verifies JWT token and attaches user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required',
        code: 'TOKEN_MISSING'
      });
    }

    if (!JWT_ACCESS_SECRET) {
      console.error('[AUTH] ❌ JWT_ACCESS_SECRET is not configured');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        code: 'CONFIG_ERROR'
      });
    }

    try {
      const decoded = await verifyToken(token, JWT_ACCESS_SECRET);
      
      // Validate decoded user has required fields
      if (!decoded.id || !decoded.email || !decoded.role) {
        console.warn('[AUTH] ⚠️ Token missing required fields:', Object.keys(decoded));
        return res.status(401).json({
          success: false,
          error: 'Invalid token structure',
          code: 'INVALID_TOKEN_STRUCTURE'
        });
      }

      // Validate role is allowed
      if (!ALLOWED_ROLES.includes(decoded.role)) {
        console.warn('[AUTH] ⚠️ Invalid role in token:', decoded.role);
        return res.status(401).json({
          success: false,
          error: 'Invalid role in token',
          code: 'INVALID_ROLE'
        });
      }

      // Attach user to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name || null,
        iat: decoded.iat,
        exp: decoded.exp
      };

      // Log authentication success (only in development)
      if (NODE_ENV !== 'production') {
        console.log(`[AUTH] ✅ User authenticated: ${req.user.email} (${req.user.role})`);
      }

      next();
    } catch (err) {
      // Handle JWT specific errors
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Access token has expired',
          code: 'TOKEN_EXPIRED'
        });
      }

      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid access token',
          code: 'INVALID_TOKEN'
        });
      }

      // Unknown error
      console.error('[AUTH] ❌ Token verification error:', err);
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_FAILED'
      });
    }
  } catch (err) {
    console.error('[AUTH] ❌ Authentication middleware error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Optional Authentication - Doesn't require token but attaches user if present
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      req.user = null;
      return next();
    }

    if (!JWT_ACCESS_SECRET) {
      req.user = null;
      return next();
    }

    try {
      const decoded = await verifyToken(token, JWT_ACCESS_SECRET);
      
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name || null
      };
    } catch (err) {
      // Token is invalid but we don't block the request
      req.user = null;
    }

    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

// ===== ROLE-BASED AUTHORIZATION MIDDLEWARES =====

/**
 * Require Authentication - Only allows authenticated users
 */
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
};

/**
 * Require Affiliate Role - Only allows affiliates (and admins)
 */
export const requireAffiliate = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Admin has access to everything
  if (req.user.role === ROLES.ADMIN) {
    return next();
  }

  if (req.user.role !== ROLES.AFFILIATE) {
    console.log(`[AUTH] ❌ Access denied: User ${req.user.email} (${req.user.role}) is not an affiliate`);
    return res.status(403).json({
      success: false,
      error: 'Affiliate access required',
      code: 'AFFILIATE_REQUIRED',
      currentRole: req.user.role
    });
  }

  next();
};

/**
 * Require Admin Role - Only allows admins
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role !== ROLES.ADMIN) {
    console.log(`[AUTH] ❌ Access denied: User ${req.user.email} (${req.user.role}) is not an admin`);
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED',
      currentRole: req.user.role
    });
  }

  next();
};

/**
 * Require User Role - Allows authenticated users (any role)
 */
export const requireUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // All authenticated users are allowed
  next();
};

/**
 * Role-based access control - Generic role checker
 * @param {string|string[]} allowedRoles - Single role or array of roles
 */
export const requireRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Admin has access to everything
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      console.log(`[AUTH] ❌ Access denied: User ${req.user.email} (${req.user.role}) not in allowed roles: ${roles.join(', ')}`);
      return res.status(403).json({
        success: false,
        error: `Access denied. Required roles: ${roles.join(', ')}`,
        code: 'ROLE_REQUIRED',
        currentRole: req.user.role,
        allowedRoles: roles
      });
    }

    next();
  };
};

/**
 * Minimum role level access
 * @param {string} minRole - Minimum role required
 */
export const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!hasMinRoleLevel(req.user, minRole)) {
      console.log(`[AUTH] ❌ Access denied: User ${req.user.email} (${req.user.role}) below required level ${minRole}`);
      return res.status(403).json({
        success: false,
        error: `Insufficient privileges. Required: ${minRole} or higher`,
        code: 'INSUFFICIENT_PRIVILEGES',
        currentRole: req.user.role,
        requiredRole: minRole
      });
    }

    next();
  };
};

// ===== OWNERSHIP CHECK =====

/**
 * Require Ownership - Checks if user owns the resource
 * @param {Function} resourceGetter - Async function that returns the resource
 * @param {string} ownerField - Field name for owner ID (default: 'userId')
 */
export const requireOwnership = (resourceGetter, ownerField = 'userId') => {
  return async (req, res, next) => {
    try {
      // Admin bypass
      if (req.user && req.user.role === ROLES.ADMIN) {
        return next();
      }

      const resource = await resourceGetter(req);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND'
        });
      }

      // Check if user owns the resource
      const ownerId = resource[ownerField] || resource.affiliateId || resource.createdBy || resource.userId;
      
      if (!ownerId) {
        console.warn('[AUTH] ⚠️ Resource has no owner field:', ownerField);
        return res.status(403).json({
          success: false,
          error: 'Cannot verify ownership',
          code: 'OWNERSHIP_ERROR'
        });
      }

      if (ownerId !== req.user.id) {
        console.log(`[AUTH] ❌ Ownership denied: User ${req.user.id} doesn't own resource ${resource.id}`);
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to access this resource',
          code: 'OWNERSHIP_REQUIRED'
        });
      }

      next();
    } catch (err) {
      console.error('[AUTH] ❌ Ownership check error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to verify ownership',
        code: 'OWNERSHIP_CHECK_FAILED'
      });
    }
  };
};

// ===== SERVICE-TO-SERVICE AUTHENTICATION =====

/**
 * Require Service Secret - For internal service communication
 */
export const requireServiceSecret = (req, res, next) => {
  const serviceSecret = req.headers['x-service-secret'] || req.headers['X-Service-Secret'];
  
  if (!serviceSecret) {
    console.warn('[AUTH] ⚠️ Service secret missing from request');
    return res.status(401).json({
      success: false,
      error: 'Service authentication required',
      code: 'SERVICE_SECRET_REQUIRED'
    });
  }

  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;
  
  if (!expectedSecret) {
    console.error('[AUTH] ❌ INTERNAL_SERVICE_SECRET not configured');
    return res.status(500).json({
      success: false,
      error: 'Service configuration error',
      code: 'CONFIG_ERROR'
    });
  }

  if (serviceSecret !== expectedSecret) {
    console.warn('[AUTH] ⚠️ Invalid service secret attempt');
    return res.status(401).json({
      success: false,
      error: 'Invalid service secret',
      code: 'INVALID_SERVICE_SECRET'
    });
  }

  // Optionally attach a system user
  req.user = {
    id: 'system',
    role: ROLES.ADMIN,
    email: 'system@internal',
    isSystem: true
  };

  next();
};

// ===== API KEY AUTHENTICATION =====

/**
 * Require API Key - For external API access
 */
export const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
      code: 'API_KEY_REQUIRED'
    });
  }

  // Check against environment variables or database
  const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
  
  if (!validApiKeys.includes(apiKey)) {
    console.warn('[AUTH] ⚠️ Invalid API key attempt');
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  next();
};

// ===== UTILITY FUNCTIONS =====

/**
 * Get user from token without authentication
 * Useful for services that need to validate tokens
 */
export const getUserFromToken = async (token) => {
  try {
    if (!token) return null;
    if (!JWT_ACCESS_SECRET) return null;
    
    const decoded = await verifyToken(token, JWT_ACCESS_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
};

/**
 * Check if user has specific role
 */
export const userHasRole = (user, role) => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  return user.role === role;
};

/**
 * Check if user has any of the specified roles
 */
export const userHasAnyRole = (user, roles) => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  return roles.includes(user.role);
};

// ===== EXPORTS =====

export default {
  // Main middleware
  authenticate,
  optionalAuthenticate,
  
  // Role-based middleware
  requireAuth,
  requireAffiliate,
  requireAdmin,
  requireUser,
  requireRole,
  requireMinRole,
  
  // Advanced middleware
  requireOwnership,
  requireServiceSecret,
  requireApiKey,
  
  // Utility functions
  getUserFromToken,
  userHasRole,
  userHasAnyRole,
  hasRole,
  hasMinRoleLevel,
  
  // Constants
  ROLES,
  ROLE_HIERARCHY,
  ALLOWED_ROLES
};