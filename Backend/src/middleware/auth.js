const jwtUtil = require('../utils/jwt');
const db = require('../config/db');

function parseAuthHeader(req) {
  const header = req.headers['authorization'] || '';
  const parts = header.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') return parts[1];
  return null;
}

async function requireSuperAdmin(req, res, next) {
  try {
    const token = parseAuthHeader(req);
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwtUtil.verifyToken(token);
    if (decoded.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Forbidden' });
    
    // Check token version
    const isValidVersion = await jwtUtil.checkTokenVersion(decoded, db);
    if (!isValidVersion) return res.status(401).json({ message: 'Token has been invalidated' });
    
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

async function requireGymAdmin(req, res, next) {
  try {
    const token = parseAuthHeader(req);
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwtUtil.verifyToken(token);
    if (decoded.role !== 'GYM_ADMIN') return res.status(403).json({ message: 'Forbidden' });
    
    // Check token version
    const isValidVersion = await jwtUtil.checkTokenVersion(decoded, db);
    if (!isValidVersion) return res.status(401).json({ message: 'Token has been invalidated' });
    
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = { requireSuperAdmin, requireGymAdmin };
