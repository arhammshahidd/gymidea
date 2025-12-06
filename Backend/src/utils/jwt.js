const jwt = require('jsonwebtoken');

const signToken = (payload, expiresIn = '7d') => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  try {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  } catch (error) {
    console.error('JWT Signing Error:', error);
    throw new Error('Failed to sign JWT token: ' + error.message);
  }
};

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.error('JWT Verification Error:', error);
    throw error;
  }
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
    case 'TRAINER':
      tableName = 'trainers';
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
