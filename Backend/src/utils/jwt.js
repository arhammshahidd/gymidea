const jwt = require('jsonwebtoken');

const signToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Helper function to check token version against database
const checkTokenVersion = async (decoded, db) => {
  if (!decoded.id || !decoded.role) return false;
  
  let tableName;
  switch (decoded.role) {
    case 'SUPER_ADMIN':
      tableName = 'super_admins';
      break;
    case 'GYM_ADMIN':
      tableName = 'gym_admins';
      break;
    case 'USER':
      tableName = 'users';
      break;
    default:
      return false;
  }
  
  const user = await db(tableName).where({ id: decoded.id }).select('token_version').first();
  return user && user.token_version === (decoded.token_version || 1);
};

module.exports = { signToken, verifyToken, checkTokenVersion };
