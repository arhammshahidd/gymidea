const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/TrainingApprovalController');
const auth = require('../middleware/authMiddleware');

// Web portal routes (gym admin access)
router.get('/', auth(), ctrl.list);
router.post('/', auth(), ctrl.create);
router.get('/:id', auth(), ctrl.get);
router.get('/:id/detailed', auth(), ctrl.getDetailed);
router.put('/:id', auth(), ctrl.update);
router.delete('/:id', auth(), ctrl.remove);
router.patch('/:id/status', auth(), ctrl.updateStatus);

// Daily plans management routes
router.get('/:id/daily-plans', auth(), ctrl.getDailyPlans);
router.delete('/:id/daily-plans', auth(), ctrl.deleteDailyPlans);

// Mobile app routes (mobile user access)
router.post('/mobile/submit', auth('USER'), ctrl.mobileSubmit);

module.exports = router;


