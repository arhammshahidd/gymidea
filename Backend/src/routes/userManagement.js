const express = require('express');
const router = express.Router();
const userManagementController = require('../controllers/userManagementController');
const jwt = require('jsonwebtoken');

// Custom middleware to allow both GYM_ADMIN and TRAINER roles
const userManagementAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const normalizedRole = typeof decoded.role === 'string' ? decoded.role.toUpperCase() : decoded.role;
    
    // Allow both GYM_ADMIN and TRAINER roles
    if (normalizedRole !== 'GYM_ADMIN' && normalizedRole !== 'TRAINER') {
      return res.status(403).json({ success: false, message: 'Access denied. GYM_ADMIN or TRAINER role required.' });
    }

    const normalizedUser = {
      ...decoded,
      role: normalizedRole,
      gym_id: decoded.gym_id ?? decoded.gymId ?? decoded.gymID ?? null,
    };
    req.user = normalizedUser;

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// All routes require authentication and GYM_ADMIN or TRAINER role
router.use(userManagementAuth);

// User Statistics
router.get('/stats', userManagementController.getUserStats);

// User CRUD Operations
router.get('/', userManagementController.getAllUsers);
router.get('/:id', userManagementController.getUserById);
router.post('/', userManagementController.createUser);
router.put('/:id', userManagementController.updateUser);
router.delete('/:id', userManagementController.deleteUser);

// User Actions
router.post('/:id/logout', userManagementController.logoutUser);

module.exports = router;
