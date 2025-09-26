const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/TrainingPlanController');
const auth = require('../middleware/authMiddleware');

// Allow trainers to read; restrict mutations to GYM_ADMIN
router.get('/', auth(), ctrl.list);
router.get('/my-assignments', auth(), ctrl.getMyAssignments); // trainers can access their assignments
// Allow both gym_admin and trainer to create plans
router.post('/', auth(), ctrl.create);
// Allow both gym_admin and trainer to read a specific plan
router.get('/:id', auth(), ctrl.get);
// Allow both gym_admin and trainer to update plans
router.put('/:id', auth(), ctrl.update);
// Allow both gym_admin and trainer to delete or unassign plans
router.delete('/:id', auth(), ctrl.remove);
router.patch('/:id/status', auth('gym_admin'), ctrl.updateStatus);
// Allow trainers and gym admins to assign a plan to a user
router.patch('/:id/assign', auth(), ctrl.assign);

// Assignment routes
router.get('/assignments/my', auth(), ctrl.getMyAssignments);
router.get('/assignments/:id', auth(), ctrl.getAssignment);
router.put('/assignments/:id', auth(), ctrl.updateAssignment);
router.delete('/assignments/:id', auth(), ctrl.deleteAssignment);

// Mobile App Assignment routes
router.get('/assignments/user/:user_id', auth(), ctrl.getUserAssignments);
router.put('/assignments/:id/progress', auth(), ctrl.updateAssignmentProgress);

module.exports = router;


