const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/DailyTrainingController');
const auth = require('../middleware/authMiddleware');

// CRITICAL: Add comprehensive logging middleware to track ALL requests to this router
router.use((req, res, next) => {
  // Log ALL requests (GET and POST) to help debug completion issues
  console.log(`🔔 [dailyTraining router] ${req.method} ${req.path} at ${new Date().toISOString()}`);
  console.log(`🔔 [dailyTraining router] Full URL: ${req.url}`);
  console.log(`🔔 [dailyTraining router] Original URL: ${req.originalUrl}`);
  console.log(`🔔 [dailyTraining router] Base URL: ${req.baseUrl}`);
  if (req.method === 'POST') {
    console.log(`🔔 [dailyTraining router] POST Headers:`, {
      authorization: req.headers.authorization ? 'present' : 'missing',
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    });
    console.log(`🔔 [dailyTraining router] POST Body preview:`, req.body ? JSON.stringify(req.body).substring(0, 300) : 'no body');
  }
  next();
});

// CRITICAL: Completion endpoint - MUST be before other /mobile routes to avoid conflicts
// This endpoint is called when user completes a daily workout
// Expected URL: POST /api/dailyTraining/mobile/complete
// Expected payload: { daily_plan_id: number, completion_data: array }
router.post('/mobile/complete', (req, res, next) => {
  console.log(`🔔🔔🔔 ROUTE HIT: POST /mobile/complete at ${new Date().toISOString()}`);
  console.log(`🔔 ROUTE HIT: Request details:`, {
    method: req.method,
    url: req.url,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    has_body: !!req.body,
    body_keys: req.body ? Object.keys(req.body) : [],
    has_auth_header: !!req.headers.authorization,
    content_type: req.headers['content-type'],
    body_preview: req.body ? JSON.stringify(req.body).substring(0, 500) : 'no body'
  });
  next();
}, auth('USER'), ctrl.submitDailyCompletion);

// Test endpoint to verify route is accessible (for debugging)
router.get('/mobile/complete/test', (req, res) => {
  console.log(`✅ Test endpoint hit: GET /mobile/complete/test`);
  res.json({
    success: true,
    message: 'Completion endpoint is accessible',
    endpoint: 'POST /api/dailyTraining/mobile/complete',
    expected_payload: {
      daily_plan_id: 'number (required)',
      completion_data: 'array (required)'
    }
  });
});

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
router.get('/mobile/stats', auth('USER'), ctrl.getTrainingStats);

// Web portal routes (admin/trainer access)
router.get('/plans', auth(), ctrl.getDailyPlans);
router.get('/plans/:id', auth(), ctrl.getDailyPlan);
router.post('/plans', auth(), ctrl.createDailyPlan);
router.get('/stats', auth(), ctrl.getTrainingStats);

module.exports = router;
