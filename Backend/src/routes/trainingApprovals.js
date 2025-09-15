const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/TrainingApprovalController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth('gym_admin'), ctrl.list);
router.post('/', auth('gym_admin'), ctrl.create);
router.get('/:id', auth('gym_admin'), ctrl.get);
router.put('/:id', auth('gym_admin'), ctrl.update);
router.delete('/:id', auth('gym_admin'), ctrl.remove);
router.patch('/:id/status', auth('gym_admin'), ctrl.updateStatus);

module.exports = router;


