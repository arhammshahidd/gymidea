const db = require('../config/db');
const { getUserProgressForPlan, smartUpdateMobilePlanItems, smartUpdateManualPlanItems } = require('../utils/smartPlanUpdates');

// Helper function to create daily plans from training plan
exports.createDailyTrainingPlansFromPlan = async function createDailyTrainingPlansFromPlan(plan, items, user_id, gym_id) {
  try {
    const startDate = new Date(plan.start_date);
    const endDate = new Date(plan.end_date);

    // Prefer explicit daily_plans saved on app_manual_training_plans over re-distribution
    let dailyPlansSource = null;
    try {
      // If caller passed daily_plans inline, use it; else load from DB by plan.id
      if (Array.isArray(plan.daily_plans)) {
        dailyPlansSource = plan.daily_plans;
      } else if (typeof plan.daily_plans === 'string') {
        try { dailyPlansSource = JSON.parse(plan.daily_plans); } catch (_) {}
      } else if (plan?.id) {
        const manualPlanRow = await db('app_manual_training_plans').where({ id: plan.id }).first();
        if (manualPlanRow?.daily_plans) {
          try { dailyPlansSource = JSON.parse(manualPlanRow.daily_plans); } catch (_) {}
        }
      }
    } catch (e) {}

    // Fallback to smart distribution if no saved daily_plans were found
    if (!Array.isArray(dailyPlansSource) || dailyPlansSource.length === 0) {
      const { createDistributedPlan } = require('../utils/exerciseDistribution');
      const distributedPlan = createDistributedPlan({ items }, startDate, endDate);
      dailyPlansSource = distributedPlan.daily_plans;
    }

    const dailyPlans = [];

    // Convert daily plans (from saved distribution or fallback) to mobile format
    for (const dayPlan of dailyPlansSource) {
      const dayItems = dayPlan.workouts || [];
      
      const totalSets = dayItems.reduce((sum, item) => sum + (item.sets || 0), 0);
      const totalReps = dayItems.reduce((sum, item) => sum + (item.reps || 0), 0);
      const totalWeight = dayItems.reduce((sum, item) => sum + (item.weight_kg || 0), 0);
      const totalMinutes = dayItems.reduce((sum, item) => sum + (item.training_minutes || item.minutes || 0), 0);
      
      dailyPlans.push({
        user_id,
        gym_id,
        plan_date: dayPlan.date,
        plan_type: 'manual',
        source_plan_id: plan.id,
        plan_category: plan.exercise_plan_category,
        workout_name: dayItems[0]?.workout_name || dayItems[0]?.name || 'Daily Workout',
        total_exercises: dayItems.length,
        training_minutes: totalMinutes,
        total_sets: totalSets,
        total_reps: totalReps,
        total_weight_kg: totalWeight,
        user_level: dayItems[0]?.user_level || 'Beginner',
        exercises_details: JSON.stringify(dayItems)
      });
    }
    
    // Insert daily plans
    const insertedPlans = await db('daily_training_plans').insert(dailyPlans).returning('*');
    
    // Insert plan items
    for (const dailyPlan of insertedPlans) {
      const exercises = JSON.parse(dailyPlan.exercises_details || '[]');
      if (exercises.length > 0) {
        const items = exercises.map(ex => ({
          daily_plan_id: dailyPlan.id,
          exercise_name: ex.workout_name || 'Exercise',
          sets: ex.sets || 0,
          reps: ex.reps || 0,
          weight_kg: ex.weight_kg || 0,
          weight_min_kg: ex.weight_min_kg ? Number(ex.weight_min_kg) : null,
          weight_max_kg: ex.weight_max_kg ? Number(ex.weight_max_kg) : null,
          minutes: ex.minutes || 0,
          exercise_type: ex.exercise_types || null,
          notes: null
        }));
        
        await db('daily_training_plan_items').insert(items);
      }
    }
    
    console.log(`Created ${insertedPlans.length} daily training plans for user ${user_id}`);
    return insertedPlans;
  } catch (error) {
    console.error('Error creating daily training plans:', error);
    return [];
  }
}

exports.createPlan = async (req, res) => {
  try {
    const { user_id: bodyUserId, start_date, end_date, exercise_plan_category, total_workouts, total_exercises, training_minutes, items = [], daily_plans } = req.body;
    const authedUserId = req.user?.id ?? null;
    const gymId = req.user?.gym_id ?? null;

    // Prefer the authenticated user's id when not provided or to avoid FK/gym mismatches
    const targetUserId = Number(bodyUserId || authedUserId);

    if (!targetUserId || !start_date || !end_date || !exercise_plan_category) {
      return res.status(400).json({ success: false, message: 'user_id, start_date, end_date, and exercise_plan_category are required' });
    }

    // Validate date order
    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ success: false, message: 'start_date must be on or before end_date' });
    }

    // Validate that target user exists (avoid FK violation 500s)
    try {
      const userRow = await db('users').where({ id: targetUserId }).first();
      if (!userRow) {
        return res.status(400).json({ success: false, message: `User ${targetUserId} does not exist` });
      }
    } catch (lookupErr) {
      // If users table lookup fails, surface a clear error
      return res.status(500).json({ success: false, message: 'User lookup failed' });
    }

    // Insert plan
    let plan;
    try {
      const inserted = await db('app_manual_training_plans')
        .insert({ user_id: targetUserId, gym_id: gymId, start_date, end_date, exercise_plan_category, total_workouts: total_workouts || 0, total_exercises: total_exercises || (Array.isArray(items) ? items.length : 0), training_minutes: training_minutes || 0, exercises_details: Array.isArray(items) ? JSON.stringify(items) : null, daily_plans: Array.isArray(daily_plans) ? JSON.stringify(daily_plans) : (typeof daily_plans === 'string' ? daily_plans : null) })
        .returning('*');
      plan = Array.isArray(inserted) ? inserted[0] : inserted;
    } catch (insertErr) {
      console.error('❌ Insert manual plan failed:', insertErr);
      // Common cause is FK violation on user_id
      return res.status(400).json({ success: false, message: 'Failed to create manual training plan (check user_id and dates)' });
    }

    // Insert items if provided
    let planItems = [];
    if (Array.isArray(items) && items.length) {
      const rows = items.map((it) => ({
        plan_id: plan.id,
        workout_name: it.workout_name || it.name || 'Exercise',
        exercise_plan_category: it.exercise_plan_category || null,
        exercise_types: it.exercise_types || null,
        sets: Number(it.sets || 0),
        reps: Number(it.reps || 0),
        weight_kg: Number(it.weight_kg || 0),
        minutes: Number(it.minutes || 0),
        user_level: it.user_level || 'Beginner',
      }));
      try {
        planItems = await db('app_manual_training_plan_items').insert(rows).returning('*');
      } catch (itemsErr) {
        console.error('❌ Insert manual plan items failed:', itemsErr);
        return res.status(400).json({ success: false, message: 'Failed to save exercises for manual plan (check workout fields)' });
      }
    }

    // Automatically create daily plans for easy mobile access
    try {
      await createDailyTrainingPlansFromPlan(plan, planItems, targetUserId, gymId);
    } catch (dailyPlanError) {
      console.error('Failed to create daily plans:', dailyPlanError);
      // Don't fail the main request if daily plans creation fails
    }

    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    console.error('Error creating app manual training plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to create manual training plan' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, exercise_plan_category, total_workouts, total_exercises, training_minutes, items } = req.body;

    const existing = await db('app_manual_training_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });

    const [updated] = await db('app_manual_training_plans')
      .where({ id })
      .update({ start_date, end_date, exercise_plan_category, total_workouts, total_exercises, training_minutes, updated_at: new Date() })
      .returning('*');

    if (Array.isArray(items)) {
      console.log(`📱 Smart updating Manual Training Plan ${id} with ${items.length} exercises`);
      
      // Get user's progress to determine which workouts are completed
      const userProgress = await getUserProgressForPlan(existing.user_id, id);
      const today = new Date().toISOString().split('T')[0];
      
      console.log(`📊 Manual Plan user progress: ${userProgress.completedDays} completed days, today: ${today}`);
      
      // Only update future workouts, preserve completed ones
      await smartUpdateManualPlanItems(id, items, userProgress, today);
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating app manual training plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to update manual training plan' });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('app_manual_training_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });
    // Delete daily mobile mirrors first to avoid orphaned mobile days
    try {
      const dailyPlans = await db('daily_training_plans')
        .where({ source_plan_id: id, plan_type: 'manual', user_id: existing.user_id, gym_id: existing.gym_id });
      const dailyPlanIds = dailyPlans.map(p => p.id);
      if (dailyPlanIds.length > 0) {
        await db('daily_training_plan_items').whereIn('daily_plan_id', dailyPlanIds).del();
        await db('daily_training_plans').whereIn('id', dailyPlanIds).del();
      }
    } catch (mirrorErr) {
      console.error('❌ Failed deleting daily mirrors for manual plan:', mirrorErr);
    }

    // Delete plan items then the plan
    await db('app_manual_training_plan_items').where({ plan_id: id }).del();
    await db('app_manual_training_plans').where({ id }).del();
    return res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    console.error('Error deleting app manual training plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete manual training plan' });
  }
};

exports.getPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    let query = db('app_manual_training_plans').where({ id });
    
    // SECURITY: Ensure proper user isolation
    if (requestingUserRole !== 'gym_admin' && requestingUserRole !== 'trainer') {
      // Regular users can only access their own plans
      query = query.andWhere({ user_id: requestingUserId, gym_id: req.user.gym_id });
    } else {
      // Admin/trainer can access any plan in their gym
      query = query.andWhere({ gym_id: req.user.gym_id });
    }
    
    const plan = await query.first();
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    
    const items = await db('app_manual_training_plan_items').where({ plan_id: id }).orderBy('id', 'asc');
    return res.json({ success: true, data: { ...plan, items } });
  } catch (err) {
    console.error('Error getting app manual training plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to get manual training plan' });
  }
};

exports.listPlans = async (req, res) => {
  try {
    const { user_id } = req.query;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    let qb = db('app_manual_training_plans')
      .select('*')
      .orderBy('created_at', 'desc');
    
    // SECURITY: Ensure proper user isolation
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      // Admin/trainer can see plans for specific users or all users in their gym
      if (user_id) {
        qb = qb.where({ user_id: Number(user_id), gym_id: req.user.gym_id });
      } else {
        qb = qb.where({ gym_id: req.user.gym_id });
      }
    } else {
      // Regular users can only see their own plans
      qb = qb.where({ user_id: requestingUserId, gym_id: req.user.gym_id });
    }
    
    const plans = await qb;
    return res.json({ success: true, data: plans });
  } catch (err) {
    console.error('Error listing app manual training plans:', err);
    return res.status(500).json({ success: false, message: 'Failed to list manual training plans' });
  }
};


