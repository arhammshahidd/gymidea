const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/DailyTrainingController');
const auth = require('../middleware/authMiddleware');

// Mobile app routes for daily training plans
router.get('/mobile/plans', auth('mobile_user'), ctrl.getDailyPlans);
router.get('/mobile/plans/:id', auth('mobile_user'), ctrl.getDailyPlan);
router.post('/mobile/complete', auth('mobile_user'), ctrl.submitDailyCompletion);
router.get('/mobile/stats', auth('mobile_user'), ctrl.getTrainingStats);

// Web portal routes (admin/trainer access)
router.get('/plans', auth(), ctrl.getDailyPlans);
router.get('/plans/:id', auth(), ctrl.getDailyPlan);
router.post('/plans', auth(), ctrl.createDailyPlan);
router.get('/stats', auth(), ctrl.getTrainingStats);

module.exports = router;
