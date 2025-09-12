const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller.js');

// Super Admin login
router.post('/super/login', authController.superAdminLogin);

// Gym Admin login
router.post('/gym/login', authController.gymAdminLogin);

// Mobile User login
router.post('/user/login', authController.userLogin);

module.exports = router;
