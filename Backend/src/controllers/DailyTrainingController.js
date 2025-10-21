const db = require('../config/db');

// Get daily training plans for a user
exports.getDailyPlans = async (req, res, next) => {
  try {
    const { user_id, date, plan_type } = req.query;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    const gym_id = req.user.gym_id;

    let query = db('daily_training_plans')
      .select('*')
      .orderBy('plan_date', 'desc');

    // SECURITY: Ensure proper user isolation
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      // Admin/trainer can see plans for specific users or all users in their gym
      if (user_id) {
        query = query.where({ user_id: Number(user_id), gym_id: gym_id });
      } else {
        query = query.where({ gym_id: gym_id });
      }
    } else {
      // Regular users can only see their own plans
      query = query.where({ user_id: requestingUserId, gym_id: gym_id });
    }

    // Apply filters
    if (date) {
      query = query.andWhere('plan_date', date);
    }
    if (plan_type) {
      query = query.andWhere('plan_type', plan_type);
    }

    const plans = await query;

    // Get plan items for each plan
    for (let plan of plans) {
      const items = await db('daily_training_plan_items')
        .where({ daily_plan_id: plan.id })
        .orderBy('id', 'asc');
      plan.items = items;
    }

    res.json({ success: true, data: plans });
  } catch (err) {
    console.error('Error getting daily training plans:', err);
    next(err);
  }
};

// Get single daily training plan with items
exports.getDailyPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    const gym_id = req.user.gym_id;

    let query = db('daily_training_plans').where({ id });

    // SECURITY: Ensure proper user isolation
    if (requestingUserRole !== 'gym_admin' && requestingUserRole !== 'trainer') {
      query = query.andWhere({ user_id: requestingUserId, gym_id: gym_id });
    } else {
      query = query.andWhere({ gym_id: gym_id });
    }

    const plan = await query.first();
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Daily training plan not found' });
    }

    // Get plan items
    const items = await db('daily_training_plan_items')
      .where({ daily_plan_id: id })
      .orderBy('id', 'asc');

    res.json({ success: true, data: { ...plan, items } });
  } catch (err) {
    console.error('Error getting daily training plan:', err);
    next(err);
  }
};

// Submit daily training completion from mobile app
exports.submitDailyCompletion = async (req, res, next) => {
  try {
    const { daily_plan_id, completion_data } = req.body;
    const user_id = req.user.id;
    const gym_id = req.user.gym_id;

    // Validate required fields
    if (!daily_plan_id || !completion_data) {
      return res.status(400).json({
        success: false,
        message: 'daily_plan_id and completion_data are required'
      });
    }

    // Validate completion_data structure
    if (!Array.isArray(completion_data)) {
      return res.status(400).json({
        success: false,
        message: 'completion_data must be an array of exercise completions'
      });
    }

    // Find the daily training plan
    const dailyPlan = await db('daily_training_plans')
      .where({
        id: daily_plan_id,
        user_id: user_id,
        gym_id: gym_id
      })
      .first();

    if (!dailyPlan) {
      return res.status(404).json({
        success: false,
        message: 'Daily training plan not found'
      });
    }

    // Update each exercise item with completion data
    for (const exerciseCompletion of completion_data) {
      const { item_id, sets_completed, reps_completed, weight_used, minutes_spent, notes } = exerciseCompletion;

      if (!item_id) {
        return res.status(400).json({
          success: false,
          message: 'item_id is required for each exercise completion'
        });
      }

      // Update the exercise item
      await db('daily_training_plan_items')
        .where({
          id: item_id,
          daily_plan_id: daily_plan_id
        })
        .update({
          sets: sets_completed || 0,
          reps: reps_completed || 0,
          weight_kg: weight_used || 0,
          minutes: minutes_spent || 0,
          notes: notes || null,
          is_completed: true,
          updated_at: new Date()
        });
    }

    // Mark the daily plan as completed
    await db('daily_training_plans')
      .where({ id: daily_plan_id })
      .update({
        is_completed: true,
        completed_at: new Date(),
        updated_at: new Date()
      });

    // Get updated plan with items
    const updatedPlan = await db('daily_training_plans')
      .where({ id: daily_plan_id })
      .first();

    const updatedItems = await db('daily_training_plan_items')
      .where({ daily_plan_id: daily_plan_id })
      .orderBy('id', 'asc');

    // Emit realtime event for web portal
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`gym:${gym_id}`).emit('dailyTraining:completed', {
          daily_plan_id: daily_plan_id,
          user_id: user_id,
          plan_date: updatedPlan.plan_date,
          completion_data: completion_data,
          source: 'mobile_app'
        });
      }
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    res.status(200).json({
      success: true,
      message: 'Daily training completion submitted successfully',
      data: {
        daily_plan_id: daily_plan_id,
        plan_date: updatedPlan.plan_date,
        is_completed: true,
        completed_at: updatedPlan.completed_at,
        items: updatedItems
      }
    });

  } catch (err) {
    console.error('Error submitting daily training completion:', err);
    next(err);
  }
};

// Get user's training stats/summary
exports.getTrainingStats = async (req, res, next) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    const gym_id = req.user.gym_id;

    // Determine which user's stats to get
    let targetUserId = requestingUserId;
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      if (user_id) {
        targetUserId = Number(user_id);
      }
    }

    let query = db('daily_training_plans')
      .where({ user_id: targetUserId, gym_id: gym_id });

    // Apply date filters
    if (start_date) {
      query = query.andWhere('plan_date', '>=', start_date);
    }
    if (end_date) {
      query = query.andWhere('plan_date', '<=', end_date);
    }

    const plans = await query.orderBy('plan_date', 'desc');

    // Calculate stats
    const stats = {
      total_plans: plans.length,
      completed_plans: plans.filter(p => p.is_completed).length,
      total_training_minutes: plans.reduce((sum, p) => sum + (p.training_minutes || 0), 0),
      total_exercises: plans.reduce((sum, p) => sum + (p.total_exercises || 0), 0),
      total_sets: plans.reduce((sum, p) => sum + (p.total_sets || 0), 0),
      total_reps: plans.reduce((sum, p) => sum + (p.total_reps || 0), 0),
      total_weight_kg: plans.reduce((sum, p) => sum + (Number(p.total_weight_kg) || 0), 0),
      completion_rate: plans.length > 0 ? (plans.filter(p => p.is_completed).length / plans.length * 100).toFixed(2) : 0,
      plans_by_category: {},
      plans_by_date: {}
    };

    // Group by category
    plans.forEach(plan => {
      const category = plan.plan_category || 'Unknown';
      if (!stats.plans_by_category[category]) {
        stats.plans_by_category[category] = {
          total: 0,
          completed: 0,
          total_minutes: 0
        };
      }
      stats.plans_by_category[category].total++;
      if (plan.is_completed) {
        stats.plans_by_category[category].completed++;
      }
      stats.plans_by_category[category].total_minutes += plan.training_minutes || 0;
    });

    // Group by date
    plans.forEach(plan => {
      const date = plan.plan_date;
      if (!stats.plans_by_date[date]) {
        stats.plans_by_date[date] = {
          total: 0,
          completed: 0,
          total_minutes: 0
        };
      }
      stats.plans_by_date[date].total++;
      if (plan.is_completed) {
        stats.plans_by_date[date].completed++;
      }
      stats.plans_by_date[date].total_minutes += plan.training_minutes || 0;
    });

    res.json({
      success: true,
      data: {
        user_id: targetUserId,
        period: {
          start_date: start_date || null,
          end_date: end_date || null
        },
        stats: stats,
        recent_plans: plans.slice(0, 10) // Last 10 plans
      }
    });

  } catch (err) {
    console.error('Error getting training stats:', err);
    next(err);
  }
};

// Create daily training plan (for admin/trainer)
exports.createDailyPlan = async (req, res, next) => {
  try {
    const {
      user_id,
      plan_date,
      plan_type,
      source_plan_id,
      plan_category,
      workout_name,
      total_exercises,
      training_minutes,
      total_sets,
      total_reps,
      total_weight_kg,
      user_level,
      exercises_details,
      items
    } = req.body;

    const gym_id = req.user.gym_id;

    // Validate required fields
    if (!user_id || !plan_date || !plan_type || !plan_category) {
      return res.status(400).json({
        success: false,
        message: 'user_id, plan_date, plan_type, and plan_category are required'
      });
    }

    // Create the daily plan
    const [dailyPlan] = await db('daily_training_plans')
      .insert({
        user_id,
        gym_id,
        plan_date,
        plan_type,
        source_plan_id,
        plan_category,
        workout_name,
        total_exercises: total_exercises || 0,
        training_minutes: training_minutes || 0,
        total_sets: total_sets || 0,
        total_reps: total_reps || 0,
        total_weight_kg: total_weight_kg || 0,
        user_level: user_level || 'Beginner',
        exercises_details: exercises_details ? JSON.stringify(exercises_details) : null
      })
      .returning('*');

    // Create plan items if provided
    let planItems = [];
    if (Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map(item => ({
        daily_plan_id: dailyPlan.id,
        exercise_name: item.exercise_name,
        sets: item.sets || 0,
        reps: item.reps || 0,
        weight_kg: item.weight_kg || 0,
        minutes: item.minutes || 0,
        exercise_type: item.exercise_type || null,
        notes: item.notes || null
      }));

      planItems = await db('daily_training_plan_items')
        .insert(itemsToInsert)
        .returning('*');
    }

    res.status(201).json({
      success: true,
      data: { ...dailyPlan, items: planItems }
    });

  } catch (err) {
    console.error('Error creating daily training plan:', err);
    next(err);
  }
};
