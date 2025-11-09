const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/StatsController');
const auth = require('../middleware/authMiddleware');

// Web Admin routes (legacy)
router.get('/view', auth('gym_admin'), ctrl.view);

// Mobile App routes - Get stats calculated from daily_training_plans and daily_training_plan_items
// GET /api/stats/mobile?refresh=true (optional refresh parameter)
router.get('/mobile', auth(), ctrl.getMobileStats);

// Mobile App routes - Sync/update stats
// POST /api/stats/mobile/sync
router.post('/mobile/sync', auth(), ctrl.syncMobileStats);

module.exports = router;


