const db = require('../config/db');

// Helper function to parse weight_kg string ranges like "20-40" into min, max, and average
function parseWeightRange(weightValue) {
  if (!weightValue) return { weight_kg: 0, weight_min_kg: null, weight_max_kg: null };
  
  // If it's already a number, return as is
  if (typeof weightValue === 'number' || (!isNaN(weightValue) && !weightValue.includes('-'))) {
    const num = Number(weightValue);
    return { 
      weight_kg: num, 
      weight_min_kg: null, 
      weight_max_kg: null 
    };
  }
  
  // If it's a string range like "20-40", parse it
  if (typeof weightValue === 'string' && weightValue.includes('-')) {
    const parts = weightValue.split('-').map(p => p.trim()).filter(p => p);
    if (parts.length === 2) {
      const min = Number(parts[0]);
      const max = Number(parts[1]);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        const avg = Math.round(((min + max) / 2) * 100) / 100;
        return { 
          weight_kg: avg, 
          weight_min_kg: min, 
          weight_max_kg: max 
        };
      }
    }
  }
  
  // Fallback: try to parse as number
  const num = Number(weightValue);
  return { 
    weight_kg: Number.isFinite(num) ? num : 0, 
    weight_min_kg: null, 
    weight_max_kg: null 
  };
}

const { createDistributedPlan } = require('../utils/exerciseDistribution');
const { getUserProgressForPlan, smartUpdateMobilePlanItems } = require('../utils/smartPlanUpdates');

// List training plans (scoped to gym)
exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category } = req.query;
    const query = db('training_plans')
      .where({ gym_id: req.user.gym_id })
      .orderBy('created_at', 'desc');

    if (status) query.andWhere('status', status);
    if (category) query.andWhere('category', category);

    const rows = await query.limit(limit).offset((page - 1) * limit);
    const [{ count }] = await db('training_plans').where({ gym_id: req.user.gym_id }).count('* as count');

    res.json({ success: true, data: rows, pagination: { page: Number(page), limit: Number(limit), total: Number(count) } });
  } catch (err) { next(err); }
};

// Create training plan
exports.create = async (req, res, next) => {
  try {
    console.log('=== CREATE PLAN REQUEST ===');
    console.log('Request body:', req.body);
    console.log('Workout name from request:', req.body.workout_name);
    console.log('Category from request:', req.body.category);
    console.log('Exercises details from request:', req.body.exercises_details);
    console.log('User from request:', req.user);
    console.log('Gym ID from request:', req.user?.gym_id);
    
    // Check if user is authenticated
    if (!req.user) {
      console.error('No user found in request - authentication failed');
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    
    if (!req.user.gym_id) {
      console.error('No gym_id found in user object');
      return res.status(400).json({ success: false, message: 'Gym ID is required' });
    }
    
    const {
      trainer_id,
      user_id,
      start_date,
      end_date,
      category,
      workout_name,
      total_workouts,
      total_exercises,
      training_minutes,
      sets,
      reps,
      weight_kg,
      status,
      assign_to,
      exercises_details,
      user_level,
      // New payload support
      exercise_plan_category,
    } = req.body;
    
    // Get items separately as let since we'll need to modify it
    let items = req.body.items;
    
    console.log('Items received:', items ? JSON.stringify(items, null, 2) : 'No items');
    console.log('Items type:', Array.isArray(items) ? 'Array' : typeof items);
    console.log('Items length:', Array.isArray(items) ? items.length : 'N/A');

    // Backward + new payload compatibility
    const resolvedCategory = exercise_plan_category || category;

    // If items are provided (new payload), normalize them to exercises_details shape
    let normalizedExercisesDetails = exercises_details;
    let computedWorkoutName = workout_name;
    let computedTotalWorkouts = total_workouts;
    let computedTrainingMinutes = training_minutes;
    let computedSets = sets;
    let computedReps = reps;
    let computedWeightKg = weight_kg;
    let computedTotalExercises = total_exercises;
    let computedDailyPlans = null; // Initialize daily_plans

    // Filter out empty objects from items array
    if (Array.isArray(items)) {
      const beforeFilter = items.length;
      items = items.filter(it => {
        // Keep item if it has at least one meaningful property
        if (!it || typeof it !== 'object') return false;
        const hasData = it.name || it.workout_name || it.sets || it.reps || it.weight_kg || it.weight || it.minutes || it.training_minutes;
        return hasData;
      });
      console.log(`Items after filtering empty objects: ${items.length} (was ${beforeFilter})`);
      
      // If all items were filtered out (all empty objects), treat as empty
      if (items.length === 0 && beforeFilter > 0) {
        console.log('All items were empty objects, will use exercises_details instead');
        items = [];
      }
    }

    // If items array is empty or not provided, but exercises_details exists, parse it
    // This is the primary source when frontend sends empty objects in items array
    if ((!items || !Array.isArray(items) || items.length === 0) && exercises_details) {
      try {
        let parsed;
        if (typeof exercises_details === 'string') {
          parsed = JSON.parse(exercises_details);
        } else if (Array.isArray(exercises_details)) {
          parsed = exercises_details;
        } else {
          parsed = null;
        }
        
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('Using exercises_details as items, count:', parsed.length);
          // Convert exercises_details format to items format
          items = parsed.map(ex => {
            if (!ex || typeof ex !== 'object') return null;
            return {
              workout_name: ex.name || ex.workout_name || 'Exercise',
              name: ex.name || ex.workout_name || 'Exercise',
              sets: ex.sets || 0,
              reps: ex.reps || 0,
              weight_kg: ex.weight_kg || ex.weight || 0,
              minutes: ex.minutes || ex.training_minutes || 0,
              exercise_types: ex.exercise_types || ex.exercise_type || 0
            };
          }).filter(it => it !== null); // Filter out any null entries
          console.log('Converted items from exercises_details:', items.length);
        }
      } catch (e) {
        console.error('Error parsing exercises_details:', e);
        console.error('exercises_details value:', exercises_details);
        console.error('exercises_details type:', typeof exercises_details);
      }
    }

    if (Array.isArray(items) && items.length > 0) {
      console.log('Processing items array, count:', items.length);
      const normalized = items.map((it, index) => {
        console.log(`Processing item ${index}:`, JSON.stringify(it, null, 2));
        // Handle both 'name' and 'workout_name' from frontend
        const workoutName = it.workout_name || it.name || 'Exercise';
        // Handle weight_kg as string (e.g., "20-40" or "40") or number
        const weightValue = it.weight_kg || it.weight || 0;
        // Handle minutes or training_minutes
        const minutesValue = it.minutes || it.training_minutes || 0;
        
        // Parse weight for numeric calculation (extract first number from range)
        let weightNumeric = 0;
        if (typeof weightValue === 'string') {
          if (weightValue.includes('-')) {
            // Extract first number from range like "20-40"
            weightNumeric = parseFloat(weightValue.split('-')[0].trim()) || 0;
          } else {
            // Try to parse as number
            weightNumeric = parseFloat(weightValue) || 0;
          }
        } else if (typeof weightValue === 'number') {
          weightNumeric = weightValue;
        }
        
        const row = {
          name: workoutName,
          workout_name: workoutName,
          exercise_plan_category: it.exercise_plan_category ?? resolvedCategory ?? null,
          sets: Number(it.sets || 0),
          reps: Number(it.reps || 0),
          weight: weightNumeric,
          weight_kg: weightValue, // Keep as string for ranges like "20-40"
          training_minutes: Number(minutesValue) || 0,
          minutes: Number(minutesValue) || 0,
        };
        if (it.exercise_types !== undefined && it.exercise_types !== null && it.exercise_types !== '') {
          row.exercise_types = Number(it.exercise_types) || 0;
        }
        return row;
      });

      // Create distributed plan
      try {
        console.log('Creating distributed plan with:', {
          itemsCount: normalized.length,
          startDate: start_date,
          endDate: end_date
        });
        
        // Validate dates
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid start_date or end_date');
        }
        
        if (endDate < startDate) {
          throw new Error('end_date must be after start_date');
        }
        
        const distributedPlan = createDistributedPlan(
          { items: normalized },
          startDate,
          endDate
        );

        console.log('Distributed plan created:', {
          totalDays: distributedPlan.total_days,
          dailyPlansCount: distributedPlan.daily_plans?.length || 0,
          workoutsPerDay: distributedPlan.workouts_per_day
        });

        // Store items array in exercises_details (for backward compatibility)
        normalizedExercisesDetails = JSON.stringify(normalized);
        // Store distributed daily plans in daily_plans column
        if (distributedPlan.daily_plans && Array.isArray(distributedPlan.daily_plans)) {
          try {
            computedDailyPlans = JSON.stringify(distributedPlan.daily_plans);
            console.log('Daily plans JSON length:', computedDailyPlans?.length || 0);
          } catch (jsonError) {
            console.error('Error stringifying daily_plans:', jsonError);
            // Continue without daily_plans if stringification fails
          }
        }
        
        computedWorkoutName = computedWorkoutName || normalized.map(n => n.name || n.workout_name).filter(Boolean).join(', ');
        computedTotalWorkouts = computedTotalWorkouts ?? (distributedPlan?.total_exercises || normalized.length);
        computedTrainingMinutes = computedTrainingMinutes ?? (distributedPlan?.total_training_minutes || 0);
        computedSets = computedSets ?? normalized.reduce((s, n) => s + (Number(n.sets) || 0), 0);
        computedReps = computedReps ?? normalized.reduce((s, n) => s + (Number(n.reps) || 0), 0);
        // For weight_kg, keep as string if it contains ranges, otherwise sum numeric values
        const weightSum = normalized.reduce((s, n) => {
          const w = n.weight_kg || n.weight || 0;
          if (typeof w === 'string' && w.includes('-')) {
            // For ranges, extract first number
            const num = parseFloat(w.split('-')[0]) || 0;
            return s + num;
          }
          return s + (Number(w) || 0);
        }, 0);
        computedWeightKg = computedWeightKg || (weightSum > 0 ? weightSum.toString() : '');
        computedTotalExercises = computedTotalExercises ?? (distributedPlan?.total_exercises || normalized.length);
      } catch (distError) {
        console.error('Error creating distributed plan:', distError);
        console.error('Distribution error stack:', distError.stack);
        console.error('Distribution error message:', distError.message);
        // Continue without daily_plans if distribution fails
        if (normalized && Array.isArray(normalized) && normalized.length > 0) {
          try {
            normalizedExercisesDetails = JSON.stringify(normalized);
            computedWorkoutName = computedWorkoutName || normalized.map(n => n.name || n.workout_name).filter(Boolean).join(', ');
            computedTotalWorkouts = computedTotalWorkouts ?? normalized.length;
            computedTrainingMinutes = computedTrainingMinutes ?? normalized.reduce((s, n) => s + (Number(n.training_minutes || n.minutes || 0)), 0);
            computedSets = computedSets ?? normalized.reduce((s, n) => s + (Number(n.sets) || 0), 0);
            computedReps = computedReps ?? normalized.reduce((s, n) => s + (Number(n.reps) || 0), 0);
            computedTotalExercises = computedTotalExercises ?? normalized.length;
          } catch (normalizeError) {
            console.error('Error normalizing data after distribution failure:', normalizeError);
          }
        }
        // Don't fail the entire request if distribution fails
      }
    }

    // If exercises_details exists but no items were provided, try to generate daily_plans from it
    if (!computedDailyPlans && (normalizedExercisesDetails || exercises_details)) {
      try {
        const parsed = JSON.parse(normalizedExercisesDetails || exercises_details);
        // If it's an array of items, generate daily_plans
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check if it has workout_name or name (items format)
          if (parsed[0].workout_name || parsed[0].name) {
            // Normalize items to have both name and workout_name
            const normalizedItems = parsed.map(item => ({
              ...item,
              name: item.name || item.workout_name,
              workout_name: item.workout_name || item.name
            }));
            
            const distributedPlan = createDistributedPlan(
              { items: normalizedItems },
              new Date(start_date),
              new Date(end_date)
            );
            if (distributedPlan.daily_plans && Array.isArray(distributedPlan.daily_plans)) {
              computedDailyPlans = JSON.stringify(distributedPlan.daily_plans);
            }
          }
          // If it's already daily_plans format, use it directly
          else if (parsed[0].date) {
            computedDailyPlans = JSON.stringify(parsed);
          }
        }
      } catch (e) {
        console.error('Error generating daily_plans from exercises_details:', e);
        // If parsing fails, continue without daily_plans
      }
    }

    if (!start_date || !end_date || !resolvedCategory) {
      return res.status(400).json({ success: false, message: 'start_date, end_date, category are required' });
    }
    
    // Generate workout name from items if not provided
    if (!computedWorkoutName) {
      // Try to get workout name from items array
      if (Array.isArray(items) && items.length > 0) {
        const names = items.map(it => it.name || it.workout_name).filter(Boolean);
        if (names.length > 0) {
          computedWorkoutName = names.join(', ');
          console.log('Generated workout name from items:', computedWorkoutName);
        }
      }
      
      // Try to get workout name from normalizedExercisesDetails
      if (!computedWorkoutName && normalizedExercisesDetails) {
        try {
          const parsed = typeof normalizedExercisesDetails === 'string' 
            ? JSON.parse(normalizedExercisesDetails) 
            : normalizedExercisesDetails;
          if (Array.isArray(parsed) && parsed.length > 0) {
            const names = parsed.map(n => n.name || n.workout_name).filter(Boolean);
            if (names.length > 0) {
              computedWorkoutName = names.join(', ');
              console.log('Generated workout name from normalizedExercisesDetails:', computedWorkoutName);
            }
          }
        } catch (e) {
          console.error('Error parsing exercises_details for workout name:', e);
        }
      }
      
      // Try to get workout name from exercises_details
      if (!computedWorkoutName && exercises_details) {
        try {
          const parsed = typeof exercises_details === 'string' 
            ? JSON.parse(exercises_details) 
            : exercises_details;
          if (Array.isArray(parsed) && parsed.length > 0) {
            const names = parsed.map(n => n.name || n.workout_name).filter(Boolean);
            if (names.length > 0) {
              computedWorkoutName = names.join(', ');
              console.log('Generated workout name from exercises_details:', computedWorkoutName);
            }
          }
        } catch (e) {
          console.error('Error parsing exercises_details for workout name:', e);
        }
      }
    }
    
    if (!computedWorkoutName) {
      return res.status(400).json({ 
        success: false, 
        message: 'workout_name is required (or provide items/exercises_details with workout_name/name)' 
      });
    }

    // Ensure all numeric fields are properly converted to integers
    const planData = {
      gym_id: req.user.gym_id,
      trainer_id: trainer_id ? parseInt(trainer_id) : req.user.id,
      user_id: user_id ? parseInt(user_id) : null,
      start_date,
      end_date,
      category: resolvedCategory,
      workout_name: computedWorkoutName,
      total_workouts: parseInt(computedTotalWorkouts ?? 0) || 0,
      total_exercises: parseInt(computedTotalExercises ?? 0) || 0,
      training_minutes: parseInt(computedTrainingMinutes ?? 0) || 0,
      sets: parseInt(computedSets ?? 0) || 0,
      reps: parseInt(computedReps ?? 0) || 0,
      weight_kg: computedWeightKg ? String(computedWeightKg) : '0',
      // exercise_types was removed from training_plans table - it's now stored in exercises_details JSON
      status: status ?? 'PLANNED',
      assign_to: assign_to ? parseInt(assign_to) : null,
      exercises_details: normalizedExercisesDetails ?? exercises_details ?? null,
      daily_plans: computedDailyPlans || null, // Store distributed daily plans (nullable)
      user_level: user_level ?? 'Beginner',
    };
    
    // Validate planData before insert
    if (!planData.gym_id) {
      return res.status(400).json({ success: false, message: 'Gym ID is required' });
    }
    if (!planData.workout_name) {
      return res.status(400).json({ success: false, message: 'Workout name is required' });
    }

    console.log('Inserting plan data:', planData);
    console.log('Exercises details being inserted:', planData.exercises_details);
    console.log('Workout name being inserted:', planData.workout_name);
    console.log('Gym ID being inserted:', planData.gym_id);
    console.log('Trainer ID being inserted:', planData.trainer_id);

    console.log('About to insert plan data into database...');
    console.log('Daily plans being inserted:', computedDailyPlans ? 'Yes' : 'No');
    console.log('Plan data keys:', Object.keys(planData));
    let plan;
    try {
      [plan] = await db('training_plans')
        .insert(planData)
        .returning('*');
      console.log('Plan inserted successfully:', plan);
    } catch (dbError) {
      console.error('Database insert error:', dbError);
      console.error('Error details:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        constraint: dbError.constraint,
        table: dbError.table
      });
      console.error('Plan data that failed to insert:', JSON.stringify(planData, null, 2));
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to create training plan',
        error: dbError.message || 'Database error',
        details: dbError.detail || null
      });
    }

    // Mirror to Mobile App tables so it appears in the app immediately
    try {
      // Derive items array from provided items or exercises_details JSON
      let mobileItems = Array.isArray(items) ? items : [];
      if ((!mobileItems || mobileItems.length === 0) && (normalizedExercisesDetails || exercises_details)) {
        try {
          const parsed = JSON.parse(normalizedExercisesDetails || exercises_details);
          if (Array.isArray(parsed)) {
            mobileItems = parsed.map((ex) => {
              // Parse weight range from string like "20-40" or separate min/max fields
              const weightRange = parseWeightRange(ex.weight_kg ?? ex.weight);
              return {
                workout_name: ex.name || ex.workout_name,
                exercise_plan_category: resolvedCategory || null,
                exercise_types: ex.exercise_types ?? null,
                sets: ex.sets || 0,
                reps: ex.reps || 0,
                weight_kg: weightRange.weight_kg,
                weight_min_kg: ex.weight_min_kg ?? weightRange.weight_min_kg,
                weight_max_kg: ex.weight_max_kg ?? weightRange.weight_max_kg,
                minutes: ex.training_minutes ?? ex.minutes ?? 0,
              };
            });
          }
        } catch (_) { /* swallow JSON parse errors for mirror */ }
      }

      // Only create a mobile plan if we at least know category and dates
      let mobilePlan;
      try {
        [mobilePlan] = await db('app_manual_training_plans')
          .insert({
            user_id: user_id ? parseInt(user_id) : null,
            gym_id: req.user?.gym_id ?? null,
            exercise_plan_category: resolvedCategory,
            start_date,
            end_date,
            total_workouts: parseInt(computedTotalWorkouts ?? 0) || 0,
            total_exercises: parseInt(computedTotalExercises ?? (mobileItems?.length || 0)) || 0,
            training_minutes: parseInt(computedTrainingMinutes ?? 0) || 0,
            web_plan_id: plan.id,
          })
          .returning('*');
      } catch (mobileInsertError) {
        console.error('Error inserting mobile plan:', mobileInsertError);
        console.error('Mobile plan insert error details:', {
          message: mobileInsertError.message,
          code: mobileInsertError.code,
          detail: mobileInsertError.detail,
          constraint: mobileInsertError.constraint
        });
        // Continue without mobile plan if insert fails
        mobilePlan = null;
      }

      if (mobilePlan && Array.isArray(mobileItems) && mobileItems.length > 0) {
        try {
          const rows = mobileItems.map((it) => {
            // Weight ranges are already parsed by parseWeightRange helper above
            return {
              plan_id: mobilePlan.id,
              workout_name: it.workout_name,
              exercise_plan_category: it.exercise_plan_category || resolvedCategory || null,
              exercise_types: it.exercise_types || null,
              sets: Number(it.sets || 0),
              reps: Number(it.reps || 0),
              weight_kg: Number(it.weight_kg || 0),
              weight_min_kg: it.weight_min_kg != null ? Number(it.weight_min_kg) : null,
              weight_max_kg: it.weight_max_kg != null ? Number(it.weight_max_kg) : null,
              minutes: Number(it.minutes || 0),
              user_level: it.user_level || 'Beginner',
            };
          });
          if (rows.length) {
            await db('app_manual_training_plan_items').insert(rows);
            console.log(`✅ Inserted ${rows.length} mobile plan items`);
          }
        } catch (itemsInsertError) {
          console.error('Error inserting mobile plan items:', itemsInsertError);
          console.error('Items insert error details:', {
            message: itemsInsertError.message,
            code: itemsInsertError.code,
            detail: itemsInsertError.detail
          });
          // Continue even if items insert fails
        }
      }
    } catch (mirrorErr) {
      // Log and continue; we don't want to block web success if mobile mirror fails
      console.error('Mobile plan mirror failed:', mirrorErr?.message || mirrorErr);
    }

    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    console.error('=== CREATE PLAN ERROR ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Error details:', {
      name: err.name,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint,
      table: err.table
    });
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    console.error('User:', JSON.stringify(req.user, null, 2));
    
    // Return error response instead of passing to next() to get better error details
    return res.status(500).json({
      success: false,
      message: 'Failed to create training plan',
      error: err.message || 'Unknown error',
      details: err.detail || null,
      error_code: err.code || null,
      constraint: err.constraint || null,
      table: err.table || null,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// Get single plan
exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await db('training_plans').where({ id, gym_id: req.user.gym_id }).first();
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
};

// Update plan
exports.update = async (req, res, next) => {
  try {
    console.log('Update request received:', req.params, req.body);
    console.log('Exercises details in request:', req.body.exercises_details);
    console.log('Exercises details type:', typeof req.body.exercises_details);
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.gym_id;
    const itemsPayload = Array.isArray(updateData.items) ? [...updateData.items] : null;
    delete updateData.items;

    const existingPlan = await db('training_plans')
      .where({ id, gym_id: req.user.gym_id })
      .first();

    if (!existingPlan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    
    // Ensure trainer_id is set from authenticated user
    if (!updateData.trainer_id && req.user.id) {
      updateData.trainer_id = req.user.id;
    }
    
    // Ensure numeric fields are properly converted
    if (updateData.trainer_id) updateData.trainer_id = parseInt(updateData.trainer_id);
    if (updateData.user_id) updateData.user_id = parseInt(updateData.user_id);
    if (updateData.total_workouts) updateData.total_workouts = parseInt(updateData.total_workouts);
    if (updateData.total_exercises) updateData.total_exercises = parseInt(updateData.total_exercises);
    if (updateData.training_minutes) updateData.training_minutes = parseInt(updateData.training_minutes);
    if (updateData.sets) updateData.sets = parseInt(updateData.sets);
    if (updateData.reps) updateData.reps = parseInt(updateData.reps);
    // Remove exercise_types from update data since it's now in exercises_details JSON
    delete updateData.exercise_types;
    // Keep weight_kg as text to support ranges like "20-40"
    // if (updateData.weight_kg) updateData.weight_kg = parseInt(updateData.weight_kg);
    if (updateData.assign_to) updateData.assign_to = parseInt(updateData.assign_to);

    const resolvedCategory = updateData.exercise_plan_category || updateData.category || existingPlan.category;
    let normalizedItems = null;

    if (Array.isArray(itemsPayload)) {
      const filteredItems = itemsPayload.filter((it) => {
        if (!it || typeof it !== 'object') return false;
        const hasData = it.name || it.workout_name || it.sets || it.reps || it.weight_kg || it.weight || it.minutes || it.training_minutes;
        return !!hasData;
      });

      if (filteredItems.length) {
        normalizedItems = filteredItems.map((it) => {
          const workoutName = it.workout_name || it.name || 'Exercise';
          const weightValue = it.weight_kg || it.weight || 0;
          const minutesValue = it.minutes || it.training_minutes || 0;
          let weightNumeric = 0;
          if (typeof weightValue === 'string') {
            if (weightValue.includes('-')) {
              weightNumeric = parseFloat(weightValue.split('-')[0].trim()) || 0;
            } else {
              weightNumeric = parseFloat(weightValue) || 0;
            }
          } else if (typeof weightValue === 'number') {
            weightNumeric = weightValue;
          }

          const row = {
            name: workoutName,
            workout_name: workoutName,
            exercise_plan_category: it.exercise_plan_category ?? resolvedCategory ?? null,
            sets: Number(it.sets || 0),
            reps: Number(it.reps || 0),
            weight: weightNumeric,
            weight_kg: weightValue,
            training_minutes: Number(minutesValue) || 0,
            minutes: Number(minutesValue) || 0,
          };

          if (it.exercise_types !== undefined && it.exercise_types !== null && it.exercise_types !== '') {
            row.exercise_types = Number(it.exercise_types) || 0;
          }

          return row;
        });
      }
    }

    if (!normalizedItems && updateData.exercises_details) {
      try {
        const parsed = typeof updateData.exercises_details === 'string'
          ? JSON.parse(updateData.exercises_details)
          : updateData.exercises_details;
        if (Array.isArray(parsed) && parsed.length) {
          normalizedItems = parsed.map((item) => {
            if (!item || typeof item !== 'object') return null;
            const workoutName = item.workout_name || item.name || 'Exercise';
            const weightValue = item.weight_kg ?? item.weight ?? 0;
            const minutesValue = item.minutes ?? item.training_minutes ?? 0;
            return {
              ...item,
              name: workoutName,
              workout_name: workoutName,
              sets: Number(item.sets || 0),
              reps: Number(item.reps || 0),
              weight_kg: weightValue,
              training_minutes: Number(minutesValue) || 0,
              minutes: Number(minutesValue) || 0,
              exercise_types: item.exercise_types ?? item.exercise_type ?? undefined,
            };
          }).filter(Boolean);
        }
      } catch (parseErr) {
        console.error('Error parsing exercises_details during update:', parseErr);
      }
    }

    if (normalizedItems && normalizedItems.length) {
      try {
        const startDateValue = updateData.start_date || existingPlan.start_date;
        const endDateValue = updateData.end_date || existingPlan.end_date;
        const startDate = startDateValue ? new Date(startDateValue) : null;
        const endDate = endDateValue ? new Date(endDateValue) : null;

        if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate >= startDate) {
          const distributedPlan = createDistributedPlan({ items: normalizedItems }, startDate, endDate);
          if (distributedPlan?.daily_plans && Array.isArray(distributedPlan.daily_plans) && distributedPlan.daily_plans.length) {
            try {
              updateData.daily_plans = JSON.stringify(distributedPlan.daily_plans);
              console.log(`✅ Regenerated ${distributedPlan.daily_plans.length} daily plans for plan ${id}`);
            } catch (jsonErr) {
              console.error('Error stringifying regenerated daily_plans:', jsonErr);
            }
          }

          if (updateData.total_workouts === undefined) {
            updateData.total_workouts = distributedPlan?.total_exercises ?? normalizedItems.length ?? 0;
          }
          if (updateData.total_exercises === undefined) {
            updateData.total_exercises = distributedPlan?.total_exercises ?? normalizedItems.length ?? 0;
          }
          if (updateData.training_minutes === undefined) {
            updateData.training_minutes = distributedPlan?.total_training_minutes
              ?? normalizedItems.reduce((sum, item) => sum + (Number(item.training_minutes || item.minutes || 0) || 0), 0);
          }
          if (updateData.sets === undefined) {
            updateData.sets = normalizedItems.reduce((sum, item) => sum + (Number(item.sets) || 0), 0);
          }
          if (updateData.reps === undefined) {
            updateData.reps = normalizedItems.reduce((sum, item) => sum + (Number(item.reps) || 0), 0);
          }
          if (updateData.weight_kg === undefined) {
            const weightSum = normalizedItems.reduce((sum, item) => {
              const w = item.weight_kg || item.weight || 0;
              if (typeof w === 'string' && w.includes('-')) {
                const num = parseFloat(w.split('-')[0]) || 0;
                return sum + num;
              }
              return sum + (Number(w) || 0);
            }, 0);
            updateData.weight_kg = weightSum > 0 ? String(weightSum) : existingPlan.weight_kg || '0';
          }
        }

        if (updateData.exercises_details === undefined || typeof updateData.exercises_details !== 'string') {
          try {
            updateData.exercises_details = JSON.stringify(normalizedItems);
          } catch (stringifyErr) {
            console.error('Error stringifying normalized items during update:', stringifyErr);
          }
        }
      } catch (distErr) {
        console.error('Error regenerating daily_plans during update:', distErr);
      }
    } else if (updateData.exercises_details && typeof updateData.exercises_details !== 'string') {
      try {
        updateData.exercises_details = JSON.stringify(updateData.exercises_details);
      } catch (stringifyErr) {
        console.error('Error stringifying exercises_details during update:', stringifyErr);
      }
    }
    
    console.log('Updating plan with data:', updateData);
    console.log('Exercises details being updated:', updateData.exercises_details);
    
    const [updated] = await db('training_plans')
      .where({ id, gym_id: req.user.gym_id })
      .update(updateData)
      .returning('*');
    if (!updated) return res.status(404).json({ success: false, message: 'Plan not found' });
    
    console.log('Updated plan result:', updated);
    
    // Mirror exercises changes to mobile items when exercises_details provided
    try {
      if (updateData.exercises_details) {
        const mobilePlans = await db('app_manual_training_plans').where({ web_plan_id: updated.id });
        if (mobilePlans && mobilePlans.length) {
          let parsed = [];
          try { parsed = JSON.parse(updateData.exercises_details); } catch (_) {}
          
          for (const mobilePlan of mobilePlans) {
            console.log(`🔄 Smart updating mobile plan ${mobilePlan.id} for user ${mobilePlan.user_id}`);
            
            // Get user's progress to determine which workouts are completed
            const userProgress = await getUserProgressForPlan(mobilePlan.user_id, mobilePlan.id);
            const today = new Date().toISOString().split('T')[0];
            
            console.log(`📊 User progress: ${userProgress.completedDays} completed days, today: ${today}`);
            
            // Only update future workouts, preserve completed ones
            await smartUpdateMobilePlanItems(mobilePlan.id, parsed, userProgress, today);
          }
        }
      }
    } catch (mirrorErr) {
      console.error('Smart update mirror to mobile failed:', mirrorErr?.message || mirrorErr);
    }
    res.json({ success: true, data: updated });
  } catch (err) { 
    console.error('Error in update method:', err);
    next(err); 
  }
};

// Delete plan
exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { unassign_only } = req.query; // Check if this is an unassign operation
    
    console.log('Delete request received:', { id, unassign_only, user_id: req.user.id });
    
    // Find plan to resolve link to mobile table
    const plan = await db('training_plans').where({ id, gym_id: req.user.gym_id }).first();
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    
  console.log('Plan found:', { id: plan.id, user_id: plan.user_id, assign_to: plan.assign_to });

  // Remove any linked assignments (and their artifacts) before deleting the plan
  const linkedAssignments = await db('training_plan_assignments')
    .where({ web_plan_id: plan.id, gym_id: req.user.gym_id });

  for (const assignment of linkedAssignments) {
    try {
      await purgeAssignmentArtifacts(assignment);
    } catch (assignmentCleanupErr) {
      console.error(`❌ Failed to purge artifacts for assignment ${assignment.id}:`, assignmentCleanupErr?.message || assignmentCleanupErr);
    }
    await db('training_plan_assignments').where({ id: assignment.id, gym_id: req.user.gym_id }).del();
  }

  // Clean any daily plans that might have been directly linked to this plan id
  try {
    const deletedDailyPlansForPlan = await db('daily_training_plans')
      .where({ is_stats_record: false })
      .where(function() {
        this.where('source_plan_id', plan.id)
            .orWhere('source_plan_id', plan.id.toString());
      })
      .modify((qb) => {
        if (plan.user_id) qb.andWhere({ user_id: plan.user_id });
        if (plan.gym_id != null) qb.andWhere({ gym_id: plan.gym_id });
      })
      .del();
    if (deletedDailyPlansForPlan) {
      console.log(`✅ Deleted ${deletedDailyPlansForPlan} direct daily plans linked to plan ${plan.id}`);
    }
  } catch (planDailyErr) {
    console.error('❌ Error deleting direct daily plans for plan:', planDailyErr?.message || planDailyErr);
  }

    if (unassign_only === 'true') {
      // If this row is a clone (assigned plan with a user_id), DELETE it entirely
      if (plan.user_id) {
        try {
          const mobilePlans = await db('app_manual_training_plans').where({ web_plan_id: plan.id });
          for (const m of mobilePlans) {
            await db('app_manual_training_plan_items').where({ plan_id: m.id }).del();
          }
          await db('app_manual_training_plans').where({ web_plan_id: plan.id }).del();
        } catch (mirrorDelErr) {
          console.error('Mobile plan delete mirror (unassign clone) failed:', mirrorDelErr?.message || mirrorDelErr);
        }
        await db('training_plans').where({ id: plan.id, gym_id: req.user.gym_id }).del();
        return res.json({ success: true, message: 'Assigned plan removed for user' });
      }

      // Otherwise, for a template (no user), only clear assign_to
      const [updated] = await db('training_plans')
        .where({ id, gym_id: req.user.gym_id })
        .update({ assign_to: null })
        .returning('*');

      // Remove any stray mobile mirrors just in case
      try {
        const mobilePlans = await db('app_manual_training_plans').where({ web_plan_id: plan.id });
        for (const m of mobilePlans) {
          await db('app_manual_training_plan_items').where({ plan_id: m.id }).del();
        }
        await db('app_manual_training_plans').where({ web_plan_id: plan.id }).del();
      } catch (mirrorDelErr) {
        console.error('Mobile plan unassign mirror-delete failed:', mirrorDelErr?.message || mirrorDelErr);
      }

      res.json({ success: true, message: 'Plan unassigned', data: updated });
    } else {
      // Full delete - remove plan and linked mobile data
      try {
        const mobilePlans = await db('app_manual_training_plans').where({ web_plan_id: plan.id });
        for (const m of mobilePlans) {
          await db('app_manual_training_plan_items').where({ plan_id: m.id }).del();
        }
        await db('app_manual_training_plans').where({ web_plan_id: plan.id }).del();
      } catch (mirrorDelErr) {
        console.error('Mobile plan delete mirror failed:', mirrorDelErr?.message || mirrorDelErr);
      }

      const deleted = await db('training_plans').where({ id, gym_id: req.user.gym_id }).del();
      res.json({ success: true, message: 'Plan deleted' });
    }
  } catch (err) { next(err); }
};

// Update status only
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'status is required' });
    const [updated] = await db('training_plans')
      .where({ id, gym_id: req.user.gym_id })
      .update({ status })
      .returning('*');
    if (!updated) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};


// Assign an existing plan to a user; allowed for trainer or gym_admin
exports.assign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, assign_to, status } = req.body;

    if (!user_id) return res.status(400).json({ success: false, message: 'user_id is required' });

    const plan = await db('training_plans').where({ id, gym_id: req.user.gym_id }).first();
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    // Authorization: trainer can only assign themselves; gym_admin can assign anyone
    const role = req.user.role;
    const resolvedAssignTo = role === 'TRAINER' ? req.user.id : (assign_to ? parseInt(assign_to) : plan.assign_to);

    // If plan is already assigned to the same user, block with informative message
    if (plan.user_id && parseInt(plan.user_id) === parseInt(user_id)) {
      // Resolve assigner name (trainer or gym admin)
      let assignedBy = 'gym admin';
      if (plan.assign_to) {
        try {
          const trainer = await db('trainers').where({ id: plan.assign_to, gym_id: req.user.gym_id }).first();
          assignedBy = trainer?.name ? `trainer ${trainer.name}` : `trainer (ID: ${plan.assign_to})`;
        } catch (_) {}
      } else {
        try {
          // Find gym admin by gym; pick any
          const admin = await db('gym_admins').where({ gym_id: req.user.gym_id }).first();
          if (admin?.name) assignedBy = `gym admin ${admin.name}`;
        } catch (_) {}
      }
      return res.status(409).json({ success: false, message: `This plan is already assigned to this user by ${assignedBy}.` });
    }

    // If plan already has a user but it's a different one, create an assignment record
    if (plan.user_id && parseInt(plan.user_id) !== parseInt(user_id)) {
      const [assignment] = await db('training_plan_assignments')
        .insert({
          gym_id: req.user.gym_id,
          web_plan_id: plan.id,
          trainer_id: resolvedAssignTo || plan.trainer_id || req.user.id,
          user_id: parseInt(user_id),
          // COPY start/end dates exactly from training plan so portal + assignment match
          start_date: plan.start_date,
          end_date: plan.end_date,
          category: plan.category,
          user_level: plan.user_level,
          status: status || plan.status || 'PLANNED',
          total_workouts: plan.total_workouts || 0,
          total_exercises: plan.total_exercises || 0,
          training_minutes: plan.training_minutes || 0,
          sets: plan.sets || 0,
          reps: plan.reps || 0,
          weight_kg: plan.weight_kg || 0,
          exercises_details: plan.exercises_details || JSON.stringify([]),
          daily_plans: plan.daily_plans || null, // Copy daily_plans from training plan
        })
        .returning('*');

      // Sync daily plans from assignment to daily_training_plans table
      // This is for assigned plans only (not manual or AI-generated)
      if (assignment.daily_plans) {
        try {
          const { syncDailyPlansFromAssignmentHelper } = require('./DailyTrainingController');
          await syncDailyPlansFromAssignmentHelper(assignment.id);
          console.log(`✅ Synced daily plans from assignment ${assignment.id} to daily_training_plans`);
        } catch (syncErr) {
          console.error('⚠️ Failed to sync daily plans from assignment:', syncErr?.message || syncErr);
          // Don't fail the assignment creation if sync fails
        }
      }

      // Mirror assignment to mobile
      try {
        const [mobilePlan] = await db('app_manual_training_plans')
          .insert({
            user_id: parseInt(user_id),
            gym_id: req.user?.gym_id ?? null,
            exercise_plan_category: assignment.category,
            start_date: assignment.start_date,
            end_date: assignment.end_date,
            total_workouts: assignment.total_workouts || 0,
            total_exercises: assignment.total_exercises || 0,
            training_minutes: assignment.training_minutes || 0,
            web_plan_id: assignment.id, // Use assignment ID for mobile link
          })
          .returning('*');

        if (assignment.exercises_details) {
          try {
            const parsed = JSON.parse(assignment.exercises_details);
            if (Array.isArray(parsed) && parsed.length) {
              const rows = parsed.map((ex) => ({
                plan_id: mobilePlan.id,
                workout_name: ex.name || ex.workout_name,
                exercise_plan_category: assignment.category || null,
                exercise_types: ex.exercise_types ?? null,
                sets: Number(ex.sets || 0),
                reps: Number(ex.reps || 0),
                weight_kg: Number(ex.weight_kg ?? ex.weight ?? 0),
                minutes: Number(ex.training_minutes ?? ex.minutes ?? 0),
                user_level: assignment.user_level || 'Beginner',
              }));
              if (rows.length) await db('app_manual_training_plan_items').insert(rows);
            }
          } catch (_) { /* swallow parse error */ }
        }
      } catch (mirrorErr) {
        console.error('Assignment mirror to mobile failed:', mirrorErr?.message || mirrorErr);
      }

      return res.status(201).json({ success: true, data: assignment, assignment: true });
    }

    // Otherwise, plan has no user yet: create assignment record
    const [assignment] = await db('training_plan_assignments')
      .insert({
        gym_id: req.user.gym_id,
        web_plan_id: plan.id,
        trainer_id: resolvedAssignTo || plan.trainer_id || req.user.id,
        user_id: parseInt(user_id),
        // COPY start/end dates exactly from training plan so portal + assignment match
        start_date: plan.start_date,
        end_date: plan.end_date,
        category: plan.category,
        user_level: plan.user_level,
        status: status || plan.status || 'PLANNED',
        total_workouts: plan.total_workouts || 0,
        total_exercises: plan.total_exercises || 0,
        training_minutes: plan.training_minutes || 0,
        sets: plan.sets || 0,
        reps: plan.reps || 0,
        weight_kg: plan.weight_kg || '0', // Keep as string to support ranges like "20-40"
        exercises_details: plan.exercises_details || JSON.stringify([]),
        daily_plans: plan.daily_plans || null, // Copy daily_plans from training plan
      })
      .returning('*');

    // Mirror assignment to mobile
    try {
      const [mobilePlan] = await db('app_manual_training_plans')
        .insert({
          user_id: parseInt(user_id),
          gym_id: req.user?.gym_id ?? null,
          exercise_plan_category: assignment.category,
          start_date: assignment.start_date,
          end_date: assignment.end_date,
          total_workouts: assignment.total_workouts || 0,
          total_exercises: assignment.total_exercises || 0,
          training_minutes: assignment.training_minutes || 0,
          web_plan_id: assignment.id, // Use assignment ID for mobile link
        })
        .returning('*');

      if (assignment.exercises_details) {
        try {
          const parsed = JSON.parse(assignment.exercises_details);
          if (Array.isArray(parsed) && parsed.length) {
            const rows = parsed.map((ex) => {
              // For assignments: Keep weight_kg as string (e.g., "20-40") in assignment table
              // But parse it for mobile app items table which has weight_min_kg and weight_max_kg columns
              const weightValue = ex.weight_kg ?? ex.weight ?? 0;
              const weightRange = parseWeightRange(weightValue);
              
              return {
                plan_id: mobilePlan.id,
                workout_name: ex.name || ex.workout_name,
                exercise_plan_category: assignment.category || null,
                exercise_types: ex.exercise_types ?? null,
                sets: Number(ex.sets || 0),
                reps: Number(ex.reps || 0),
                // For mobile app items: parse weight range into min/max for proper storage
                weight_kg: weightRange.weight_kg,
                weight_min_kg: ex.weight_min_kg ?? weightRange.weight_min_kg,
                weight_max_kg: ex.weight_max_kg ?? weightRange.weight_max_kg,
                minutes: Number(ex.training_minutes ?? ex.minutes ?? 0),
                user_level: assignment.user_level || 'Beginner',
              };
            });
            if (rows.length) await db('app_manual_training_plan_items').insert(rows);
          }
        } catch (_) { /* swallow parse error */ }
      }
    } catch (mirrorErr) {
      console.error('Assignment mirror to mobile failed:', mirrorErr?.message || mirrorErr);
    }

    // Sync daily plans from assignment to daily_training_plans table
    // This is for assigned plans only (not manual or AI-generated)
    if (assignment.daily_plans) {
      try {
        const { syncDailyPlansFromAssignmentHelper } = require('./DailyTrainingController');
        await syncDailyPlansFromAssignmentHelper(assignment.id);
        console.log(`✅ Synced daily plans from assignment ${assignment.id} to daily_training_plans`);
      } catch (syncErr) {
        console.error('⚠️ Failed to sync daily plans from assignment:', syncErr?.message || syncErr);
        // Don't fail the assignment creation if sync fails
      }
    }

    return res.status(201).json({ success: true, data: assignment, assignment: true });
  } catch (err) { next(err); }
};

// Get my assignments (for trainers) - GLOBAL: Shows all assignments for the gym
exports.getMyAssignments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, category } = req.query;
    const trainerId = req.user.id;

    // Modified: Show ALL assignments for the gym, not just specific trainer
    // This makes assignments global for all trainers in the same gym
    const query = db('training_plan_assignments')
      .where({ 
        gym_id: req.user.gym_id
        // Removed trainer_id filter to make assignments global
      })
      .orderBy('created_at', 'desc');

    if (status) query.andWhere('status', status);
    if (category) query.andWhere('category', category);

    const rows = await query.limit(limit).offset((page - 1) * limit);
    const [{ count }] = await db('training_plan_assignments')
      .where({ 
        gym_id: req.user.gym_id
        // Removed trainer_id filter to make assignments global
      })
      .count('* as count');

    // Enrich with trainer information to show who originally assigned it
    const enrichedRows = await Promise.all(rows.map(async (assignment) => {
      try {
        // Get trainer info who created this assignment
        const trainer = await db('users')
          .where({ id: assignment.trainer_id, gym_id: req.user.gym_id })
          .select('name', 'email')
          .first();
        
        return {
          ...assignment,
          assigned_by_trainer: trainer ? {
            name: trainer.name,
            email: trainer.email
          } : null
        };
      } catch (err) {
        console.error('Error fetching trainer info:', err);
        return assignment;
      }
    }));

    res.json({ 
      success: true, 
      data: enrichedRows, 
      pagination: { 
        page: Number(page), 
        limit: Number(limit), 
        total: Number(count) 
      } 
    });
  } catch (err) { next(err); }
};

// Get single assignment
exports.getAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const assignment = await db('training_plan_assignments')
      .where({ id, gym_id: req.user.gym_id })
      .first();

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    res.json({ success: true, data: assignment });
  } catch (err) { next(err); }
};

// Update assignment
exports.updateAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('=== UPDATE ASSIGNMENT DEBUG ===');
    console.log('Assignment ID:', id);
    console.log('Raw update data received:', updateData);
    console.log('User gym_id:', req.user.gym_id);

    // Check if assignment exists and belongs to this gym
    const assignment = await db('training_plan_assignments')
      .where({ id, gym_id: req.user.gym_id })
      .first();

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Filter out fields that don't exist in training_plan_assignments table
    const allowedFields = [
      'start_date', 'end_date', 'category', 'user_level', 'status',
      'total_workouts', 'total_exercises', 'training_minutes', 'sets', 'reps', 'weight_kg',
      'exercises_details'
    ];
    
    const filteredUpdateData = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredUpdateData[field] = updateData[field];
      }
    });
    
    // Remove any fields that might be causing issues
    delete filteredUpdateData.id; // Remove id field
    delete filteredUpdateData.workout_name; // Remove workout_name field
    delete filteredUpdateData.exercise_types; // Remove exercise_types field
    delete filteredUpdateData.trainer_id; // Remove trainer_id field
    delete filteredUpdateData.user_id; // Remove user_id field
    delete filteredUpdateData.gym_id; // Remove gym_id field
    delete filteredUpdateData.web_plan_id; // Remove web_plan_id field
    delete filteredUpdateData.created_at; // Remove created_at field
    delete filteredUpdateData.updated_at; // Remove updated_at field
    
    console.log('Fields being filtered:');
    console.log('Allowed fields:', allowedFields);
    console.log('Fields in updateData:', Object.keys(updateData));
    console.log('Filtered update data:', filteredUpdateData);
    
    // Ensure numeric fields are properly converted (handle empty strings)
    if (filteredUpdateData.total_workouts !== undefined) {
      filteredUpdateData.total_workouts = filteredUpdateData.total_workouts === '' ? 0 : parseInt(filteredUpdateData.total_workouts) || 0;
    }
    if (filteredUpdateData.total_exercises !== undefined) {
      filteredUpdateData.total_exercises = filteredUpdateData.total_exercises === '' ? 0 : parseInt(filteredUpdateData.total_exercises) || 0;
    }
    if (filteredUpdateData.training_minutes !== undefined) {
      filteredUpdateData.training_minutes = filteredUpdateData.training_minutes === '' ? 0 : parseInt(filteredUpdateData.training_minutes) || 0;
    }
    if (filteredUpdateData.sets !== undefined) {
      filteredUpdateData.sets = filteredUpdateData.sets === '' ? 0 : parseInt(filteredUpdateData.sets) || 0;
    }
    if (filteredUpdateData.reps !== undefined) {
      filteredUpdateData.reps = filteredUpdateData.reps === '' ? 0 : parseInt(filteredUpdateData.reps) || 0;
    }
    if (filteredUpdateData.weight_kg !== undefined) {
      filteredUpdateData.weight_kg = filteredUpdateData.weight_kg === '' ? 0 : parseFloat(filteredUpdateData.weight_kg) || 0;
    }

    // Final validation - ensure no empty strings in numeric fields
    const numericFields = ['total_workouts', 'total_exercises', 'training_minutes', 'sets', 'reps', 'weight_kg'];
    numericFields.forEach(field => {
      if (filteredUpdateData[field] === '' || filteredUpdateData[field] === null || filteredUpdateData[field] === undefined) {
        filteredUpdateData[field] = 0;
      }
    });

    console.log('Final data being sent to database:', filteredUpdateData);
    console.log('Data types check:');
    console.log('- total_workouts:', typeof filteredUpdateData.total_workouts, filteredUpdateData.total_workouts);
    console.log('- total_exercises:', typeof filteredUpdateData.total_exercises, filteredUpdateData.total_exercises);
    console.log('- training_minutes:', typeof filteredUpdateData.training_minutes, filteredUpdateData.training_minutes);
    console.log('- sets:', typeof filteredUpdateData.sets, filteredUpdateData.sets);
    console.log('- reps:', typeof filteredUpdateData.reps, filteredUpdateData.reps);
    console.log('- weight_kg:', typeof filteredUpdateData.weight_kg, filteredUpdateData.weight_kg);
    
    // Check for any remaining empty strings
    Object.keys(filteredUpdateData).forEach(key => {
      if (filteredUpdateData[key] === '') {
        console.log(`WARNING: Empty string found in field: ${key}`);
      }
    });
    
    // CRITICAL: Ensure updated_at is set when updating assignment
    // This ensures the mirror entry in app_manual_training_plans can sync the same timestamp
    filteredUpdateData.updated_at = new Date();
    
    // Update assignment
    const [updated] = await db('training_plan_assignments')
      .where({ id, gym_id: req.user.gym_id })
      .update(filteredUpdateData)
      .returning('*');

    // Mirror changes to mobile app with smart updates
    try {
      // Find the mobile plan linked to this assignment
      const mobilePlan = await db('app_manual_training_plans')
        .where({ web_plan_id: assignment.id })
        .first();

      if (mobilePlan) {
        console.log(`🔄 Smart updating assignment mobile plan ${mobilePlan.id} for user ${mobilePlan.user_id}`);
        
        // Update mobile plan basic info
        // CRITICAL: Sync updated_at from assignment to keep dates in sync
        await db('app_manual_training_plans')
          .where({ id: mobilePlan.id })
          .update({
            exercise_plan_category: updated.category,
            start_date: updated.start_date,
            end_date: updated.end_date,
            total_workouts: updated.total_workouts || 0,
            total_exercises: updated.total_exercises || 0,
            training_minutes: updated.training_minutes || 0,
            updated_at: updated.updated_at || new Date(), // Sync updated_at from assignment
          });

        // Smart update mobile plan items if exercises_details changed
        if (updateData.exercises_details) {
          try {
            const parsed = JSON.parse(updateData.exercises_details);
            if (Array.isArray(parsed) && parsed.length) {
              // Get user's progress to determine which workouts are completed
              const userProgress = await getUserProgressForPlan(mobilePlan.user_id, mobilePlan.id);
              const today = new Date().toISOString().split('T')[0];
              
              console.log(`📊 Assignment user progress: ${userProgress.completedDays} completed days, today: ${today}`);
              
              // Only update future workouts, preserve completed ones
              await smartUpdateMobilePlanItems(mobilePlan.id, parsed, userProgress, today);
            }
          } catch (parseErr) {
            console.error('Parse error in assignment update:', parseErr);
          }
        }
      }
    } catch (mirrorErr) {
      console.error('Smart assignment update mirror to mobile failed:', mirrorErr?.message || mirrorErr);
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// Delete assignment
exports.deleteAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if assignment exists and belongs to this gym
    const assignment = await db('training_plan_assignments')
      .where({ id, gym_id: req.user.gym_id })
      .first();

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    await purgeAssignmentArtifacts(assignment);

    // Delete assignment
    await db('training_plan_assignments')
      .where({ id, gym_id: req.user.gym_id })
      .del();

    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (err) { next(err); }
};

// Get assignments for a specific user (Mobile App endpoint)
exports.getUserAssignments = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;

    // SECURITY: Ensure proper user isolation
    let targetUserId;
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      // Admin/trainer can access specific user's assignments in their gym
      targetUserId = parseInt(user_id);
    } else {
      // Regular users can only access their own assignments
      // Ignore user_id from params and use authenticated user's ID
      targetUserId = requestingUserId;
    }

    const query = db('training_plan_assignments')
      .where({ 
        gym_id: req.user.gym_id,
        user_id: targetUserId
      })
      .orderBy('created_at', 'desc');

    const rows = await query.limit(limit).offset((page - 1) * limit);
    const [{ count }] = await db('training_plan_assignments')
      .where({ 
        gym_id: req.user.gym_id,
        user_id: targetUserId
      })
      .count('* as count');

    // Enrich with template plan details if web_plan_id exists
    const enrichedRows = await Promise.all(rows.map(async (assignment) => {
      if (assignment.web_plan_id) {
        try {
          const templatePlan = await db('training_plans')
            .where({ id: assignment.web_plan_id, gym_id: req.user.gym_id })
            .first();
          
          if (templatePlan) {
            return {
              ...assignment,
              template_plan: {
                workout_name: templatePlan.workout_name,
                exercises_details: templatePlan.exercises_details
              }
            };
          }
        } catch (err) {
          console.error('Error fetching template plan:', err);
        }
      }
      return assignment;
    }));

    res.json({ 
      success: true, 
      data: enrichedRows, 
      pagination: { 
        page: Number(page), 
        limit: Number(limit), 
        total: Number(count) 
      } 
    });
  } catch (err) { next(err); }
};

// Update assignment progress (Mobile App endpoint)
exports.updateAssignmentProgress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { progress_data, completion_status, notes } = req.body;

    // Check if assignment exists and belongs to this gym
    const assignment = await db('training_plan_assignments')
      .where({ id, gym_id: req.user.gym_id })
      .first();

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Update assignment with progress data
    const updateData = {
      status: completion_status || assignment.status,
      updated_at: new Date()
    };

    // Store progress data in exercises_details or create a separate progress field
    if (progress_data) {
      updateData.exercises_details = JSON.stringify({
        ...JSON.parse(assignment.exercises_details || '[]'),
        progress: progress_data,
        notes: notes
      });
    }

    const [updated] = await db('training_plan_assignments')
      .where({ id, gym_id: req.user.gym_id })
      .update(updateData)
      .returning('*');

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};


async function purgeAssignmentArtifacts(assignment) {
  if (!assignment) return;

  // Delete related daily training plans
  try {
    const dailyPlansQuery = db('daily_training_plans')
      .where({ is_stats_record: false })
      .where(function() {
        this.where('source_plan_id', assignment.id)
            .orWhere('source_plan_id', assignment.id.toString());
      })
      .modify((qb) => {
        if (assignment.user_id) qb.andWhere({ user_id: assignment.user_id });
        if (assignment.gym_id != null) qb.andWhere({ gym_id: assignment.gym_id });
      });

    const deletedDailyPlansCount = await dailyPlansQuery.del();
    console.log(`✅ Deleted ${deletedDailyPlansCount} daily training plans for assignment ${assignment.id}`);
  } catch (dailyPlansErr) {
    console.error('❌ Error deleting daily training plans for assignment:', dailyPlansErr?.message || dailyPlansErr);
  }

  // Delete mobile mirror
  try {
    const mobilePlan = await db('app_manual_training_plans')
      .where({ web_plan_id: assignment.id })
      .first();

    if (mobilePlan) {
      await db('app_manual_training_plan_items')
        .where({ plan_id: mobilePlan.id })
        .del();

      await db('app_manual_training_plans')
        .where({ id: mobilePlan.id })
        .del();
    }
  } catch (mirrorErr) {
    console.error('Assignment delete mirror to mobile failed:', mirrorErr?.message || mirrorErr);
  }
}

