const express = require('express');
const router = express.Router();
const controller = require('../controllers/superadmincontroller');
const auth = require('../middleware/auth');

// All routes here require SUPER_ADMIN

// Gym Management
router.get('/gyms', auth.requireSuperAdmin, controller.listGyms);
router.post('/gyms', auth.requireSuperAdmin, controller.createGym);
router.get('/gyms/:id', auth.requireSuperAdmin, controller.getGym);
router.patch('/gyms/:id', auth.requireSuperAdmin, controller.updateGym);
router.delete('/gyms/:id', auth.requireSuperAdmin, controller.deleteGym);

// Gym Admin Management
router.get('/gym-admins', auth.requireSuperAdmin, controller.listGymAdmins);
router.post('/gym-admins', auth.requireSuperAdmin, controller.createGymAdmin);
router.get('/gym-admins/:id', auth.requireSuperAdmin, controller.getGymAdmin);
router.patch('/gym-admins/:id', auth.requireSuperAdmin, controller.updateGymAdmin);
router.delete('/gym-admins/:id', auth.requireSuperAdmin, controller.deleteGymAdmin);
router.post('/gym-admins/:id/logout', auth.requireSuperAdmin, controller.logoutGymAdmin);
router.post('/gym-admins/:id/logout-users', auth.requireSuperAdmin, controller.logoutGymUsers);

module.exports = router;
