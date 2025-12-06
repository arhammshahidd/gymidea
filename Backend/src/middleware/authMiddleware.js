const jwt = require('jsonwebtoken');

module.exports = function (role) {
  return (req, res, next) => {
    try {
      // CRITICAL: Log authentication attempts for completion endpoint
      if (req.path && req.path.includes('complete')) {
        console.log(`🔐 [AUTH] Authentication check for completion endpoint: ${req.method} ${req.path}`);
      }
      
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        if (req.path && req.path.includes('complete')) {
          console.error('❌ [AUTH] No token provided for completion endpoint');
        }
        return res.status(401).json({ success: false, message: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Normalize role casing and ensure gym_id presence
      const normalizedRole = typeof decoded.role === 'string' ? decoded.role.toUpperCase() : decoded.role;
      const normalizedUser = {
        ...decoded,
        role: normalizedRole,
        gym_id: decoded.gym_id ?? decoded.gymId ?? decoded.gymID ?? null,
      };
      req.user = normalizedUser;

      if (role) {
        const expected = role.toUpperCase();
        if (normalizedRole !== expected) {
          if (req.path && req.path.includes('complete')) {
            console.error(`❌ [AUTH] Role mismatch for completion endpoint. Expected: ${expected}, Got: ${normalizedRole}`);
          }
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      if (req.path && req.path.includes('complete')) {
        console.log(`✅ [AUTH] Authentication successful for completion endpoint. User: ${normalizedUser.id}, Role: ${normalizedRole}`);
      }

      next();
    } catch (err) {
      if (req.path && req.path.includes('complete')) {
        console.error(`❌ [AUTH] Token verification failed for completion endpoint:`, err.message);
      }
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  };
};
