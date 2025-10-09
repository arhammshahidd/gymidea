const express = require('express');
const router = express.Router();
const dailyPlansController = require('../controllers/DailyPlansController');
const auth = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(auth);

// Create daily training plans
router.post('/training', dailyPlansController.createDailyTrainingPlans);

// Create daily nutrition plans
router.post('/nutrition', dailyPlansController.createDailyNutritionPlans);

// Get user's daily plans for a date range
router.get('/user/:user_id', dailyPlansController.getUserDailyPlans);

// Get today's plans for a user
router.get('/today/:user_id', dailyPlansController.getTodaysPlans);

// Update daily plan completion status
router.patch('/completion', dailyPlansController.updateDailyPlanCompletion);

// Sync existing plans to daily plans
router.post('/sync', dailyPlansController.syncExistingPlansToDaily);

module.exports = router;
