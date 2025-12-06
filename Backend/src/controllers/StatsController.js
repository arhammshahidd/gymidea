const db = require('../config/db');
const { getUserStats, updateUserStats } = require('../utils/statsCalculator');

// View stats: ongoing and completed workouts (Web Admin - legacy endpoint)
exports.view = async (req, res, next) => {
  try {
    const { user_id, from, to } = req.query;
    const base = db('training_plans').where({ gym_id: req.user.gym_id });
    if (user_id) base.andWhere('user_id', user_id);
    if (from) base.andWhere('start_date', '>=', from);
    if (to) base.andWhere('end_date', '<=', to);

    const rows = await base.select(
      'id',
      'category',
      'workout_name',
      'status',
      'start_date',
      'end_date',
      'training_minutes',
      'sets',
      'reps',
      'weight_kg'
    ).orderBy('created_at', 'desc');

    const ongoing = [];
    const completed = [];

    for (const r of rows) {
      if (r.status === 'ACTIVE' || r.status === 'PLANNED') {
        ongoing.push({
          id: r.id,
          category: r.category,
          workout_name: r.workout_name,
          status: r.status === 'ACTIVE' ? 'Ongoing' : 'Scheduled',
          start_date: r.start_date,
          end_date: r.end_date,
        });
      } else if (r.status === 'COMPLETED') {
        completed.push({
          id: r.id,
          category: r.category,
          workout_name: r.workout_name,
          date: r.end_date || r.start_date,
          duration_minutes: r.training_minutes,
          results: { sets: r.sets, reps: r.reps, weight_kg: r.weight_kg }
        });
      }
    }

    res.json({ success: true, data: { ongoing, completed } });
  } catch (err) { next(err); }
};

/**
 * Get user stats for mobile app
 * Calculated from daily_training_plans and daily_training_plan_items tables
 * GET /api/stats/mobile?planType=web_assigned|manual|ai_generated&refresh=true
 */
exports.getMobileStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { refresh, planType } = req.query;
    
    // If refresh=true, recalculate stats from daily_training_plans and daily_training_plan_items
    const shouldRefresh = refresh === 'true' || refresh === true;
    
    // IMPORTANT: Filter by planType to ensure manual and assigned plans don't interfere
    // If planType is not provided, default to 'web_assigned' for backward compatibility
    // (Most mobile users are on assigned plans, so this is the safest default)
    const normalizedPlanType = planType || 'web_assigned';
    
    console.log(`📊 getMobileStats - Request from user ${userId}:`, {
      planType: normalizedPlanType,
      refresh: shouldRefresh,
      queryParams: { refresh, planType },
      defaulted: !planType ? 'YES (defaulted to web_assigned)' : 'NO'
    });
    
    // First, check if there are any completed plans for this plan type
    const { calculateUserStats } = require('../utils/statsCalculator');
    const completedPlansCheck = await db('daily_training_plans')
      .where({ 
        user_id: userId, 
        is_completed: true, 
        is_stats_record: false 
      })
      .whereNotNull('completed_at')
      .whereIn('plan_type', normalizedPlanType === 'web_assigned' ? ['web_assigned', 'web_assigne'] : [normalizedPlanType])
      .count('* as count')
      .first();
    
    const completedCount = parseInt(completedPlansCheck?.count || 0);
    console.log(`📊 getMobileStats - Found ${completedCount} completed plans for planType: ${normalizedPlanType}`);
    
    if (completedCount === 0 && !shouldRefresh) {
      console.warn(`⚠️ getMobileStats - No completed plans found for planType ${normalizedPlanType}. Stats will be empty.`);
    }
    
    const stats = await getUserStats(userId, shouldRefresh, normalizedPlanType);
    
    if (!stats) {
      console.error(`❌ getMobileStats - No stats found for user ${userId} with planType: ${normalizedPlanType}`);
      
      // If no stats record exists, try to create one
      if (!shouldRefresh) {
        console.log(`📊 getMobileStats - Attempting to create stats record for planType: ${normalizedPlanType}`);
        const { updateUserStats } = require('../utils/statsCalculator');
        const newStats = await updateUserStats(userId);
        
        // Try to get the specific plan type's stats
        const retryStats = await getUserStats(userId, false, normalizedPlanType);
        if (retryStats) {
          console.log(`✅ getMobileStats - Successfully created and retrieved stats for planType: ${normalizedPlanType}`);
          return res.json({
            success: true,
            data: retryStats
          });
        }
      }
      
      return res.status(404).json({
        success: false,
        message: `Stats not found for this user with planType: ${normalizedPlanType}`
      });
    }
    
    // Log stats summary for debugging
    console.log(`✅ getMobileStats - Returning stats for user ${userId}:`, {
      planType: normalizedPlanType,
      daily_workouts_days: stats.daily_workouts ? Object.keys(stats.daily_workouts).length : 0,
      recent_workouts_count: stats.recent_workouts ? stats.recent_workouts.length : 0,
      weekly_completed: stats.weekly_progress ? stats.weekly_progress.completed : 0,
      weekly_total: stats.weekly_progress ? stats.weekly_progress.total_workouts : 0,
      monthly_completed: stats.monthly_progress ? stats.monthly_progress.completed : 0,
      monthly_total: stats.monthly_progress ? stats.monthly_progress.total_workouts : 0,
      total_workouts: stats.total_workouts || 0,
      longest_streak: stats.longest_streak || 0
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('Error getting mobile stats:', err);
    next(err);
  }
};

/**
 * Sync/update user stats for mobile app
 * Recalculates stats from daily_training_plans and daily_training_plan_items
 * POST /api/stats/mobile/sync
 * Body: { planType?: 'web_assigned'|'manual'|'ai_generated' }
 * 
 * IMPORTANT: If planType is provided, only syncs stats for that plan type
 * If planType is not provided, syncs stats for ALL plan types (default behavior)
 */
exports.syncMobileStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { planType } = req.body || {};
    
    // IMPORTANT: updateUserStats always updates ALL plan types
    // This ensures stats for web_assigned, manual, and ai_generated are all kept in sync
    // The frontend should fetch stats with planType parameter to get the correct one
    console.log(`📊 syncMobileStats - Syncing stats for user ${userId} (planType filter: ${planType || 'ALL'})`);
    
    // Recalculate and update stats from daily_training_plans and daily_training_plan_items
    // This updates stats for ALL plan types (web_assigned, manual, ai_generated)
    const stats = await updateUserStats(userId);
    
    // If planType is specified, return only that plan type's stats
    if (planType) {
      const { getUserStats } = require('../utils/statsCalculator');
      const filteredStats = await getUserStats(userId, false, planType);
      
      res.json({
        success: true,
        message: `Stats synced successfully for planType: ${planType}`,
        data: filteredStats
      });
    } else {
      // Return all stats (backward compatibility)
      res.json({
        success: true,
        message: 'Stats synced successfully for all plan types',
        data: stats
      });
    }
  } catch (err) {
    console.error('Error syncing mobile stats:', err);
    next(err);
  }
};


