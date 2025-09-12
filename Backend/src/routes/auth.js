const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller.js');

// Super Admin login
router.post('/superadmin/login', authController.superAdminLogin);

// Gym Admin login
router.post('/gymadmin/login', authController.gymAdminLogin);

// Mobile User login
router.post('/mobileuser/login', authController.userLogin);

module.exports = router;
