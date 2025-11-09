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
      .where('is_stats_record', false) // CRITICAL: Always exclude stats records at SQL level
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
      // Regular users can only see their own plans
      // Don't filter by gym_id for mobile users - they should see their plans regardless of gym
      // This allows plans created from training approvals to be visible
      // IMPORTANT: Always exclude stats records at SQL level to prevent interference
      query = query.where({ 
        user_id: requestingUserId,
        is_stats_record: false 
      });
      
      // IMPORTANT: If plan_type is not specified, default to web_assigned for assigned plans
      // This prevents manual plan data from interfering with assigned plans
      // However, if plan_type is explicitly provided, use it (for manual/AI plans)
      if (!plan_type) {
        // Default to web_assigned to prevent manual plan interference
        // Frontend should explicitly pass plan_type=manual or plan_type=ai_generated if needed
        query = query.whereIn('plan_type', ['web_assigned', 'web_assigne']);
        console.log(`📊 getDailyPlans - No plan_type specified, defaulting to web_assigned to prevent manual plan interference`);
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
      
      console.log(`📊 getDailyPlans - SQL Query: user_id=${requestingUserId}, today=${todayStr}, isMobileRequest=${isMobileRequest}`);
      
      // Query filter: Show plans that are:
      // 1. On or after today (today and future plans, regardless of completion)
      // 2. OR incomplete plans from past dates (in case user missed completing a past day)
      // Note: plan_date is a DATE column, so direct string comparison should work
      query = query.andWhere(function() {
        this.where('plan_date', '>=', todayStr)
          .orWhere(function() {
            this.where('plan_date', '<', todayStr)
              .andWhere('is_completed', false);
          });
      });
    }
    
    // Apply plan_type filter (if not already applied above for regular users)
    if (plan_type && (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer')) {
      // For admin/trainer, apply plan_type filter if provided
      if (plan_type === 'web_assigned') {
        query = query.whereIn('plan_type', ['web_assigned', 'web_assigne']);
      } else {
        query = query.andWhere('plan_type', plan_type);
      }
    } else if (plan_type && requestingUserRole !== 'gym_admin' && requestingUserRole !== 'trainer') {
      // For regular users, if plan_type is explicitly provided, use it (overrides default)
      if (plan_type === 'web_assigned') {
        query = query.whereIn('plan_type', ['web_assigned', 'web_assigne']);
      } else {
        query = query.andWhere('plan_type', plan_type);
      }
      console.log(`📊 getDailyPlans - Explicit plan_type filter applied: ${plan_type}`);
    }

    let plans = await query;

    // Log all plans returned from SQL query
    console.log(`📊 getDailyPlans - SQL query returned ${plans.length} plans`);
    plans.forEach(plan => {
      console.log(`  - Plan ${plan.id}: plan_date=${plan.plan_date} (type: ${typeof plan.plan_date}), is_completed=${plan.is_completed}, is_stats_record=${plan.is_stats_record}`);
    });

    // Additional filter: Remove completed plans from previous days
    // This ensures Day 1 completed workouts don't show when Day 2 is active
    // BUT: Always show today's completed plans
    if (!date || isMobileRequest) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Add debug logging
      console.log(`📊 getDailyPlans - Filtering ${plans.length} plans, today=${todayStr}`);
      
      // IMPORTANT: Find the first incomplete plan (or today's plan if it exists)
      // This ensures we start from the correct day after reload
      // Logic: Find the first incomplete day, or if all are completed, start from today
      let firstIncompleteDate = todayStr; // Default to today
      const sortedPlans = [...plans].filter(p => p.plan_date != null).sort((a, b) => {
        let dateA, dateB;
        if (a.plan_date instanceof Date) {
          dateA = a.plan_date.toISOString().split('T')[0];
        } else if (typeof a.plan_date === 'string') {
          dateA = a.plan_date.split('T')[0];
        } else {
          dateA = '';
        }
        
        if (b.plan_date instanceof Date) {
          dateB = b.plan_date.toISOString().split('T')[0];
        } else if (typeof b.plan_date === 'string') {
          dateB = b.plan_date.split('T')[0];
        } else {
          dateB = '';
        }
        
        return dateA.localeCompare(dateB);
      });
      
      // First, check if there's today's plan - always start from today if it exists
      const todayPlan = sortedPlans.find(plan => {
        let planDateStr;
        if (plan.plan_date instanceof Date) {
          planDateStr = plan.plan_date.toISOString().split('T')[0];
        } else if (typeof plan.plan_date === 'string') {
          planDateStr = plan.plan_date.split('T')[0];
        } else {
          return false;
        }
        return planDateStr === todayStr;
      });
      
      if (todayPlan) {
        firstIncompleteDate = todayStr;
        console.log(`📅 Found today's plan: ${todayStr}, will start from here`);
      } else {
        // Find the first incomplete plan (before today or in the future)
        for (const plan of sortedPlans) {
          let planDateStr;
          if (plan.plan_date instanceof Date) {
            planDateStr = plan.plan_date.toISOString().split('T')[0];
          } else if (typeof plan.plan_date === 'string') {
            planDateStr = plan.plan_date.split('T')[0];
          } else {
            continue;
          }
          
          // If this is an incomplete plan, start from here
          if (!plan.is_completed) {
            firstIncompleteDate = planDateStr;
            console.log(`📅 Found first incomplete plan: ${planDateStr}, will start from here`);
            break;
          }
        }
        
        // If all plans are completed, start from today
        if (firstIncompleteDate === todayStr && sortedPlans.length > 0) {
          console.log(`📅 All plans are completed, using today as starting point: ${firstIncompleteDate}`);
        }
      }
      
      plans = plans.filter(plan => {
        // CRITICAL: Skip stats records (double-check even though SQL should filter them)
        if (plan.is_stats_record) {
          console.log(`  ⏭️ Skipping stats record: plan_id=${plan.id}, plan_type=${plan.plan_type}`);
          return false;
        }
        
        // CRITICAL: Skip plans with null plan_date (stats records often have null plan_date)
        if (!plan.plan_date || plan.plan_date === null) {
          console.log(`  ⏭️ Skipping plan with null plan_date: plan_id=${plan.id}, plan_type=${plan.plan_type}, is_stats_record=${plan.is_stats_record}`);
          return false;
        }
        
        // CRITICAL: Ensure plan_type matches (prevent manual plan interference with assigned plans)
        // If we defaulted to web_assigned above, only return web_assigned plans
        if (!plan_type && plan.plan_type !== 'web_assigned' && plan.plan_type !== 'web_assigne') {
          console.log(`  ⏭️ Skipping non-assigned plan (defaulting to web_assigned): plan_id=${plan.id}, plan_type=${plan.plan_type}`);
          return false;
        }
        
        // Handle plan_date - it might be a Date object or string
        let planDate;
        if (plan.plan_date instanceof Date) {
          planDate = new Date(plan.plan_date);
        } else if (typeof plan.plan_date === 'string') {
          // Parse date string (YYYY-MM-DD format)
          // Handle both YYYY-MM-DD and other formats
          if (plan.plan_date.includes('T')) {
            planDate = new Date(plan.plan_date);
          } else {
            // For YYYY-MM-DD format, parse in UTC to avoid timezone issues
            planDate = new Date(plan.plan_date + 'T00:00:00.000Z');
          }
        } else if (plan.plan_date === null || plan.plan_date === undefined) {
          // If plan_date is null or invalid, skip this plan
          console.warn(`⚠️ Invalid plan_date for plan: plan_id=${plan.id}, plan_date=${plan.plan_date}`);
          return false;
        } else {
          console.warn(`⚠️ Unexpected plan_date type for plan: plan_id=${plan.id}, plan_date=${plan.plan_date}, type=${typeof plan.plan_date}`);
          return false;
        }
        
        planDate.setHours(0, 0, 0, 0);
        const planDateStr = planDate.toISOString().split('T')[0];
        
        // IMPORTANT: Only keep plans starting from the first incomplete day (or today)
        // This ensures that after reload, Day 2 shows instead of Day 1 if Day 1 is completed
        // Keep the plan if:
        // 1. It's on or after the first incomplete date (or today if no incomplete plan found)
        // 2. AND it's not a completed plan from before today (unless it's today itself)
        const isOnOrAfterStartDate = planDateStr >= firstIncompleteDate;
        const isToday = planDateStr === todayStr;
        const isCompletedPastDay = plan.is_completed && planDateStr < todayStr;
        
        const shouldKeep = isOnOrAfterStartDate && !isCompletedPastDay;
        
        if (!shouldKeep && plan.is_completed) {
          console.log(`📋 Filtered out completed past plan: plan_id=${plan.id}, plan_date=${plan.plan_date}, plan_date_str=${planDateStr}, today=${todayStr}, is_completed=${plan.is_completed}`);
        } else if (plan.is_completed) {
          console.log(`✅ Keeping completed plan: plan_id=${plan.id}, plan_date=${plan.plan_date}, plan_date_str=${planDateStr}, today=${todayStr}`);
        } else {
          console.log(`✅ Keeping incomplete plan: plan_id=${plan.id}, plan_date=${plan.plan_date}, plan_date_str=${planDateStr}, today=${todayStr}`);
        }
        
        return shouldKeep;
      });
      
      console.log(`📊 getDailyPlans - After filtering: ${plans.length} plans remaining`);
      plans.forEach(plan => {
        console.log(`  ✅ Final plan: plan_id=${plan.id}, plan_date=${plan.plan_date}, is_completed=${plan.is_completed}`);
      });
    }

    // Get plan items from exercises_details JSON for each plan
    for (let plan of plans) {
      // Parse items from exercises_details JSON
      let items = [];
      try {
        const details = plan.exercises_details;
        if (details) {
          const parsed = typeof details === 'string' ? JSON.parse(details) : details;
          if (Array.isArray(parsed)) {
            items = parsed;
          } else if (parsed && typeof parsed === 'object') {
            // Handle different object structures
            if (Array.isArray(parsed.workouts)) {
              items = parsed.workouts;
            } else if (Array.isArray(parsed.exercises)) {
              items = parsed.exercises;
            } else if (Array.isArray(parsed.items)) {
              items = parsed.items;
            }
          }
        }
      } catch (e) {
        console.error('Error parsing exercises_details for items:', e);
        items = [];
      }
      plan.items = items;

      try {
        const raw = plan.exercises_details;
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed)) {
            plan.exercises_details = parsed; // keep as-is
          } else if (parsed && typeof parsed === 'object') {
            // Handle different object structures
            if (Array.isArray(parsed.workouts)) {
              plan.exercises_details = parsed.workouts; // return workouts as the details
              if (Array.isArray(parsed.snapshots)) {
                plan.completion_snapshots = parsed.snapshots;
              }
            } else if (Array.isArray(parsed.exercises)) {
              plan.exercises_details = parsed.exercises;
            } else if (Array.isArray(parsed.items)) {
              plan.exercises_details = parsed.items;
            }
          }
        }
      } catch (e) {
        console.error('Error parsing exercises_details for response:', e);
      }
      
      // Explicitly include daily_plan_id for mobile app compatibility
      plan.daily_plan_id = plan.id;
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

    // Get plan items from exercises_details JSON
    let items = [];
    try {
      const details = plan.exercises_details;
      if (details) {
        const parsed = typeof details === 'string' ? JSON.parse(details) : details;
        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.workouts)) {
          items = parsed.workouts;
        }
      }
    } catch (e) {
      items = [];
    }

    res.json({ 
      success: true, 
      data: { 
        ...plan, 
        items,
        // Explicitly include daily_plan_id for mobile app compatibility
        daily_plan_id: plan.id,
        id: plan.id
      } 
    });
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
    // For mobile users, we only check user_id match (not gym_id)
    // This allows users to complete their plans regardless of gym assignment
    const dailyPlan = await db('daily_training_plans')
      .where({
        id: daily_plan_id,
        user_id: user_id,
        is_stats_record: false // Exclude stats records
      })
      .first();

    if (!dailyPlan) {
      // Log for debugging
      console.error('❌ Daily plan not found:', {
        daily_plan_id,
        user_id,
        gym_id
      });
      
      // Try to find the plan without user_id filter to see if it exists
      const planExists = await db('daily_training_plans')
        .where({ id: daily_plan_id })
        .first();
      
      if (planExists) {
        console.error('Plan exists but filters failed:', {
          plan_user_id: planExists.user_id,
          plan_gym_id: planExists.gym_id,
          plan_is_stats_record: planExists.is_stats_record,
          request_user_id: user_id,
          request_gym_id: gym_id
        });
      }
      
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

      // Items are now stored in exercises_details JSON column
      // Update the item in exercises_details array
      // Use the dailyPlan we already fetched to avoid duplicate query

      // Parse exercises_details JSON
      let exercisesDetails = [];
      try {
        if (dailyPlan.exercises_details) {
          // Check if it's already parsed (object) or needs parsing (string)
          const parsed = typeof dailyPlan.exercises_details === 'string' 
            ? JSON.parse(dailyPlan.exercises_details) 
            : dailyPlan.exercises_details;
          
          // Handle different structures: array, { workouts: [...], snapshots: [...] }, or other objects
          if (Array.isArray(parsed)) {
            exercisesDetails = parsed;
          } else if (parsed && typeof parsed === 'object') {
            // If it's an object with workouts array (from previous completion), use that
            if (Array.isArray(parsed.workouts)) {
              exercisesDetails = parsed.workouts;
            } else if (Array.isArray(parsed.exercises)) {
              exercisesDetails = parsed.exercises;
            } else if (Array.isArray(parsed.items)) {
              exercisesDetails = parsed.items;
            } else {
              // If it's an object but not in expected format, log warning
              console.warn('⚠️ exercises_details is an object but not in expected format:', Object.keys(parsed));
              exercisesDetails = [];
            }
          } else {
            exercisesDetails = [];
          }
        } else {
          exercisesDetails = [];
        }
      } catch (e) {
        console.error('❌ Error parsing exercises_details:', e);
        exercisesDetails = [];
      }

      // Ensure exercisesDetails is an array before proceeding
      if (!Array.isArray(exercisesDetails)) {
        console.error('❌ exercises_details is not an array:', typeof exercisesDetails, exercisesDetails);
        return res.status(400).json({
          success: false,
          message: `Invalid exercises_details format. Expected array, got ${typeof exercisesDetails}`
        });
      }

      // Handle item_id - can be index (0-based) or actual id
      let itemIndex = -1;
      
      if (item_id === undefined || item_id === null) {
        console.error('❌ Missing item_id in completion data:', exerciseCompletion);
        return res.status(400).json({
          success: false,
          message: 'item_id is required for each exercise completion. Use array index (0, 1, 2...) or item id.'
        });
      }

      // Try to find by actual id first
      if (item_id !== 0 || exercisesDetails.length > 0) {
        itemIndex = exercisesDetails.findIndex(item => 
          item && (
            item.id === item_id || 
            item.item_id === item_id ||
            item.id === exerciseCompletion['id'] ||
            item.item_id === exerciseCompletion['id']
          )
        );
      }
      
      // If not found by id, try using item_id as array index (0-based)
      if (itemIndex === -1 && typeof item_id === 'number' && item_id >= 0 && item_id < exercisesDetails.length) {
        itemIndex = item_id;
        console.log('📝 Using item_id as array index:', item_id);
      }
      
      // If still not found, try finding by exercise name or other fields
      if (itemIndex === -1 && exerciseCompletion['exercise_name']) {
        itemIndex = exercisesDetails.findIndex(item => 
          item && (
            item.exercise_name === exerciseCompletion['exercise_name'] ||
            item.name === exerciseCompletion['exercise_name'] ||
            item.workout_name === exerciseCompletion['exercise_name']
          )
        );
      }

      if (itemIndex === -1) {
        console.error('❌ Exercise item not found in exercises_details:', { 
          item_id, 
          daily_plan_id,
          exercises_details_count: exercisesDetails.length,
          available_ids: exercisesDetails.map((item, idx) => ({
            index: idx,
            id: item.id,
            item_id: item.item_id,
            exercise_name: item.exercise_name || item.name
          }))
        });
        return res.status(404).json({
          success: false,
          message: `Exercise item with id/index ${item_id} not found in daily plan ${daily_plan_id}. Available items: ${exercisesDetails.length}`
        });
      }

      // Update the item
      exercisesDetails[itemIndex] = {
        ...exercisesDetails[itemIndex],
        sets: sets_completed || exercisesDetails[itemIndex].sets || 0,
        reps: reps_completed || exercisesDetails[itemIndex].reps || 0,
        weight_kg: weight_used || exercisesDetails[itemIndex].weight_kg || 0,
        minutes: minutes_spent || exercisesDetails[itemIndex].minutes || 0,
        notes: notes || exercisesDetails[itemIndex].notes || null,
        is_completed: true,
        completed_at: new Date().toISOString()
      };

      // Update the plan's exercises_details
      await db('daily_training_plans')
        .where({ id: daily_plan_id })
        .update({
          exercises_details: JSON.stringify(exercisesDetails),
          updated_at: new Date()
        });

      console.log('✅ Updated exercise item in exercises_details');
    }

    // Mark the daily plan as completed
    // IMPORTANT: Log the plan details before update to verify plan_type
    console.log(`📝 Marking daily plan ${daily_plan_id} as completed:`, {
      plan_id: daily_plan_id,
      plan_type: dailyPlan.plan_type,
      plan_date: dailyPlan.plan_date,
      user_id: user_id,
      current_is_completed: dailyPlan.is_completed,
      current_completed_at: dailyPlan.completed_at
    });

    // CRITICAL: Use a transaction to ensure atomic update
    const trx = await db.transaction();
    try {
      const updateResult = await trx('daily_training_plans')
        .where({ id: daily_plan_id })
        .update({
          is_completed: true,
          completed_at: new Date(),
          updated_at: new Date()
        });

      console.log(`✅ Updated ${updateResult} row(s) - Set is_completed=true and completed_at for plan ${daily_plan_id}`);

      if (updateResult === 0) {
        console.error(`❌ CRITICAL: No rows updated for plan ${daily_plan_id}! Plan may not exist or query failed.`);
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: `Daily plan ${daily_plan_id} not found or could not be updated`
        });
      }

      // Verify the update immediately within the transaction
      const verifyInTransaction = await trx('daily_training_plans')
        .select('id', 'is_completed', 'completed_at', 'plan_type', 'plan_date')
        .where({ id: daily_plan_id })
        .first();

      if (!verifyInTransaction || !verifyInTransaction.is_completed || !verifyInTransaction.completed_at) {
        console.error(`❌ CRITICAL: Update verification failed within transaction!`, {
          found: !!verifyInTransaction,
          is_completed: verifyInTransaction?.is_completed,
          completed_at: verifyInTransaction?.completed_at
        });
        await trx.rollback();
        return res.status(500).json({
          success: false,
          message: 'Failed to verify completion status update'
        });
      }

      console.log(`✅ Verified update within transaction:`, {
        is_completed: verifyInTransaction.is_completed,
        completed_at: verifyInTransaction.completed_at,
        plan_type: verifyInTransaction.plan_type
      });

      await trx.commit();
    } catch (updateErr) {
      console.error(`❌ CRITICAL: Error updating completion status:`, updateErr);
      await trx.rollback();
      return res.status(500).json({
        success: false,
        message: 'Failed to update completion status',
        error: updateErr.message
      });
    }

    // Get updated plan with items
    const updatedPlan = await db('daily_training_plans')
      .where({ id: daily_plan_id })
      .first();

    // IMPORTANT: Verify the update was successful
    if (!updatedPlan) {
      console.error(`❌ CRITICAL: Updated plan ${daily_plan_id} not found after update!`);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve updated plan'
      });
    }

    // Verify completion status
    if (!updatedPlan.is_completed || !updatedPlan.completed_at) {
      console.error(`❌ CRITICAL: Plan ${daily_plan_id} update failed!`, {
        is_completed: updatedPlan.is_completed,
        completed_at: updatedPlan.completed_at,
        plan_type: updatedPlan.plan_type
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to mark plan as completed'
      });
    }

    console.log(`✅ Verified completion status for plan ${daily_plan_id}:`, {
      is_completed: updatedPlan.is_completed,
      completed_at: updatedPlan.completed_at,
      plan_type: updatedPlan.plan_type,
      plan_date: updatedPlan.plan_date
    });

    // Parse exercises_details as items (handle both array and object formats)
    let updatedItems = [];
    try {
      if (updatedPlan.exercises_details) {
        const parsed = typeof updatedPlan.exercises_details === 'string' 
          ? JSON.parse(updatedPlan.exercises_details) 
          : updatedPlan.exercises_details;
        
        // Handle different structures
        if (Array.isArray(parsed)) {
          updatedItems = parsed;
        } else if (parsed && typeof parsed === 'object') {
          // If it's an object with workouts array, use that
          if (Array.isArray(parsed.workouts)) {
            updatedItems = parsed.workouts;
          } else if (Array.isArray(parsed.exercises)) {
            updatedItems = parsed.exercises;
          } else if (Array.isArray(parsed.items)) {
            updatedItems = parsed.items;
          }
        }
      }
    } catch (e) {
      console.error('❌ Error parsing updated exercises_details:', e);
      updatedItems = [];
    }

    // Snapshot completion without dropping existing exercises_details
    // IMPORTANT: This update should NOT affect is_completed or completed_at
    try {
      const current = await db('daily_training_plans')
        .select('exercises_details', 'is_completed', 'completed_at')
        .where({ id: daily_plan_id })
        .first();
      
      // Verify completion status is still set before snapshot update
      if (!current || !current.is_completed || !current.completed_at) {
        console.error(`❌ CRITICAL: Completion status lost before snapshot update!`, {
          daily_plan_id,
          is_completed: current?.is_completed,
          completed_at: current?.completed_at
        });
      }
      
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
      
      // IMPORTANT: Only update exercises_details, preserve is_completed and completed_at
      // This ensures the snapshot update doesn't accidentally reset completion status
      await db('daily_training_plans')
        .where({ id: daily_plan_id })
        .update({ 
          exercises_details: JSON.stringify(payload),
          // Explicitly preserve completion status (don't set them, just don't touch them)
        });
      
      // Verify completion status is still set after snapshot update
      const afterSnapshot = await db('daily_training_plans')
        .select('is_completed', 'completed_at', 'plan_type', 'plan_date')
        .where({ id: daily_plan_id })
        .first();
      
      if (!afterSnapshot || !afterSnapshot.is_completed || !afterSnapshot.completed_at) {
        console.error(`❌ CRITICAL: Completion status lost after snapshot update!`, {
          daily_plan_id,
          is_completed: afterSnapshot?.is_completed,
          completed_at: afterSnapshot?.completed_at,
          plan_type: afterSnapshot?.plan_type
        });
        // Re-set completion status if it was lost
        await db('daily_training_plans')
          .where({ id: daily_plan_id })
          .update({
            is_completed: true,
            completed_at: new Date()
          });
        console.log(`✅ Re-set completion status for plan ${daily_plan_id} after snapshot update`);
      } else {
        console.log(`✅ Completion status preserved after snapshot update for plan ${daily_plan_id}:`, {
          is_completed: afterSnapshot.is_completed,
          completed_at: afterSnapshot.completed_at,
          plan_type: afterSnapshot.plan_type,
          plan_date: afterSnapshot.plan_date
        });
      }
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

    // Final verification: Query the database one more time to ensure completion status is persisted
    const finalVerification = await db('daily_training_plans')
      .select('id', 'is_completed', 'completed_at', 'plan_type', 'plan_date', 'source_plan_id')
      .where({ id: daily_plan_id })
      .first();
    
    if (!finalVerification || !finalVerification.is_completed || !finalVerification.completed_at) {
      console.error(`❌ CRITICAL FINAL CHECK: Plan ${daily_plan_id} completion status NOT persisted!`, {
        id: finalVerification?.id,
        is_completed: finalVerification?.is_completed,
        completed_at: finalVerification?.completed_at,
        plan_type: finalVerification?.plan_type,
        plan_date: finalVerification?.plan_date
      });
      
      // Try one more time to set it
      await db('daily_training_plans')
        .where({ id: daily_plan_id })
        .update({
          is_completed: true,
          completed_at: new Date()
        });
      
      console.log(`✅ Final attempt to set completion status for plan ${daily_plan_id}`);
    } else {
      console.log(`✅ FINAL VERIFICATION: Plan ${daily_plan_id} completion status confirmed in database:`, {
        is_completed: finalVerification.is_completed,
        completed_at: finalVerification.completed_at,
        plan_type: finalVerification.plan_type,
        plan_date: finalVerification.plan_date,
        source_plan_id: finalVerification.source_plan_id
      });
    }

    // Auto-sync user stats after completion (from daily_training_plans and daily_training_plan_items)
    // IMPORTANT: Sync stats for the specific plan_type to ensure AI plans are included
    try {
      const { updateUserStats } = require('../utils/statsCalculator');
      const planType = finalVerification?.plan_type || updatedPlan.plan_type || 'web_assigned'; // Default to web_assigned if not set
      
      console.log(`📊 Syncing stats for user ${user_id} with plan_type: ${planType}`);
      
      // Update stats for ALL plan types (this ensures all stats records are updated)
      await updateUserStats(user_id);
      
      console.log(`✅ User stats synced automatically after plan completion (plan_type: ${planType})`);
      
      // Log verification: Check if the completed plan will be found in stats
      const { getUserStats } = require('../utils/statsCalculator');
      const statsForPlanType = await getUserStats(user_id, false, planType);
      
      if (statsForPlanType && statsForPlanType.daily_workouts) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayWorkouts = statsForPlanType.daily_workouts[todayStr] || [];
        console.log(`📊 Stats verification: Today's workouts (${todayStr}) for plan_type ${planType}:`, todayWorkouts);
      } else {
        console.warn(`⚠️ Stats verification: No stats found for plan_type ${planType} after completion`);
      }
    } catch (statsErr) {
      console.error('⚠️ Failed to auto-sync user stats:', statsErr);
      // Don't fail the request if stats sync fails
    }

    res.status(200).json({
      success: true,
      message: 'Daily training completion submitted successfully',
      data: {
        daily_plan_id: daily_plan_id,
        plan_date: updatedPlan.plan_date,
        is_completed: finalVerification?.is_completed || true,
        completed_at: finalVerification?.completed_at || updatedPlan.completed_at,
        plan_type: finalVerification?.plan_type || updatedPlan.plan_type,
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
        user_level: user_level || 'Beginner',
        exercises_details: exercises_details ? JSON.stringify(exercises_details) : null
      })
      .returning('*');

    // Items are now stored in exercises_details JSON column
    // No need to insert into daily_training_plan_items table
    const planItems = items || [];

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
            user_level,
            exercises_details: JSON.stringify(exercises_details),
            updated_at: new Date()
          })
          .returning('*');
        // Replace items
        // Items are now stored in exercises_details JSON column
        // No need to delete from daily_training_plan_items table
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
          // Items are now stored in exercises_details JSON column
          // No need to insert into daily_training_plan_items table
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
          user_level,
          exercises_details: JSON.stringify(exercises_details)
        })
        .returning('*');
        // Items are now stored in exercises_details JSON column
        // No need to manage daily_training_plan_items table
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

// Create daily plans from training approval on-demand (for mobile app)
exports.createDailyPlansFromTrainingApproval = async (req, res, next) => {
  try {
    const { approval_id, plan_date, web_plan_id, assignment_id } = req.body;
    const user_id = req.user.id;
    const gym_id = req.user.gym_id;

    // Support approval_id, web_plan_id, or assignment_id (mobile app may send any of these)
    const searchId = approval_id || web_plan_id || assignment_id;
    
    if (!searchId) {
      return res.status(400).json({
        success: false,
        message: 'approval_id, web_plan_id, or assignment_id is required'
      });
    }
    
    console.log('🔍 Creating daily plan from approval/assignment:', {
      searchId,
      approval_id,
      web_plan_id,
      assignment_id,
      user_id,
      plan_date
    });

    // Get training approval/assignment - try multiple lookup strategies
    // PRIORITY: Check assignments FIRST since "assigned plans" come from training_plan_assignments
    let approval = null;
    
    // Strategy 1: Try to find from training_plan_assignments FIRST (for assigned plans)
    // Try by id first (assignment.id)
    let assignment = await db('training_plan_assignments')
      .where({ id: searchId, user_id: user_id })
      .first();
    
    // If not found by id, try by web_plan_id (assignment.web_plan_id)
    if (!assignment) {
      assignment = await db('training_plan_assignments')
        .where({ web_plan_id: searchId, user_id: user_id })
        .first();
    }
    
    // If we found an assignment, convert it to approval-like structure
    if (assignment) {
      // Try to find approval by matching dates and user (in case there's a linked approval)
      approval = await db('training_approvals')
        .where({ 
          user_id: user_id,
          start_date: assignment.start_date,
          end_date: assignment.end_date
        })
        .first();
      
      // If still not found, use the assignment data directly
      if (!approval) {
        // Parse exercises_details from assignment
        let items = [];
        try {
          if (assignment.exercises_details) {
            const parsed = typeof assignment.exercises_details === 'string' 
              ? JSON.parse(assignment.exercises_details) 
              : assignment.exercises_details;
            items = Array.isArray(parsed) ? parsed : [];
          }
        } catch (e) {
          console.error('Error parsing assignment exercises_details:', e);
          items = [];
        }
        
        // If no items, try to get from source training_plan
        if (items.length === 0 && assignment.web_plan_id) {
          try {
            const sourcePlan = await db('training_plans')
              .where({ id: assignment.web_plan_id })
              .first();
            
            if (sourcePlan && sourcePlan.exercises_details) {
              try {
                const parsed = typeof sourcePlan.exercises_details === 'string'
                  ? JSON.parse(sourcePlan.exercises_details)
                  : sourcePlan.exercises_details;
                items = Array.isArray(parsed) ? parsed : [];
              } catch (e) {
                console.error('Error parsing source plan exercises_details:', e);
              }
            }
          } catch (e) {
            console.error('Error fetching source plan:', e);
          }
        }
        
        // Parse daily_plans from assignment if available
        let dailyPlans = null;
        if (assignment.daily_plans) {
          try {
            dailyPlans = typeof assignment.daily_plans === 'string'
              ? JSON.parse(assignment.daily_plans)
              : assignment.daily_plans;
          } catch (_) {
            dailyPlans = null;
          }
        }
        
        // Convert assignment to approval-like structure
        approval = {
          id: assignment.id, // Use assignment id
          user_id: assignment.user_id,
          gym_id: assignment.gym_id,
          start_date: assignment.start_date,
          end_date: assignment.end_date,
          category: assignment.category,
          exercise_plan_category: assignment.category,
          user_level: assignment.user_level || 'Beginner',
          items: items,
          exercises_details: items.length > 0 ? JSON.stringify(items) : assignment.exercises_details,
          approval_status: assignment.status || 'APPROVED',
          daily_plans: dailyPlans // Use daily_plans from assignment if available
        };
      }
    }

    // Strategy 2: If not found in assignments, try training_approvals (for AI/Manual plans from mobile)
    if (!approval) {
      // Try by id in training_approvals
      approval = await db('training_approvals')
        .where({ id: searchId, user_id: user_id })
        .first();

      // Try by plan_id (which might be the web_plan_id)
      if (!approval) {
        approval = await db('training_approvals')
          .where({ plan_id: searchId, user_id: user_id })
          .first();
      }
    }

    // Strategy 3: Try without user_id filter (in case of gym assignment)
    if (!approval && !assignment) {
      // Try assignments without user filter
      assignment = await db('training_plan_assignments')
        .where({ web_plan_id: searchId })
        .orWhere({ id: searchId })
        .first();
      
      // If found assignment, convert it (same logic as Strategy 1)
      if (assignment && !approval) {
        // Parse exercises_details from assignment
        let items = [];
        try {
          if (assignment.exercises_details) {
            const parsed = typeof assignment.exercises_details === 'string'
              ? JSON.parse(assignment.exercises_details)
              : assignment.exercises_details;
            items = Array.isArray(parsed) ? parsed : [];
          }
        } catch (e) {
          console.error('Error parsing assignment exercises_details:', e);
          items = [];
        }
        
        // If no items, try to get from source training_plan
        if (items.length === 0 && assignment.web_plan_id) {
          try {
            const sourcePlan = await db('training_plans')
              .where({ id: assignment.web_plan_id })
              .first();
            
            if (sourcePlan && sourcePlan.exercises_details) {
              try {
                const parsed = typeof sourcePlan.exercises_details === 'string'
                  ? JSON.parse(sourcePlan.exercises_details)
                  : sourcePlan.exercises_details;
                items = Array.isArray(parsed) ? parsed : [];
              } catch (e) {
                console.error('Error parsing source plan exercises_details:', e);
              }
            }
          } catch (e) {
            console.error('Error fetching source plan:', e);
          }
        }
        
        // Parse daily_plans from assignment if available
        let dailyPlans = null;
        if (assignment.daily_plans) {
          try {
            dailyPlans = typeof assignment.daily_plans === 'string'
              ? JSON.parse(assignment.daily_plans)
              : assignment.daily_plans;
          } catch (_) {
            dailyPlans = null;
          }
        }
        
        approval = {
          id: assignment.id,
          user_id: assignment.user_id,
          gym_id: assignment.gym_id,
          start_date: assignment.start_date,
          end_date: assignment.end_date,
          category: assignment.category,
          exercise_plan_category: assignment.category,
          user_level: assignment.user_level || 'Beginner',
          items: items,
          exercises_details: items.length > 0 ? JSON.stringify(items) : assignment.exercises_details,
          approval_status: assignment.status || 'APPROVED',
          daily_plans: dailyPlans,
          source: 'web_assigned', // IMPORTANT: Mark as web_assigned for assignments
          plan_type: 'web_assigned' // IMPORTANT: Set plan_type for assignments
        };
      }
      
      // Try approvals without user filter
      if (!approval) {
        approval = await db('training_approvals')
          .where({ id: searchId })
          .orWhere({ plan_id: searchId })
          .first();
      }
    }

    if (!approval) {
      // Try to get available approvals and assignments for debugging
      const availableApprovals = await db('training_approvals')
        .where({ user_id: user_id })
        .select('id', 'plan_id', 'category', 'exercise_plan_category')
        .limit(10);
      
      const availableAssignments = await db('training_plan_assignments')
        .where({ user_id: user_id })
        .select('id', 'web_plan_id', 'category', 'status')
        .limit(10);
      
      console.error('❌ Training approval/assignment not found:', {
        searchId,
        approval_id,
        web_plan_id,
        user_id,
        available_approvals: availableApprovals.map(a => ({ id: a.id, plan_id: a.plan_id })),
        available_assignments: availableAssignments.map(a => ({ id: a.id, web_plan_id: a.web_plan_id }))
      });
      
      const approvalIds = availableApprovals.map(a => a.id).join(', ');
      const assignmentIds = availableAssignments.map(a => `${a.id} (web_plan_id: ${a.web_plan_id})`).join(', ');
      
      return res.status(404).json({
        success: false,
        message: `Training approval/assignment not found with id/web_plan_id: ${searchId}. Available approvals: [${approvalIds}]. Available assignments: [${assignmentIds}]`
      });
    }

    // Parse items from approval/assignment
    let items = [];
    
    // Try multiple sources for exercises
    if (approval.items) {
      try { 
        items = typeof approval.items === 'string' 
          ? JSON.parse(approval.items) 
          : approval.items;
        if (!Array.isArray(items)) items = [];
      } catch (_) { items = []; }
    }
    
    if (items.length === 0 && approval.exercises_details) {
      try { 
        items = typeof approval.exercises_details === 'string' 
          ? JSON.parse(approval.exercises_details) 
          : approval.exercises_details;
        if (!Array.isArray(items)) items = [];
      } catch (_) { items = []; }
    }

    // If still no items, try to get from daily_plans if available
    if (items.length === 0 && approval.daily_plans) {
      try {
        const dailyPlans = typeof approval.daily_plans === 'string'
          ? JSON.parse(approval.daily_plans)
          : approval.daily_plans;
        
        if (Array.isArray(dailyPlans) && dailyPlans.length > 0) {
          // Extract all exercises from all daily plans
          const allExercises = [];
          for (const dailyPlan of dailyPlans) {
            if (dailyPlan.exercises && Array.isArray(dailyPlan.exercises)) {
              allExercises.push(...dailyPlan.exercises);
            } else if (dailyPlan.workouts && Array.isArray(dailyPlan.workouts)) {
              allExercises.push(...dailyPlan.workouts);
            }
          }
          items = allExercises;
        }
      } catch (_) {
        items = [];
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      console.error('❌ No exercises found in approval/assignment:', {
        approval_id: approval.id,
        has_items: !!approval.items,
        has_exercises_details: !!approval.exercises_details,
        has_daily_plans: !!approval.daily_plans,
        approval_keys: Object.keys(approval)
      });
      
      return res.status(400).json({
        success: false,
        message: 'No exercises found in training approval/assignment. Please ensure the approval has exercises_details or items.'
      });
    }

    // Get daily_plans from approval if available
    let dailyPlansSource = null;
    if (approval.daily_plans) {
      try {
        dailyPlansSource = JSON.parse(approval.daily_plans);
      } catch (_) {}
    }

    // Generate daily plan for specific date or use distribution
    const targetDate = plan_date || new Date().toISOString().split('T')[0];
    
    // Normalize target date to YYYY-MM-DD format
    const normalizeDate = (dateStr) => {
      try {
        const d = new Date(dateStr);
        return d.toISOString().split('T')[0];
      } catch (e) {
        return dateStr;
      }
    };
    const normalizedTargetDate = normalizeDate(targetDate);
    
    let exercisesForDate = [];
    
    // Check if target date is within assignment/approval date range
    const startDate = new Date(approval.start_date);
    const endDate = new Date(approval.end_date);
    const targetDateObj = new Date(normalizedTargetDate);
    
    // Check if date is within range
    if (targetDateObj < startDate || targetDateObj > endDate) {
      console.warn('⚠️ Target date is outside assignment date range:', {
        targetDate: normalizedTargetDate,
        startDate: approval.start_date,
        endDate: approval.end_date
      });
    }
    
    if (Array.isArray(dailyPlansSource) && dailyPlansSource.length > 0) {
      // Find the plan for this date - try multiple date formats
      let planForDate = dailyPlansSource.find(p => {
        const planDate = normalizeDate(p.date);
        return planDate === normalizedTargetDate;
      });
      
      // If not found, try finding by day index (if workouts array exists)
      if (!planForDate) {
        // Try to find by calculating day index
        const dayIndex = Math.floor((targetDateObj - startDate) / (1000 * 60 * 60 * 24));
        if (dayIndex >= 0 && dayIndex < dailyPlansSource.length) {
          planForDate = dailyPlansSource[dayIndex];
        }
      }
      
      if (planForDate) {
        // Try different property names for exercises
        if (Array.isArray(planForDate.exercises)) {
          exercisesForDate = planForDate.exercises;
        } else if (Array.isArray(planForDate.workouts)) {
          exercisesForDate = planForDate.workouts;
        } else if (Array.isArray(planForDate.items)) {
          exercisesForDate = planForDate.items;
        }
      }
    }

    // If no plan found for date, use smart distribution
    if (exercisesForDate.length === 0) {
      const { createDistributedPlan } = require('../utils/exerciseDistribution');
      const distributed = createDistributedPlan({ items }, startDate, endDate);
      
      // Find exercises for target date - try multiple date formats
      let planForDate = distributed.daily_plans.find(p => {
        const planDate = normalizeDate(p.date);
        return planDate === normalizedTargetDate;
      });
      
      // If not found by exact date match, try by day index
      if (!planForDate) {
        const dayIndex = Math.floor((targetDateObj - startDate) / (1000 * 60 * 60 * 24));
        if (dayIndex >= 0 && dayIndex < distributed.daily_plans.length) {
          planForDate = distributed.daily_plans[dayIndex];
        }
      }
      
      if (planForDate) {
        // Try different property names for exercises (workouts is the actual property from createDistributedPlan)
        if (Array.isArray(planForDate.workouts)) {
          exercisesForDate = planForDate.workouts;
        } else if (Array.isArray(planForDate.exercises)) {
          exercisesForDate = planForDate.exercises;
        } else if (Array.isArray(planForDate.items)) {
          exercisesForDate = planForDate.items;
        }
      }
      
      // If still not found, use first day's exercises or all exercises
      if (exercisesForDate.length === 0) {
        if (distributed.daily_plans.length > 0) {
          const firstDay = distributed.daily_plans[0];
          // Check workouts first (this is what createDistributedPlan returns)
          if (Array.isArray(firstDay.workouts)) {
            exercisesForDate = firstDay.workouts;
          } else if (Array.isArray(firstDay.exercises)) {
            exercisesForDate = firstDay.exercises;
          } else if (Array.isArray(firstDay.items)) {
            exercisesForDate = firstDay.items;
          }
        }
        
        // Last resort: use all items if no daily distribution worked
        if (exercisesForDate.length === 0 && items.length > 0) {
          exercisesForDate = items;
        }
      }
    }

    if (exercisesForDate.length === 0) {
      console.error('❌ No exercises found for date:', {
        targetDate: normalizedTargetDate,
        startDate: approval.start_date,
        endDate: approval.end_date,
        itemsCount: items.length,
        dailyPlansSourceCount: dailyPlansSource ? dailyPlansSource.length : 0,
        hasDailyPlans: !!dailyPlansSource
      });
      
      return res.status(400).json({
        success: false,
        message: `No exercises found for date ${normalizedTargetDate}. Assignment date range: ${approval.start_date} to ${approval.end_date}. Items available: ${items.length}`
      });
    }

    // Use the actual approval id for source_plan_id
    const actualApprovalId = approval.id || searchId;
    
    // IMPORTANT: Determine plan_type based on the source
    // - If it's from an assignment (training_plan_assignments), use 'web_assigned'
    // - If it's from a manual plan approval (source: 'manual'), use 'manual'
    // - If it's from an AI plan approval (source: 'ai_generated'), use 'ai_generated'
    // - Default to 'web_assigned' for backward compatibility
    let determinedPlanType = 'web_assigned'; // Default
    
    // Check if this is from an assignment (not an approval)
    const isFromAssignment = assignment_id && !approval_id;
    
    if (isFromAssignment) {
      // This is definitely from an assignment, use web_assigned
      determinedPlanType = 'web_assigned';
      console.log(`📊 createDailyPlanFromApproval - Source is assignment, using plan_type: ${determinedPlanType}`);
    } else if (approval.source) {
      // Check the source field in approval
      if (approval.source === 'manual') {
        determinedPlanType = 'manual';
        console.log(`📊 createDailyPlanFromApproval - Source is manual plan, using plan_type: ${determinedPlanType}`);
      } else if (approval.source === 'ai_generated' || approval.source === 'ai') {
        determinedPlanType = 'ai_generated';
        console.log(`📊 createDailyPlanFromApproval - Source is AI plan, using plan_type: ${determinedPlanType}`);
      } else if (approval.source === 'web' || approval.source === 'web_assigned') {
        determinedPlanType = 'web_assigned';
        console.log(`📊 createDailyPlanFromApproval - Source is web assigned, using plan_type: ${determinedPlanType}`);
      }
    } else if (approval.plan_type) {
      // Fallback: check plan_type field if source is not available
      determinedPlanType = approval.plan_type;
      console.log(`📊 createDailyPlanFromApproval - Using plan_type from approval: ${determinedPlanType}`);
    }
    
    console.log(`📊 createDailyPlanFromApproval - Final determined plan_type: ${determinedPlanType} for approval/assignment ${actualApprovalId}`);
    
    // Check if daily plan already exists
    const existing = await db('daily_training_plans')
      .where({
        user_id: user_id,
        plan_date: targetDate,
        source_plan_id: actualApprovalId,
        is_stats_record: false
      })
      .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
      .first();

    let dailyPlan;
    if (existing) {
      // Update existing plan (also update plan_type if it's wrong)
      const [updated] = await db('daily_training_plans')
        .where({ id: existing.id })
        .update({
          exercises_details: JSON.stringify(exercisesForDate),
          plan_category: approval.exercise_plan_category || approval.category || 'General',
          user_level: approval.user_level || 'Beginner',
          plan_type: determinedPlanType, // Update plan_type if it was wrong
          updated_at: new Date()
        })
        .returning('*');
      dailyPlan = updated;
      console.log(`✅ Updated daily plan ${existing.id} with plan_type: ${determinedPlanType}`);
    } else {
      // Create new daily plan
      const [inserted] = await db('daily_training_plans')
        .insert({
          user_id: user_id,
          gym_id: gym_id,
          plan_date: targetDate,
          plan_type: determinedPlanType, // Use determined plan_type
          source_plan_id: actualApprovalId,
          plan_category: approval.exercise_plan_category || approval.category || 'General',
          user_level: approval.user_level || 'Beginner',
          exercises_details: JSON.stringify(exercisesForDate),
          is_stats_record: false
        })
        .returning('*');
      dailyPlan = inserted;
      console.log(`✅ Created daily plan ${inserted.id} with plan_type: ${determinedPlanType}`);
    }

    // Parse exercises_details for response
    let exercises = [];
    try {
      exercises = dailyPlan.exercises_details ? JSON.parse(dailyPlan.exercises_details) : [];
    } catch (e) {
      exercises = [];
    }

    // Return response with explicit daily_plan_id for mobile app
    res.json({
      success: true,
      message: 'Daily plan created/retrieved successfully',
      data: {
        ...dailyPlan,
        exercises_details: exercises,
        items: exercises,
        // Explicitly include daily_plan_id for mobile app compatibility
        daily_plan_id: dailyPlan.id,
        id: dailyPlan.id,
        // Include source info for reference
        source_assignment_id: actualApprovalId,
        source_web_plan_id: approval.web_plan_id || null
      }
    });

  } catch (err) {
    console.error('Error creating daily plans from training approval:', err);
    next(err);
  }
};

// Find daily plan by source (assignment/approval) and date (for mobile app)
exports.findDailyPlanBySource = async (req, res, next) => {
  try {
    const { assignment_id, approval_id, web_plan_id, plan_date, source_plan_id } = req.query;
    const user_id = req.user.id;
    const gym_id = req.user.gym_id;

    // Support multiple ways to find the source
    const searchId = assignment_id || approval_id || web_plan_id || source_plan_id;
    // Use provided plan_date or default to today
    const targetDate = plan_date || new Date().toISOString().split('T')[0];

    // Validate that searchId is provided (targetDate always has a value due to default)
    if (!searchId) {
      return res.status(400).json({
        success: false,
        message: 'assignment_id, approval_id, web_plan_id, or source_plan_id is required'
      });
    }

    // Normalize date
    const normalizeDate = (dateStr) => {
      try {
        const d = new Date(dateStr);
        return d.toISOString().split('T')[0];
      } catch (e) {
        return dateStr;
      }
    };
    const normalizedDate = normalizeDate(targetDate);

    // Find daily plan by source_plan_id and date
    let dailyPlan = await db('daily_training_plans')
      .where({
        user_id: user_id,
        plan_date: normalizedDate,
        source_plan_id: searchId,
        is_stats_record: false
      })
      .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
      .first();

    // If not found by source_plan_id, try to find by matching assignment/approval/manual plan
    if (!dailyPlan) {
      // Try to find assignment first
      const assignment = await db('training_plan_assignments')
        .where({ id: searchId, user_id: user_id })
        .orWhere({ web_plan_id: searchId, user_id: user_id })
        .first();

      if (assignment) {
        dailyPlan = await db('daily_training_plans')
          .where({
            user_id: user_id,
            plan_date: normalizedDate,
            source_plan_id: assignment.id.toString(),
            is_stats_record: false
          })
          .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
          .first();
      }

      // Try to find approval
      if (!dailyPlan) {
        const approval = await db('training_approvals')
          .where({ id: searchId, user_id: user_id })
          .orWhere({ plan_id: searchId, user_id: user_id })
          .first();

        if (approval) {
          dailyPlan = await db('daily_training_plans')
            .where({
              user_id: user_id,
              plan_date: normalizedDate,
              source_plan_id: approval.id.toString(),
              is_stats_record: false
            })
            .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
            .first();
        }
      }

      // Try to find manual plan (for manual plans, source_plan_id is the plan_id)
      if (!dailyPlan) {
        const manualPlan = await db('app_manual_training_plans')
          .where({ id: searchId, user_id: user_id })
          .first();

        if (manualPlan) {
          // For manual plans, source_plan_id is stored as the plan_id (string)
          dailyPlan = await db('daily_training_plans')
            .where({
              user_id: user_id,
              plan_date: normalizedDate,
              source_plan_id: manualPlan.id.toString(),
              plan_type: 'manual',
              is_stats_record: false
            })
            .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
            .first();
          
          // If still not found, try to sync daily plans from manual plan
          if (!dailyPlan && manualPlan.daily_plans) {
            console.log(`🔄 Daily plan not found for manual plan ${searchId}, attempting to sync...`);
            try {
              const { syncDailyPlansFromManualPlanHelper } = require('./DailyTrainingController');
              await syncDailyPlansFromManualPlanHelper(manualPlan.id);
              
              // Try to find again after sync
              dailyPlan = await db('daily_training_plans')
                .where({
                  user_id: user_id,
                  plan_date: normalizedDate,
                  source_plan_id: manualPlan.id.toString(),
                  plan_type: 'manual',
                  is_stats_record: false
                })
                .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
                .first();
            } catch (syncError) {
              console.error('❌ Error syncing daily plans from manual plan:', syncError);
            }
          }
        }
      }

      // Try to find AI plan
      if (!dailyPlan) {
        const aiPlan = await db('app_ai_generated_plans')
          .where({ id: searchId, user_id: user_id })
          .first();

        if (aiPlan) {
          dailyPlan = await db('daily_training_plans')
            .where({
              user_id: user_id,
              plan_date: normalizedDate,
              source_plan_id: aiPlan.id.toString(),
              plan_type: 'ai_generated',
              is_stats_record: false
            })
            .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
            .first();
        }
      }
    }

    if (!dailyPlan) {
      return res.status(404).json({
        success: false,
        message: `Daily plan not found for source ${searchId} on date ${normalizedDate}. Use /mobile/plans/create-from-approval to create it.`
      });
    }

    // Parse exercises_details for response
    let exercises = [];
    try {
      exercises = dailyPlan.exercises_details ? JSON.parse(dailyPlan.exercises_details) : [];
    } catch (e) {
      exercises = [];
    }

    res.json({
      success: true,
      data: {
        ...dailyPlan,
        exercises_details: exercises,
        items: exercises,
        // Explicitly include daily_plan_id for mobile app
        daily_plan_id: dailyPlan.id,
        id: dailyPlan.id
      }
    });

  } catch (err) {
    console.error('Error finding daily plan by source:', err);
    next(err);
  }
};

/**
 * Sync daily plans from training_plan_assignments to daily_training_plans
 * This function reads the daily_plans column from an assignment and creates
 * corresponding records in daily_training_plans table for assigned plans only
 * @param {number} assignmentId - Assignment ID from training_plan_assignments
 * @returns {Promise<Array>} Array of created/updated daily plans
 */
async function syncDailyPlansFromAssignmentHelper(assignmentId) {
  try {
    console.log(`🔄 Syncing daily plans from assignment ${assignmentId}`);
    
    // Get the assignment
    const assignment = await db('training_plan_assignments')
      .where({ id: assignmentId })
      .first();
    
    if (!assignment) {
      console.error(`❌ Assignment ${assignmentId} not found`);
      return [];
    }
    
    // Check if assignment has daily_plans
    if (!assignment.daily_plans) {
      console.log(`⚠️ Assignment ${assignmentId} has no daily_plans data`);
      return [];
    }
    
    // Parse daily_plans
    let dailyPlans = null;
    try {
      dailyPlans = typeof assignment.daily_plans === 'string'
        ? JSON.parse(assignment.daily_plans)
        : assignment.daily_plans;
    } catch (e) {
      console.error(`❌ Error parsing daily_plans for assignment ${assignmentId}:`, e);
      return [];
    }
    
    if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) {
      console.log(`⚠️ Assignment ${assignmentId} has empty or invalid daily_plans`);
      return [];
    }
    
    console.log(`📊 Found ${dailyPlans.length} daily plans in assignment ${assignmentId}`);
    
    // IMPORTANT: Validate that we have the correct number of days
    // If a plan is for 83 days, dailyPlans array should have exactly 83 items
    // Day numbering: Day 1, Day 2, ..., Day 83 (NOT Day 0, Day 1, ..., Day 82)
    const expectedDays = dailyPlans.length;
    console.log(`📊 Expected days in plan: ${expectedDays} (Day 1 to Day ${expectedDays})`);
    
    // IMPORTANT: Check last completed date and start from next day
    // Find the last completed daily plan for this assignment (by plan_date, not completed_at)
    // This ensures we skip days that are already completed and start from the next day
    const lastCompletedPlan = await db('daily_training_plans')
      .where({
        user_id: assignment.user_id,
        is_stats_record: false,
        is_completed: true
      })
      .whereNotNull('completed_at')
      .whereNotNull('plan_date')
      .whereIn('plan_type', ['web_assigned', 'web_assigne'])
      .where(function() {
        // Match both string and integer versions of source_plan_id
        this.where('source_plan_id', assignment.id)
            .orWhere('source_plan_id', assignment.id.toString());
      })
      .modify((qb) => { 
        if (assignment.gym_id != null) {
          qb.andWhere({ gym_id: assignment.gym_id });
        }
      })
      .orderBy('plan_date', 'desc')
      .first();
    
    let lastCompletedDate = null;
    if (lastCompletedPlan && lastCompletedPlan.plan_date) {
      // Use plan_date (the scheduled date) to determine which day was last completed
      const planDate = new Date(lastCompletedPlan.plan_date);
      planDate.setHours(0, 0, 0, 0);
      lastCompletedDate = planDate.toISOString().split('T')[0];
      console.log(`📅 Last completed day for assignment ${assignmentId}: ${lastCompletedDate} (plan_date from plan ${lastCompletedPlan.id}), will start from next day`);
    } else {
      console.log(`📅 No completed plans found for assignment ${assignmentId}, will start from first day`);
    }
    
    // IMPORTANT: Recalculate dates based on assignment's start_date
    // The daily_plans from the plan may have dates relative to the plan's start_date,
    // but we need dates relative to the assignment's start_date (which should be the same, but recalculate to be safe)
    // Parse start_date and normalize to date-only (YYYY-MM-DD) in UTC to avoid timezone issues
    const startDateStr = assignment.start_date instanceof Date 
      ? assignment.start_date.toISOString().split('T')[0]
      : assignment.start_date.split('T')[0];
    
    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
    const assignmentStartDate = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));
    
    // Parse end_date similarly
    const endDateStr = assignment.end_date instanceof Date
      ? assignment.end_date.toISOString().split('T')[0]
      : assignment.end_date.split('T')[0];
    
    const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
    const assignmentEndDate = new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999));
    
    console.log(`📅 Assignment start_date: ${assignment.start_date}, normalized: ${assignmentStartDate.toISOString().split('T')[0]}`);
    console.log(`📅 Assignment end_date: ${assignment.end_date}, normalized: ${assignmentEndDate.toISOString().split('T')[0]}`);
    
    // IMPORTANT: Delete ALL existing daily plans for this assignment AND any overlapping dates
    // This ensures a fresh start when reassigning a plan (starts from day 1)
    // We need to delete:
    // 1. All daily plans for this specific assignment (by source_plan_id)
    // 2. All daily plans for this user in the assignment's date range (to catch any leftover plans from previous assignments)
    try {
      console.log(`🗑️ Deleting daily plans for assignment ${assignmentId} and date range ${startDateStr} to ${endDateStr}`);
      
      // Delete by assignment ID first
      const deleteByAssignmentQuery = db('daily_training_plans')
        .where({
          user_id: assignment.user_id,
          is_stats_record: false
        })
        .whereIn('plan_type', ['web_assigned', 'web_assigne'])
        .where(function() {
          // Match both string and integer versions of source_plan_id
          this.where('source_plan_id', assignment.id)
              .orWhere('source_plan_id', assignment.id.toString());
        });
      
      if (assignment.gym_id != null) {
        deleteByAssignmentQuery.andWhere({ gym_id: assignment.gym_id });
      }
      
      const deletedByAssignment = await deleteByAssignmentQuery.del();
      console.log(`🗑️ Deleted ${deletedByAssignment} daily plans by assignment ID`);
      
      // Also delete any daily plans in the assignment's date range for this user
      // This catches leftover plans from previous assignments that might have overlapping dates
      // IMPORTANT: Delete ALL web_assigned plans for this user in the date range, regardless of source_plan_id
      // This ensures we remove any plans with wrong dates (e.g., Day 1 plan with date before start_date)
      const deleteByDateRangeQuery = db('daily_training_plans')
        .where({
          user_id: assignment.user_id,
          is_stats_record: false
        })
        .whereIn('plan_type', ['web_assigned', 'web_assigne'])
        .whereBetween('plan_date', [startDateStr, endDateStr]);
      
      if (assignment.gym_id != null) {
        deleteByDateRangeQuery.andWhere({ gym_id: assignment.gym_id });
      }
      
      const deletedByDateRange = await deleteByDateRangeQuery.del();
      console.log(`🗑️ Deleted ${deletedByDateRange} daily plans by date range (${startDateStr} to ${endDateStr})`);
      
      // IMPORTANT: Also delete any web_assigned plans for this user that have dates BEFORE start_date
      // This catches plans that were created with wrong dates (e.g., Day 1 with date 2025-11-05 when start_date is 2025-11-06)
      const deleteBeforeStartQuery = db('daily_training_plans')
        .where({
          user_id: assignment.user_id,
          is_stats_record: false
        })
        .whereIn('plan_type', ['web_assigned', 'web_assigne'])
        .where('plan_date', '<', startDateStr);
      
      if (assignment.gym_id != null) {
        deleteBeforeStartQuery.andWhere({ gym_id: assignment.gym_id });
      }
      
      const deletedBeforeStart = await deleteBeforeStartQuery.del();
      console.log(`🗑️ Deleted ${deletedBeforeStart} daily plans with dates before start_date (${startDateStr})`);
      
      const totalDeleted = deletedByAssignment + deletedByDateRange + deletedBeforeStart;
      console.log(`✅ Total deleted: ${totalDeleted} daily plans (fresh start from day 1)`);
    } catch (deleteErr) {
      console.error(`⚠️ Error deleting existing daily plans for assignment ${assignmentId}:`, deleteErr?.message || deleteErr);
      // Continue anyway - we'll create fresh plans below
    }
    
    const createdOrUpdated = [];
    
    // IMPORTANT: Sort daily plans by day number to ensure correct order
    // Some daily plans might have a 'day' property (1, 2, 3...) that we should use
    // But we'll normalize day numbers to ensure they start from 1 and are sequential
    const sortedDailyPlans = [...dailyPlans].sort((a, b) => {
      const dayA = a.day !== undefined ? a.day : (a.date ? 999999 : 0);
      const dayB = b.day !== undefined ? b.day : (b.date ? 999999 : 0);
      return dayA - dayB;
    });
    
    console.log(`📊 Sorted ${sortedDailyPlans.length} daily plans by day number`);
    console.log(`📊 First few daily plans:`, sortedDailyPlans.slice(0, 3).map(dp => ({
      day: dp.day,
      date: dp.date,
      workouts: Array.isArray(dp.workouts) ? dp.workouts.length : 0
    })));
    
    // IMPORTANT: Validate array length matches expected days
    if (sortedDailyPlans.length !== expectedDays) {
      console.warn(`⚠️ WARNING: sortedDailyPlans.length (${sortedDailyPlans.length}) does not match expectedDays (${expectedDays})`);
    }
    
    // Process each daily plan - recalculate dates based on assignment start_date
    // IMPORTANT: We IGNORE the dates in daily_plans and always recalculate from start_date
    // IMPORTANT: Day numbering starts from 1, not 0
    // For a plan with 83 days: Day 1, Day 2, ..., Day 83 (NOT Day 0, Day 1, ..., Day 82)
    // Loop: index 0 → Day 1, index 1 → Day 2, ..., index 82 → Day 83 (for 83-day plan)
    for (let index = 0; index < sortedDailyPlans.length; index++) {
      const dayPlan = sortedDailyPlans[index];
      try {
        // IMPORTANT: Day number starts from 1, not 0
        // index 0 = Day 1, index 1 = Day 2, ..., index 82 = Day 83 (for 83-day plan)
        // This ensures Day 1 is the first day, not Day 0
        // For a plan with 83 days: we iterate indices 0-82, creating days 1-83
        const dayNumber = index + 1;
        
        // Validate: dayNumber should not exceed expectedDays
        if (dayNumber > expectedDays) {
          console.warn(`⚠️ WARNING: dayNumber ${dayNumber} exceeds expectedDays ${expectedDays}. Skipping.`);
          continue;
        }
        
        // IMPORTANT: Recalculate date based on assignment's start_date and day number
        // Day 1 = start_date + 0 days (no offset)
        // Day 2 = start_date + 1 day
        // Day 3 = start_date + 2 days
        // etc.
        // Use UTC date calculation to avoid timezone issues
        const dayOffset = dayNumber - 1; // Day 1 = offset 0, Day 2 = offset 1, Day 3 = offset 2, etc.
        
        // Extract UTC date components from normalized start date
        const startYear = assignmentStartDate.getUTCFullYear();
        const startMonth = assignmentStartDate.getUTCMonth();
        const startDay = assignmentStartDate.getUTCDate();
        
        // Create new UTC date with offset
        const planDate = new Date(Date.UTC(startYear, startMonth, startDay + dayOffset, 0, 0, 0, 0));
        
        // Format as YYYY-MM-DD string (date only, no time component) in UTC
        const year = planDate.getUTCFullYear();
        const month = String(planDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(planDate.getUTCDate()).padStart(2, '0');
        const planDateStr = `${year}-${month}-${day}`;
        
        // Validate: plan_date must not be before start_date
        if (planDateStr < startDateStr) {
          console.error(`❌ ERROR: Calculated plan_date ${planDateStr} for Day ${dayNumber} is before start_date ${startDateStr}. Skipping.`);
          continue;
        }
        
        // Validate: plan_date must not be after end_date
        if (planDateStr > endDateStr) {
          console.warn(`⚠️ Calculated plan_date ${planDateStr} for Day ${dayNumber} is after end_date ${endDateStr}. Skipping.`);
          continue;
        }
        
        // IMPORTANT: Skip days that are already completed (before or on lastCompletedDate)
        // Only create/update plans for days AFTER the last completed date
        if (lastCompletedDate && planDateStr <= lastCompletedDate) {
          console.log(`⏭️ Skipping Day ${dayNumber} (${planDateStr}) - already completed (last completed: ${lastCompletedDate})`);
          continue;
        }
        
        // Extract exercises/workouts from dayPlan
        let exercises = [];
        if (Array.isArray(dayPlan.workouts)) {
          exercises = dayPlan.workouts;
        } else if (Array.isArray(dayPlan.exercises)) {
          exercises = dayPlan.exercises;
        } else if (Array.isArray(dayPlan.items)) {
          exercises = dayPlan.items;
        } else if (Array.isArray(dayPlan)) {
          // If dayPlan itself is an array, use it directly
          exercises = dayPlan;
        }
        
        // Log workout names for debugging
        const workoutNames = exercises.map(ex => ex.name || ex.workout_name || 'Unknown').join(', ');
        console.log(`📅 Day ${dayNumber} (index ${index}, original day: ${dayPlan.day || 'N/A'}): Date ${planDateStr} (start_date: ${startDateStr} + ${dayOffset} days), Workouts: [${workoutNames}]`);
        
        if (exercises.length === 0) {
          console.warn(`⚠️ Daily plan for Day ${dayNumber} (date: ${planDateStr}) has no exercises, skipping`);
          continue;
        }
        
        // Check if a plan already exists for this date (shouldn't happen after deletion, but double-check)
        // IMPORTANT: Also check for plans with wrong plan_type (e.g., 'manual' instead of 'web_assigned')
        // This fixes existing plans that were created with incorrect plan_type
        let existingPlan = await db('daily_training_plans')
          .where({
            user_id: assignment.user_id,
            plan_date: planDateStr,
            plan_type: 'web_assigned',
            source_plan_id: assignment.id.toString(),
            is_stats_record: false
          })
          .first();
        
        // If not found with correct plan_type, check for plans with wrong plan_type
        if (!existingPlan) {
          existingPlan = await db('daily_training_plans')
            .where({
              user_id: assignment.user_id,
              plan_date: planDateStr,
              source_plan_id: assignment.id.toString(),
              is_stats_record: false
            })
            .whereIn('plan_type', ['manual', 'ai_generated', 'web_assigne']) // Check for wrong plan_types
            .first();
          
          if (existingPlan) {
            console.warn(`⚠️ Found existing plan ${existingPlan.id} with wrong plan_type '${existingPlan.plan_type}' for Day ${dayNumber}, will fix to 'web_assigned'`);
          }
        }
        
        if (existingPlan) {
          console.warn(`⚠️ Plan already exists for Day ${dayNumber} (date: ${planDateStr}), updating instead of creating`);
          // Update existing plan to ensure it's fresh (reset completion status)
          // IMPORTANT: Also update plan_type if it's wrong (e.g., was 'manual' but should be 'web_assigned')
          const [updated] = await db('daily_training_plans')
            .where({ id: existingPlan.id })
            .update({
              exercises_details: JSON.stringify(exercises),
              plan_category: assignment.category || dayPlan.category || 'General',
              user_level: assignment.user_level || dayPlan.user_level || 'Beginner',
              plan_type: 'web_assigned', // IMPORTANT: Ensure plan_type is correct for assignments
              is_completed: false,  // Reset to incomplete
              completed_at: null,   // Reset completion timestamp
              updated_at: new Date()
            })
            .returning('*');
          
          if (existingPlan.plan_type !== 'web_assigned' && existingPlan.plan_type !== 'web_assigne') {
            console.log(`✅ Fixed plan_type from '${existingPlan.plan_type}' to 'web_assigned' for plan ${updated.id}`);
          }
          
          console.log(`✅ Updated existing daily plan ${updated.id} for Day ${dayNumber} (date: ${planDateStr}, workouts: [${workoutNames}], plan_type: web_assigned, is_completed: false)`);
          createdOrUpdated.push(updated);
        } else {
          // Always create a fresh daily plan (we deleted all existing ones above)
          // This ensures the plan starts from day 1 with no completion status
          const [inserted] = await db('daily_training_plans')
            .insert({
              user_id: assignment.user_id,
              gym_id: assignment.gym_id,
              plan_date: planDateStr,  // Use recalculated date
              plan_type: 'web_assigned',
              source_plan_id: assignment.id.toString(),
              plan_category: assignment.category || dayPlan.category || 'General',
              user_level: assignment.user_level || dayPlan.user_level || 'Beginner',
              exercises_details: JSON.stringify(exercises),
              is_completed: false,  // Always start as incomplete
              completed_at: null,   // Reset completion timestamp
              is_stats_record: false
            })
            .returning('*');
          const dailyPlan = inserted;
          console.log(`✅ Created fresh daily plan ${inserted.id} for Day ${dayNumber} (date: ${planDateStr}, workouts: [${workoutNames}], is_completed: false)`);
          
          createdOrUpdated.push(dailyPlan);
        }
      } catch (e) {
        console.error(`❌ Error processing daily plan for assignment ${assignmentId}:`, e);
        // Continue with next plan
      }
    }
    
    console.log(`✅ Synced ${createdOrUpdated.length} daily plans from assignment ${assignmentId}`);
    console.log(`📊 Validation: Expected ${expectedDays} days, created ${createdOrUpdated.length} daily plans`);
    
    // Validate that we didn't create more days than expected
    if (createdOrUpdated.length > expectedDays) {
      console.error(`❌ ERROR: Created ${createdOrUpdated.length} daily plans but expected only ${expectedDays} days!`);
    } else if (createdOrUpdated.length < expectedDays) {
      console.warn(`⚠️ WARNING: Created ${createdOrUpdated.length} daily plans but expected ${expectedDays} days. Some days may have been skipped.`);
    } else {
      console.log(`✅ SUCCESS: Created exactly ${expectedDays} daily plans (Day 1 to Day ${expectedDays})`);
    }
    
    return createdOrUpdated;
  } catch (error) {
    console.error(`❌ Error syncing daily plans from assignment ${assignmentId}:`, error);
    throw error;
  }
}

/**
 * Sync daily plans from assignment - API endpoint
 * For assigned plans only (not manual or AI-generated)
 */
exports.syncDailyPlansFromAssignment = async (req, res, next) => {
  try {
    const { assignment_id } = req.body;
    const user_id = req.user.id;
    
    if (!assignment_id) {
      return res.status(400).json({
        success: false,
        message: 'assignment_id is required'
      });
    }
    
    // Verify assignment belongs to user (or user is admin/trainer)
    const assignment = await db('training_plan_assignments')
      .where({ id: assignment_id })
      .first();
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }
    
    // Check permissions (user can only sync their own assignments, unless admin/trainer)
    if (req.user.role !== 'gym_admin' && req.user.role !== 'trainer' && assignment.user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to sync this assignment'
      });
    }
    
    const dailyPlans = await syncDailyPlansFromAssignmentHelper(assignment_id);
    
    res.json({
      success: true,
      message: `Synced ${dailyPlans.length} daily plans from assignment`,
      data: dailyPlans
    });
  } catch (err) {
    console.error('Error syncing daily plans from assignment:', err);
    next(err);
  }
};

/**
 * Sync daily plans from manual training plan
 * Reads daily_plans from app_manual_training_plans and creates/updates entries in daily_training_plans
 * @param {number} manualPlanId - ID of the manual training plan
 * @returns {Promise<Array>} Array of created/updated daily plans
 */
async function syncDailyPlansFromManualPlanHelper(manualPlanId) {
  try {
    console.log(`🔄 Syncing daily plans from manual plan ${manualPlanId}`);
    
    // Get the manual plan
    const manualPlan = await db('app_manual_training_plans')
      .where({ id: manualPlanId })
      .first();
    
    if (!manualPlan) {
      console.error(`❌ Manual plan ${manualPlanId} not found`);
      return [];
    }
    
    // Check if manual plan has daily_plans
    let dailyPlans = null;
    if (manualPlan.daily_plans) {
      try {
        dailyPlans = typeof manualPlan.daily_plans === 'string'
          ? JSON.parse(manualPlan.daily_plans)
          : manualPlan.daily_plans;
      } catch (e) {
        console.error(`❌ Error parsing daily_plans for manual plan ${manualPlanId}:`, e);
      }
    }
    
    // If no daily_plans, try to generate from items using distribution logic
    if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) {
      console.log(`⚠️ Manual plan ${manualPlanId} has no daily_plans, generating from items...`);
      
      // Get plan items
      const planItems = await db('app_manual_training_plan_items')
        .where({ plan_id: manualPlanId })
        .orderBy('id', 'asc');
      
      if (planItems.length === 0) {
        console.log(`⚠️ Manual plan ${manualPlanId} has no items to distribute`);
        return [];
      }
      
      // Convert items to format expected by distribution
      const items = planItems.map(item => ({
        workout_name: item.workout_name,
        sets: item.sets,
        reps: item.reps,
        weight_kg: item.weight_kg,
        weight_min_kg: item.weight_min_kg,
        weight_max_kg: item.weight_max_kg,
        minutes: item.minutes,
        exercise_types: item.exercise_types,
        user_level: item.user_level
      }));
      
      // Generate daily plans using distribution logic
      const { createDistributedPlan } = require('../utils/exerciseDistribution');
      const distributedPlan = createDistributedPlan(
        { items },
        new Date(manualPlan.start_date),
        new Date(manualPlan.end_date)
      );
      dailyPlans = distributedPlan.daily_plans;
      
      // Save generated daily_plans back to manual plan for future use
      if (Array.isArray(dailyPlans) && dailyPlans.length > 0) {
        await db('app_manual_training_plans')
          .where({ id: manualPlanId })
          .update({ daily_plans: JSON.stringify(dailyPlans) });
        console.log(`✅ Generated and saved ${dailyPlans.length} daily plans to manual plan ${manualPlanId}`);
      }
    }
    
    if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) {
      console.log(`⚠️ Manual plan ${manualPlanId} has empty or invalid daily_plans`);
      return [];
    }
    
    console.log(`📊 Found ${dailyPlans.length} daily plans in manual plan ${manualPlanId}`);
    
    // IMPORTANT: Check last completed date and start from next day
    // Find the last completed daily plan for this manual plan (by plan_date, not completed_at)
    // This ensures we skip days that are already completed and start from the next day
    const lastCompletedPlan = await db('daily_training_plans')
      .where({
        user_id: manualPlan.user_id,
        source_plan_id: manualPlan.id.toString(),
        plan_type: 'manual',
        is_stats_record: false,
        is_completed: true
      })
      .whereNotNull('completed_at')
      .whereNotNull('plan_date')
      .modify((qb) => { 
        if (manualPlan.gym_id != null) {
          qb.andWhere({ gym_id: manualPlan.gym_id });
        }
      })
      .orderBy('plan_date', 'desc')
      .first();
    
    let lastCompletedDate = null;
    if (lastCompletedPlan && lastCompletedPlan.plan_date) {
      // Use plan_date (the scheduled date) to determine which day was last completed
      const planDate = new Date(lastCompletedPlan.plan_date);
      planDate.setHours(0, 0, 0, 0);
      lastCompletedDate = planDate.toISOString().split('T')[0];
      console.log(`📅 Last completed day for manual plan ${manualPlanId}: ${lastCompletedDate} (plan_date from plan ${lastCompletedPlan.id}), will start from next day`);
    } else {
      console.log(`📅 No completed plans found for manual plan ${manualPlanId}, will start from first day`);
    }
    
    const createdOrUpdated = [];
    
    // Process each daily plan
    for (const dayPlan of dailyPlans) {
      try {
        // Extract date from dayPlan
        let planDate = null;
        if (dayPlan.date) {
          planDate = new Date(dayPlan.date).toISOString().split('T')[0];
        } else if (dayPlan.plan_date) {
          planDate = new Date(dayPlan.plan_date).toISOString().split('T')[0];
        } else {
          console.warn(`⚠️ Daily plan missing date, skipping:`, dayPlan);
          continue;
        }
        
        // Extract exercises/workouts from dayPlan
        let exercises = [];
        if (Array.isArray(dayPlan.workouts)) {
          exercises = dayPlan.workouts;
        } else if (Array.isArray(dayPlan.exercises)) {
          exercises = dayPlan.exercises;
        } else if (Array.isArray(dayPlan.items)) {
          exercises = dayPlan.items;
        } else if (Array.isArray(dayPlan)) {
          exercises = dayPlan;
        }
        
        if (exercises.length === 0) {
          console.warn(`⚠️ Daily plan for ${planDate} has no exercises, skipping`);
          continue;
        }
        
        // IMPORTANT: Skip days that are already completed (before or on lastCompletedDate)
        // Only create/update plans for days AFTER the last completed date
        if (lastCompletedDate && planDate <= lastCompletedDate) {
          console.log(`⏭️ Skipping day ${planDate} - already completed (last completed: ${lastCompletedDate})`);
          continue;
        }
        
        // Check if daily plan already exists
        const existing = await db('daily_training_plans')
          .where({
            user_id: manualPlan.user_id,
            plan_date: planDate,
            source_plan_id: manualPlan.id.toString(),
            plan_type: 'manual',
            is_stats_record: false
          })
          .modify((qb) => { 
            if (manualPlan.gym_id != null) {
              qb.andWhere({ gym_id: manualPlan.gym_id });
            }
          })
          .first();
        
        let dailyPlan;
        if (existing) {
          // Update existing plan with latest data from manual plan
          const [updated] = await db('daily_training_plans')
            .where({ id: existing.id })
            .update({
              exercises_details: JSON.stringify(exercises),
              plan_category: manualPlan.exercise_plan_category || dayPlan.category || 'General',
              user_level: dayPlan.user_level || manualPlan.user_level || 'Beginner',
              updated_at: new Date()
            })
            .returning('*');
          dailyPlan = updated;
          console.log(`✅ Updated daily plan ${existing.id} for date ${planDate}`);
        } else {
          // Create new daily plan
          const [inserted] = await db('daily_training_plans')
            .insert({
              user_id: manualPlan.user_id,
              gym_id: manualPlan.gym_id,
              plan_date: planDate,
              plan_type: 'manual',
              source_plan_id: manualPlan.id.toString(),
              plan_category: manualPlan.exercise_plan_category || dayPlan.category || 'General',
              user_level: dayPlan.user_level || manualPlan.user_level || 'Beginner',
              exercises_details: JSON.stringify(exercises),
              is_stats_record: false
            })
            .returning('*');
          dailyPlan = inserted;
          console.log(`✅ Created daily plan ${inserted.id} for date ${planDate}`);
        }
        
        createdOrUpdated.push(dailyPlan);
      } catch (e) {
        console.error(`❌ Error processing daily plan for manual plan ${manualPlanId}:`, e);
        // Continue with next plan
      }
    }
    
    console.log(`✅ Synced ${createdOrUpdated.length} daily plans from manual plan ${manualPlanId}`);
    return createdOrUpdated;
  } catch (error) {
    console.error(`❌ Error syncing daily plans from manual plan ${manualPlanId}:`, error);
    throw error;
  }
}

/**
 * Sync daily plans from AI generated plan
 * Reads exercises_details from app_ai_generated_plans, generates daily_plans using distribution, and creates/updates entries in daily_training_plans
 * @param {number} aiPlanId - ID of the AI generated plan
 * @returns {Promise<Array>} Array of created/updated daily plans
 */
async function syncDailyPlansFromAIPlanHelper(aiPlanId) {
  try {
    console.log(`🔄 Syncing daily plans from AI plan ${aiPlanId}`);
    
    // Get the AI plan
    const aiPlan = await db('app_ai_generated_plans')
      .where({ id: aiPlanId })
      .first();
    
    if (!aiPlan) {
      console.error(`❌ AI plan ${aiPlanId} not found`);
      return [];
    }
    
    // Check if AI plan has daily_plans column (preferred source)
    let dailyPlans = null;
    if (aiPlan.daily_plans) {
      try {
        dailyPlans = typeof aiPlan.daily_plans === 'string'
          ? JSON.parse(aiPlan.daily_plans)
          : aiPlan.daily_plans;
      } catch (e) {
        console.error(`❌ Error parsing daily_plans for AI plan ${aiPlanId}:`, e);
      }
    }
    
    // If no daily_plans, try to generate from items using distribution logic
    if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) {
      console.log(`⚠️ AI plan ${aiPlanId} has no daily_plans, generating from items...`);
      
      // Get plan items
      let items = [];
      
      // First, try to get items from exercises_details JSON column
      if (aiPlan.exercises_details) {
        try {
          const exercisesDetails = typeof aiPlan.exercises_details === 'string'
            ? JSON.parse(aiPlan.exercises_details)
            : aiPlan.exercises_details;
          
          if (Array.isArray(exercisesDetails)) {
            items = exercisesDetails;
          }
        } catch (e) {
          console.warn(`⚠️ Error parsing exercises_details for AI plan ${aiPlanId}:`, e);
        }
      }
      
      // If no items from exercises_details, get from plan_items table
      if (items.length === 0) {
        const planItems = await db('app_ai_generated_plan_items')
          .where({ plan_id: aiPlanId })
          .orderBy('id', 'asc');
        
        items = planItems.map(item => ({
          workout_name: item.workout_name,
          sets: item.sets,
          reps: item.reps,
          weight_kg: item.weight_kg,
          weight_min_kg: item.weight_min_kg,
          weight_max_kg: item.weight_max_kg,
          minutes: item.minutes,
          exercise_types: item.exercise_types,
          user_level: item.user_level || aiPlan.user_level
        }));
      }
      
      if (items.length === 0) {
        console.log(`⚠️ AI plan ${aiPlanId} has no items to distribute`);
        return [];
      }
      
      // Generate daily plans using distribution logic
      const { createDistributedPlan } = require('../utils/exerciseDistribution');
      const distributedPlan = createDistributedPlan(
        { items },
        new Date(aiPlan.start_date),
        new Date(aiPlan.end_date)
      );
      dailyPlans = distributedPlan.daily_plans;
      
      // Save generated daily_plans back to AI plan for future use
      if (Array.isArray(dailyPlans) && dailyPlans.length > 0) {
        await db('app_ai_generated_plans')
          .where({ id: aiPlanId })
          .update({ daily_plans: JSON.stringify(dailyPlans) });
        console.log(`✅ Generated and saved ${dailyPlans.length} daily plans to AI plan ${aiPlanId}`);
      }
    }
    
    if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) {
      console.log(`⚠️ AI plan ${aiPlanId} has empty or invalid daily_plans`);
      return [];
    }
    
    console.log(`📊 Found ${dailyPlans.length} daily plans in AI plan ${aiPlanId}`);
    
    const createdOrUpdated = [];
    
    // Process each daily plan
    for (const dayPlan of dailyPlans) {
      try {
        // Extract date from dayPlan
        let planDate = null;
        if (dayPlan.date) {
          planDate = new Date(dayPlan.date).toISOString().split('T')[0];
        } else if (dayPlan.plan_date) {
          planDate = new Date(dayPlan.plan_date).toISOString().split('T')[0];
        } else {
          console.warn(`⚠️ Daily plan missing date, skipping:`, dayPlan);
          continue;
        }
        
        // Extract exercises/workouts from dayPlan
        let exercises = [];
        if (Array.isArray(dayPlan.workouts)) {
          exercises = dayPlan.workouts;
        } else if (Array.isArray(dayPlan.exercises)) {
          exercises = dayPlan.exercises;
        } else if (Array.isArray(dayPlan.items)) {
          exercises = dayPlan.items;
        } else if (Array.isArray(dayPlan)) {
          exercises = dayPlan;
        }
        
        if (exercises.length === 0) {
          console.warn(`⚠️ Daily plan for ${planDate} has no exercises, skipping`);
          continue;
        }
        
        // Check if daily plan already exists
        const existing = await db('daily_training_plans')
          .where({
            user_id: aiPlan.user_id,
            plan_date: planDate,
            source_plan_id: aiPlan.id.toString(),
            plan_type: 'ai_generated',
            is_stats_record: false
          })
          .modify((qb) => { 
            if (aiPlan.gym_id != null) {
              qb.andWhere({ gym_id: aiPlan.gym_id });
            }
          })
          .first();
        
        let dailyPlan;
        if (existing) {
          // Update existing plan with latest data from AI plan
          const [updated] = await db('daily_training_plans')
            .where({ id: existing.id })
            .update({
              exercises_details: JSON.stringify(exercises),
              plan_category: aiPlan.exercise_plan_category || dayPlan.category || 'General',
              user_level: dayPlan.user_level || aiPlan.user_level || 'Beginner',
              updated_at: new Date()
            })
            .returning('*');
          dailyPlan = updated;
          console.log(`✅ Updated daily plan ${existing.id} for date ${planDate}`);
        } else {
          // Create new daily plan
          const [inserted] = await db('daily_training_plans')
            .insert({
              user_id: aiPlan.user_id,
              gym_id: aiPlan.gym_id,
              plan_date: planDate,
              plan_type: 'ai_generated',
              source_plan_id: aiPlan.id.toString(),
              plan_category: aiPlan.exercise_plan_category || dayPlan.category || 'General',
              user_level: dayPlan.user_level || aiPlan.user_level || 'Beginner',
              exercises_details: JSON.stringify(exercises),
              is_stats_record: false
            })
            .returning('*');
          dailyPlan = inserted;
          console.log(`✅ Created daily plan ${inserted.id} for date ${planDate}`);
        }
        
        createdOrUpdated.push(dailyPlan);
      } catch (e) {
        console.error(`❌ Error processing daily plan for AI plan ${aiPlanId}:`, e);
        // Continue with next plan
      }
    }
    
    console.log(`✅ Synced ${createdOrUpdated.length} daily plans from AI plan ${aiPlanId}`);
    return createdOrUpdated;
  } catch (error) {
    console.error(`❌ Error syncing daily plans from AI plan ${aiPlanId}:`, error);
    throw error;
  }
}

/**
 * Sync daily plans from manual plan - API endpoint
 * For manual plans only
 */
exports.syncDailyPlansFromManualPlan = async (req, res, next) => {
  try {
    const { manual_plan_id } = req.body;
    const user_id = req.user.id;
    
    if (!manual_plan_id) {
      return res.status(400).json({
        success: false,
        message: 'manual_plan_id is required'
      });
    }
    
    // Verify manual plan belongs to user (or user is admin/trainer)
    const manualPlan = await db('app_manual_training_plans')
      .where({ id: manual_plan_id })
      .first();
    
    if (!manualPlan) {
      return res.status(404).json({
        success: false,
        message: 'Manual plan not found'
      });
    }
    
    // Check permissions (user can only sync their own plans, unless admin/trainer)
    if (req.user.role !== 'gym_admin' && req.user.role !== 'trainer' && manualPlan.user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to sync this plan'
      });
    }
    
    const dailyPlans = await syncDailyPlansFromManualPlanHelper(manual_plan_id);
    
    res.json({
      success: true,
      message: `Synced ${dailyPlans.length} daily plans from manual plan`,
      data: dailyPlans
    });
  } catch (err) {
    console.error('Error syncing daily plans from manual plan:', err);
    next(err);
  }
};

/**
 * Sync daily plans from AI plan - API endpoint
 * For AI generated plans only
 */
exports.syncDailyPlansFromAIPlan = async (req, res, next) => {
  try {
    const { ai_plan_id } = req.body;
    const user_id = req.user.id;
    
    if (!ai_plan_id) {
      return res.status(400).json({
        success: false,
        message: 'ai_plan_id is required'
      });
    }
    
    // Verify AI plan belongs to user (or user is admin/trainer)
    const aiPlan = await db('app_ai_generated_plans')
      .where({ id: ai_plan_id })
      .first();
    
    if (!aiPlan) {
      return res.status(404).json({
        success: false,
        message: 'AI plan not found'
      });
    }
    
    // Check permissions (user can only sync their own plans, unless admin/trainer)
    if (req.user.role !== 'gym_admin' && req.user.role !== 'trainer' && aiPlan.user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to sync this plan'
      });
    }
    
    const dailyPlans = await syncDailyPlansFromAIPlanHelper(ai_plan_id);
    
    res.json({
      success: true,
      message: `Synced ${dailyPlans.length} daily plans from AI plan`,
      data: dailyPlans
    });
  } catch (err) {
    console.error('Error syncing daily plans from AI plan:', err);
    next(err);
  }
};

// Export the helper functions for use in other controllers
exports.syncDailyPlansFromAssignmentHelper = syncDailyPlansFromAssignmentHelper;
exports.syncDailyPlansFromManualPlanHelper = syncDailyPlansFromManualPlanHelper;
exports.syncDailyPlansFromAIPlanHelper = syncDailyPlansFromAIPlanHelper;
