const db = require('../config/db');
const { getUserProgressForPlan, smartUpdateMobilePlanItems, smartUpdateManualPlanItems } = require('../utils/smartPlanUpdates');

// Helper function to create daily plans from training plan
exports.createDailyTrainingPlansFromPlan = async function createDailyTrainingPlansFromPlan(plan, items, user_id, gym_id) {
  try {
    const startDate = new Date(plan.start_date);
    const endDate = new Date(plan.end_date);
    
    // Use the same distribution logic as the portal
    const { createDistributedPlan } = require('../utils/exerciseDistribution');
    const distributedPlan = createDistributedPlan(
      { items },
      startDate,
      endDate
    );
    
    const dailyPlans = [];
    
    // Convert distributed daily plans to mobile format
    for (const dayPlan of distributedPlan.daily_plans) {
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
    const { user_id, start_date, end_date, exercise_plan_category, total_workouts, total_exercises, training_minutes, items = [] } = req.body;
    const gymId = req.user?.gym_id ?? null;

    if (!user_id || !start_date || !end_date || !exercise_plan_category) {
      return res.status(400).json({ success: false, message: 'user_id, start_date, end_date, and exercise_plan_category are required' });
    }

    // Insert plan
    const [plan] = await db('app_manual_training_plans')
      .insert({ user_id, gym_id: gymId, start_date, end_date, exercise_plan_category, total_workouts: total_workouts || 0, total_exercises: total_exercises || 0, training_minutes: training_minutes || 0 })
      .returning('*');

    // Insert items if provided
    let planItems = [];
    if (Array.isArray(items) && items.length) {
      const rows = items.map((it) => ({
        plan_id: plan.id,
        workout_name: it.workout_name,
        exercise_plan_category: it.exercise_plan_category || null,
        exercise_types: it.exercise_types || null,
        sets: it.sets || 0,
        reps: it.reps || 0,
        weight_kg: it.weight_kg || 0,
        minutes: it.minutes || 0,
        user_level: it.user_level || 'Beginner',
      }));
      planItems = await db('app_manual_training_plan_items').insert(rows).returning('*');
    }

    // Automatically create daily plans for easy mobile access
    try {
      await createDailyTrainingPlansFromPlan(plan, planItems, user_id, gymId);
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


