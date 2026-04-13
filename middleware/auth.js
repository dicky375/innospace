import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });

  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_ACCESS_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    res.status(401).json({ error: 'Token invalid' });
  }
}

export function requireAffiliate(req, res, next) {
  if (req.user?.role !== 'affiliate')
    return res.status(403).json({ error: 'Only affilites can perform this action' });
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required' });
  next();
}