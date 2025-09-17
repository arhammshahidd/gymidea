const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/TrainingPlanController');
const auth = require('../middleware/authMiddleware');

// Allow trainers to read; restrict mutations to GYM_ADMIN
router.get('/', auth(), ctrl.list);
router.get('/my-assignments', auth(), ctrl.getMyAssignments); // trainers can access their assignments
router.post('/', auth('gym_admin'), ctrl.create);
router.get('/:id', auth('gym_admin'), ctrl.get);
router.put('/:id', auth('gym_admin'), ctrl.update);
router.delete('/:id', auth('gym_admin'), ctrl.remove);
router.patch('/:id/status', auth('gym_admin'), ctrl.updateStatus);

module.exports = router;


