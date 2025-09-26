const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/TrainingApprovalController');
const auth = require('../middleware/authMiddleware');

// Web portal routes (gym admin access)
router.get('/', auth(), ctrl.list);
router.post('/', auth(), ctrl.create);
router.get('/:id', auth('gym_admin'), ctrl.get);
router.get('/:id/detailed', auth('gym_admin'), ctrl.getDetailed);
router.put('/:id', auth('gym_admin'), ctrl.update);
router.delete('/:id', auth('gym_admin'), ctrl.remove);
router.patch('/:id/status', auth('gym_admin'), ctrl.updateStatus);

// Mobile app routes (mobile user access)
router.post('/mobile/submit', auth('mobile_user'), ctrl.mobileSubmit);

module.exports = router;
