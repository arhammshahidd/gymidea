const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/TrainingPlanController');
const auth = require('../middleware/authMiddleware');

// All routes restricted to GYM_ADMIN for now. Adjust if trainers should access.
router.get('/', auth('gym_admin'), ctrl.list);
router.get('/my-assignments', auth('gym_admin'), ctrl.getMyAssignments); // New route for My Assign feature
router.post('/', auth('gym_admin'), ctrl.create);
router.get('/:id', auth('gym_admin'), ctrl.get);
router.put('/:id', auth('gym_admin'), ctrl.update);
router.delete('/:id', auth('gym_admin'), ctrl.remove);
router.patch('/:id/status', auth('gym_admin'), ctrl.updateStatus);

module.exports = router;


