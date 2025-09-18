const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/AppProfileController');
const auth = require('../middleware/authMiddleware');

// Profile - current user
router.get('/', auth(), ctrl.getProfile);
router.put('/', auth(), ctrl.updateProfile);

// Profile - specific user (e.g., admin usage)
router.get('/:user_id', auth(), ctrl.getProfile);
router.put('/:user_id', auth(), ctrl.updateProfile);

// Notifications
router.get('/:user_id/notifications', auth(), ctrl.listNotifications);
router.put('/notifications/:id/read', auth(), ctrl.markNotificationRead);

module.exports = router;


