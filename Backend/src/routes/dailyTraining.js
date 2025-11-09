const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/DailyTrainingController');
const auth = require('../middleware/authMiddleware');

// Mobile app routes for daily training plans
// IMPORTANT: Specific routes must come before parameterized routes
router.get('/mobile/plans', auth('USER'), ctrl.getDailyPlans);
router.post('/mobile/plans/store', auth('USER'), ctrl.storeDailyPlansFromMobile);
router.post('/mobile/plans/create-from-approval', auth('USER'), ctrl.createDailyPlansFromTrainingApproval);
router.post('/mobile/plans/sync-from-assignment', auth('USER'), ctrl.syncDailyPlansFromAssignment); // Sync daily plans from assignment
router.post('/mobile/plans/sync-from-manual-plan', auth('USER'), ctrl.syncDailyPlansFromManualPlan); // Sync daily plans from manual plan
router.post('/mobile/plans/sync-from-ai-plan', auth('USER'), ctrl.syncDailyPlansFromAIPlan); // Sync daily plans from AI plan
router.get('/mobile/plans/find', auth('USER'), ctrl.findDailyPlanBySource); // Find daily plan by source and date
router.get('/mobile/plans/:id', auth('USER'), ctrl.getDailyPlan); // Must come after specific routes
router.post('/mobile/complete', auth('USER'), ctrl.submitDailyCompletion);
router.get('/mobile/stats', auth('USER'), ctrl.getTrainingStats);

// Web portal routes (admin/trainer access)
router.get('/plans', auth(), ctrl.getDailyPlans);
router.get('/plans/:id', auth(), ctrl.getDailyPlan);
router.post('/plans', auth(), ctrl.createDailyPlan);
router.get('/stats', auth(), ctrl.getTrainingStats);

module.exports = router;
