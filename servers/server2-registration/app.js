import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. DEFENSIVE DOTENV LOADING
// Try standard location, then one level up, then two levels up
dotenv.config(); 
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Backup: Try the absolute path for your specific Lubuntu setup
dotenv.config({ path: '/home/dicky/inno_backend/.env' });

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

// Terminal Debugging - This will tell you EXACTLY why it fails
console.log("--- [AUTH MIDDLEWARE DEBUG] ---");
console.log("Current Working Dir:", process.cwd());
console.log("Secret Found:", JWT_ACCESS_SECRET ? "YES ✅" : "NO ❌");
console.log("-------------------------------");

export const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access token is required'
    });
  }

  const token = authHeader.split(' ')[1];

  // This is the check that was failing
  if (!JWT_ACCESS_SECRET) {
    return res.status(500).json({ 
      success: false, 
      error: "Internal server config error",
      details: "JWT_ACCESS_SECRET is undefined. Check .env path."
    });
  }

  jwt.verify(token, JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      console.log("JWT Verification Failed:", err.message);
      return res.status(401).json({
        success: false,
        error: err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token'
      });
    }

    req.user = decoded;
    next();
  });
};

export const requireAffiliate = (req, res, next) => {
  if (req.user?.role !== 'affiliate') {
    return res.status(403).json({
      success: false,
      error: 'Only affiliates are allowed to perform this action'
    });
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access only'
    });
  }
  next();
};

export default { authenticate, requireAffiliate, requireAdmin };