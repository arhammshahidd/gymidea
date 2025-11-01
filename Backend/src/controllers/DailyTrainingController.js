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
      .orderBy('plan_date', 'asc'); // Changed to 'asc' to show today first, then upcoming days

    // SECURITY: Ensure proper user isolation
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      // Admin/trainer can see plans for specific users or all users in their gym
      if (user_id) {
        query = query.where({ user_id: Number(user_id) });
      }
      if (gym_id != null) {
        query = query.andWhere({ gym_id: gym_id });
      }
    } else {
      // Regular users can only see their own plans; gym filter only when present
      query = query.where({ user_id: requestingUserId });
      if (gym_id != null) {
        query = query.andWhere({ gym_id: gym_id });
      }
    }

    // Apply filters
    // For mobile (USER role or /mobile/ route), we want to always show today's and future plans
    // immediately after completing the current day, even if client sends a specific date.
    // So we ignore strict date filtering in that case.
    const isMobileRequest = req.originalUrl?.includes('/mobile/') || requestingUserRole === 'USER';
    if (date && !isMobileRequest) {
      // If specific date is requested from non-mobile contexts, show plans for that date
      query = query.andWhere('plan_date', date);
    } else {
      // For mobile app: Filter out completed plans from previous days
      // Show: Today's plans (completed or not) + Future plans (completed or not)
      // Hide: Previous days' completed plans
      // Also show: Incomplete past plans (in case user missed a day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Query filter: Show plans that are:
      // 1. On or after today (today and future plans, regardless of completion)
      // 2. OR incomplete plans from past dates (in case user missed completing a past day)
      query = query.andWhere(function() {
        this.where('plan_date', '>=', todayStr)
          .orWhere(function() {
            this.where('plan_date', '<', todayStr)
              .andWhere('is_completed', false);
          });
      });
    }
    
    if (plan_type) {
      query = query.andWhere('plan_type', plan_type);
    }

    let plans = await query;

    // Additional filter: Remove completed plans from previous days
    // This ensures Day 1 completed workouts don't show when Day 2 is active
    if (!date || isMobileRequest) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      plans = plans.filter(plan => {
        const planDate = new Date(plan.plan_date);
        planDate.setHours(0, 0, 0, 0);
        const planDateStr = planDate.toISOString().split('T')[0];
        
        // Keep the plan if:
        // 1. It's today or in the future (regardless of completion status)
        // 2. OR it's not completed (in case of incomplete past plans)
        return planDateStr >= todayStr || !plan.is_completed;
      });
    }

    // Get plan items for each plan and normalize exercises_details to workouts array for clients
    for (let plan of plans) {
      const items = await db('daily_training_plan_items')
        .where({ daily_plan_id: plan.id })
        .orderBy('id', 'asc');
      plan.items = items;

      try {
        const raw = plan.exercises_details;
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed)) {
            plan.exercises_details = parsed; // keep as-is
          } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.workouts)) {
            plan.exercises_details = parsed.workouts; // return workouts as the details
            if (Array.isArray(parsed.snapshots)) {
              plan.completion_snapshots = parsed.snapshots;
            }
          }
        }
      } catch (e) {}
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
      query = query.andWhere({ user_id: requestingUserId });
      if (gym_id != null) {
        query = query.andWhere({ gym_id: gym_id });
      } else {
        query = query.whereNull('gym_id');
      }
    } else {
      if (gym_id != null) {
        query = query.andWhere({ gym_id: gym_id });
      }
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
    let query = db('daily_training_plans')
      .where({
        id: daily_plan_id,
        user_id: user_id
      });
    
    // Only filter by gym_id if it's not null
    if (gym_id != null) {
      query = query.andWhere({ gym_id: gym_id });
    } else {
      // If gym_id is null in token, allow plans with null gym_id
      query = query.whereNull('gym_id');
    }
    
    const dailyPlan = await query.first();

    if (!dailyPlan) {
      return res.status(404).json({
        success: false,
        message: 'Daily training plan not found'
      });
    }

    // Update each exercise item with completion data
    for (const exerciseCompletion of completion_data) {
      const { item_id, sets_completed, reps_completed, weight_used, minutes_spent, notes } = exerciseCompletion;

      console.log('📝 Processing exercise completion:', {
        item_id,
        item_id_type: typeof item_id,
        sets_completed,
        reps_completed,
        weight_used,
        minutes_spent
      });

      if (item_id === undefined || item_id === null) {
        console.error('❌ Missing item_id in completion data:', exerciseCompletion);
        return res.status(400).json({
          success: false,
          message: 'item_id is required for each exercise completion'
        });
      }

      // Check if the item exists first
      const existingItem = await db('daily_training_plan_items')
        .where({
          id: item_id,
          daily_plan_id: daily_plan_id
        })
        .first();

      if (!existingItem) {
        console.error('❌ Exercise item not found:', { item_id, daily_plan_id });
        return res.status(404).json({
          success: false,
          message: `Exercise item with id ${item_id} not found in daily plan ${daily_plan_id}`
        });
      }

      console.log('✅ Found exercise item:', existingItem);

      // Update the exercise item
      const updateResult = await db('daily_training_plan_items')
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

      console.log('✅ Updated exercise item, rows affected:', updateResult);
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

    // Snapshot completion without dropping existing exercises_details
    try {
      const current = await db('daily_training_plans')
        .select('exercises_details')
        .where({ id: daily_plan_id })
        .first();
      let payload;
      try {
        const parsed = current?.exercises_details ? JSON.parse(current.exercises_details) : null;
        if (Array.isArray(parsed)) {
          payload = { workouts: parsed, snapshots: [] };
        } else if (parsed && typeof parsed === 'object') {
          payload = parsed;
          if (!Array.isArray(payload.snapshots)) payload.snapshots = [];
        } else {
          payload = { workouts: [], snapshots: [] };
        }
      } catch (e) {
        payload = { workouts: [], snapshots: [] };
      }
      payload.snapshots.push({ completed_at: new Date(), items: updatedItems });
      await db('daily_training_plans')
        .where({ id: daily_plan_id })
        .update({ exercises_details: JSON.stringify(payload) });
    } catch (snapErr) {
      console.error('Failed to snapshot completion details:', snapErr);
    }

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
        weight_min_kg: item.weight_min_kg || null,
        weight_max_kg: item.weight_max_kg || null,
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

// Store multiple daily plans and their items from mobile payload
exports.storeDailyPlansFromMobile = async (req, res, next) => {
  try {
    const {
      plan_type = 'manual',
      user_id,
      source_plan_id,
      daily_plans = []
    } = req.body || {};

    const gym_id = req.user.gym_id ?? null;
    const targetUserId = Number(user_id || req.user.id);

    if (!targetUserId || !Array.isArray(daily_plans) || daily_plans.length === 0) {
      return res.status(400).json({ success: false, message: 'user_id and daily_plans are required' });
    }

    const created = [];
    for (const day of daily_plans) {
      const {
        plan_date,
        workout_name,
        training_minutes = 0,
        total_exercises = 0,
        total_sets = 0,
        total_reps = 0,
        total_weight_kg = 0,
        user_level = 'Beginner',
        plan_category = null,
        exercises_details = []
      } = day;

      // Validate exercises_details
      if (!Array.isArray(exercises_details)) {
        return res.status(400).json({ success: false, message: `exercises_details must be an array for date ${plan_date}` });
      }

      // Compute derived totals from array to avoid client/server mismatch
      const derived = {
        total_exercises: exercises_details.length,
        training_minutes: exercises_details.reduce((s, it) => s + Number(it.training_minutes || it.minutes || 0), 0),
        total_sets: exercises_details.reduce((s, it) => s + Number(it.sets || 0), 0),
        total_reps: exercises_details.reduce((s, it) => s + Number(it.reps || 0), 0),
        total_weight_kg: exercises_details.reduce((s, it) => s + Number(it.weight_kg || 0), 0)
      };

      // Upsert daily plan by unique keys (user_id, plan_type, source_plan_id, plan_date, gym_id)
      const existing = await db('daily_training_plans')
        .where({ user_id: targetUserId, plan_type, source_plan_id: source_plan_id || null, plan_date })
        .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
        .first();

      let dailyPlan;
      if (existing) {
        const [updated] = await db('daily_training_plans')
          .where({ id: existing.id })
          .update({
            gym_id,
            plan_category,
            workout_name,
            user_level,
            exercises_details: JSON.stringify(exercises_details),
            ...derived,
            updated_at: new Date()
          })
          .returning('*');
        // Replace items
        await db('daily_training_plan_items').where({ daily_plan_id: existing.id }).del();
        if (exercises_details.length) {
          const itemsRows = exercises_details.map((it) => ({
            daily_plan_id: existing.id,
            exercise_name: it.exercise_name || it.workout_name || it.name || 'Exercise',
            sets: Number(it.sets || 0),
            reps: Number(it.reps || 0),
            weight_kg: Number(it.weight_kg || 0),
            weight_min_kg: it.weight_min_kg ? Number(it.weight_min_kg) : null,
            weight_max_kg: it.weight_max_kg ? Number(it.weight_max_kg) : null,
            minutes: Number(it.minutes || it.training_minutes || 0),
            exercise_type: it.exercise_type || it.exercise_types || null,
            notes: it.notes || null
          }));
          await db('daily_training_plan_items').insert(itemsRows);
        }
        dailyPlan = updated;
      } else {
        const [inserted] = await db('daily_training_plans')
          .insert({
            user_id: targetUserId,
            gym_id,
            plan_date,
            plan_type,
            source_plan_id: source_plan_id || null,
            plan_category,
            workout_name,
            user_level,
            exercises_details: JSON.stringify(exercises_details),
            ...derived
          })
          .returning('*');
        if (exercises_details.length) {
          const itemsRows = exercises_details.map((it) => ({
            daily_plan_id: inserted.id,
            exercise_name: it.exercise_name || it.workout_name || it.name || 'Exercise',
            sets: Number(it.sets || 0),
            reps: Number(it.reps || 0),
            weight_kg: Number(it.weight_kg || 0),
            weight_min_kg: it.weight_min_kg ? Number(it.weight_min_kg) : null,
            weight_max_kg: it.weight_max_kg ? Number(it.weight_max_kg) : null,
            minutes: Number(it.minutes || it.training_minutes || 0),
            exercise_type: it.exercise_type || it.exercise_types || null,
            notes: it.notes || null
          }));
          await db('daily_training_plan_items').insert(itemsRows);
        }
        dailyPlan = inserted;
      }

      created.push(dailyPlan);
    }

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Error storing daily plans from mobile:', err);
    next(err);
  }
};
