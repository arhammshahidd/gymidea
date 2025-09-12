const jwt = require('jsonwebtoken');

module.exports = function (role) {
  return (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
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
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      next();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  };
};
