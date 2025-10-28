const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/DailyTrainingController');
const auth = require('../middleware/authMiddleware');

// Mobile app routes for daily training plans
router.get('/mobile/plans', auth('USER'), ctrl.getDailyPlans);
router.get('/mobile/plans/:id', auth('USER'), ctrl.getDailyPlan);
router.post('/mobile/complete', auth('USER'), ctrl.submitDailyCompletion);
router.get('/mobile/stats', auth('USER'), ctrl.getTrainingStats);

// Web portal routes (admin/trainer access)
router.get('/plans', auth(), ctrl.getDailyPlans);
router.get('/plans/:id', auth(), ctrl.getDailyPlan);
router.post('/plans', auth(), ctrl.createDailyPlan);
router.get('/stats', auth(), ctrl.getTrainingStats);

module.exports = router;
