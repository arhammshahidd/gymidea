const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller.js');
const auth = require('../middleware/authMiddleware');

// Super Admin login
router.post('/superadmin/login', authController.superAdminLogin);

// Gym Admin login
router.post('/gymadmin/login', authController.gymAdminLogin);

// Mobile User login
router.post('/mobileuser/login', authController.userLogin);

// Token validation endpoint for mobile apps
router.get('/validate', auth(), authController.validateToken);

module.exports = router;
