const db = require('../config/db');

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
      items,
    } = req.body;

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

    if (Array.isArray(items) && items.length > 0) {
      const normalized = items.map((it) => {
        const row = {
          name: it.workout_name,
          exercise_plan_category: it.exercise_plan_category ?? resolvedCategory ?? null,
          sets: Number(it.sets || 0),
          reps: Number(it.reps || 0),
          weight: Number(it.weight_kg || 0),
          training_minutes: Number(it.minutes || 0),
        };
        if (it.exercise_types !== undefined && it.exercise_types !== null && it.exercise_types !== '') {
          row.exercise_types = it.exercise_types;
        }
        return row;
      });

      normalizedExercisesDetails = JSON.stringify(normalized);
      computedWorkoutName = computedWorkoutName || normalized.map(n => n.name).filter(Boolean).join(', ');
      computedTotalWorkouts = computedTotalWorkouts ?? normalized.length;
      computedTrainingMinutes = computedTrainingMinutes ?? normalized.reduce((s, n) => s + (n.training_minutes || 0), 0);
      computedSets = computedSets ?? normalized.reduce((s, n) => s + (n.sets || 0), 0);
      computedReps = computedReps ?? normalized.reduce((s, n) => s + (n.reps || 0), 0);
      computedWeightKg = computedWeightKg ?? normalized.reduce((s, n) => s + (n.weight || 0), 0);
      computedTotalExercises = computedTotalExercises ?? normalized.length;
    }

    if (!start_date || !end_date || !resolvedCategory) {
      return res.status(400).json({ success: false, message: 'start_date, end_date, category are required' });
    }
    if (!computedWorkoutName) {
      return res.status(400).json({ success: false, message: 'workout_name is required (or provide items with workout_name)' });
    }

    // Ensure all numeric fields are properly converted to integers
    const planData = {
      gym_id: req.user.gym_id,
      trainer_id: trainer_id ? parseInt(trainer_id) : null,
      user_id: user_id ? parseInt(user_id) : null,
      start_date,
      end_date,
      category: resolvedCategory,
      workout_name: computedWorkoutName,
      total_workouts: parseInt(computedTotalWorkouts ?? 0),
      total_exercises: parseInt(computedTotalExercises ?? 0),
      training_minutes: parseInt(computedTrainingMinutes ?? 0),
      sets: parseInt(computedSets ?? 0),
      reps: parseInt(computedReps ?? 0),
      weight_kg: parseInt(computedWeightKg ?? 0),
      status: status ?? 'PLANNED',
      assign_to: assign_to ? parseInt(assign_to) : null,
      exercises_details: normalizedExercisesDetails ?? exercises_details ?? null,
      user_level: user_level ?? 'Beginner',
    };

    console.log('Inserting plan data:', planData);

    const [plan] = await db('training_plans')
      .insert(planData)
      .returning('*');

    // Mirror to Mobile App tables so it appears in the app immediately
    try {
      // Derive items array from provided items or exercises_details JSON
      let mobileItems = Array.isArray(items) ? items : [];
      if ((!mobileItems || mobileItems.length === 0) && (normalizedExercisesDetails || exercises_details)) {
        try {
          const parsed = JSON.parse(normalizedExercisesDetails || exercises_details);
          if (Array.isArray(parsed)) {
            mobileItems = parsed.map((ex) => ({
              workout_name: ex.name || ex.workout_name,
              exercise_plan_category: ex.exercise_plan_category || resolvedCategory || null,
              exercise_types: (ex.exercise_types !== undefined && ex.exercise_types !== null && ex.exercise_types !== '') ? ex.exercise_types : undefined,
              sets: ex.sets || 0,
              reps: ex.reps || 0,
              weight_kg: ex.weight_kg ?? ex.weight ?? 0,
              minutes: ex.training_minutes ?? ex.minutes ?? 0,
            }));
          }
        } catch (_) { /* swallow JSON parse errors for mirror */ }
      }

      // Only create a mobile plan if we at least know category and dates
      const [mobilePlan] = await db('app_manual_training_plans')
        .insert({
          user_id: user_id ? parseInt(user_id) : null,
          gym_id: req.user?.gym_id ?? null,
          exercise_plan_category: resolvedCategory,
          start_date,
          end_date,
          total_workouts: parseInt(computedTotalWorkouts ?? 0),
          total_exercises: parseInt(computedTotalExercises ?? (mobileItems?.length || 0)),
          training_minutes: parseInt(computedTrainingMinutes ?? 0),
          web_plan_id: plan.id,
        })
        .returning('*');

      if (Array.isArray(mobileItems) && mobileItems.length > 0) {
        const rows = mobileItems.map((it) => ({
          plan_id: mobilePlan.id,
          workout_name: it.workout_name,
          exercise_plan_category: it.exercise_plan_category || resolvedCategory || null,
          exercise_types: it.exercise_types || null,
          sets: Number(it.sets || 0),
          reps: Number(it.reps || 0),
          weight_kg: Number(it.weight_kg || 0),
          minutes: Number(it.minutes || 0),
          user_level: it.user_level || 'Beginner',
        }));
        if (rows.length) {
          await db('app_manual_training_plan_items').insert(rows);
        }
      }
    } catch (mirrorErr) {
      // Log and continue; we don't want to block web success if mobile mirror fails
      console.error('Mobile plan mirror failed:', mirrorErr?.message || mirrorErr);
    }

    res.status(201).json({ success: true, data: plan });
  } catch (err) { next(err); }
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
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.gym_id;
    
    // Ensure numeric fields are properly converted
    if (updateData.trainer_id) updateData.trainer_id = parseInt(updateData.trainer_id);
    if (updateData.user_id) updateData.user_id = parseInt(updateData.user_id);
    if (updateData.total_workouts) updateData.total_workouts = parseInt(updateData.total_workouts);
    if (updateData.total_exercises) updateData.total_exercises = parseInt(updateData.total_exercises);
    if (updateData.training_minutes) updateData.training_minutes = parseInt(updateData.training_minutes);
    if (updateData.sets) updateData.sets = parseInt(updateData.sets);
    if (updateData.reps) updateData.reps = parseInt(updateData.reps);
    if (updateData.weight_kg) updateData.weight_kg = parseInt(updateData.weight_kg);
    if (updateData.assign_to) updateData.assign_to = parseInt(updateData.assign_to);
    
    const [updated] = await db('training_plans')
      .where({ id, gym_id: req.user.gym_id })
      .update(updateData)
      .returning('*');
    if (!updated) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// Delete plan
exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { unassign_only } = req.query; // Check if this is an unassign operation
    
    // Find plan to resolve link to mobile table
    const plan = await db('training_plans').where({ id, gym_id: req.user.gym_id }).first();
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    if (unassign_only === 'true') {
      // Only unassign the plan (set assign_to to null, keep user_id)
      const [updated] = await db('training_plans')
        .where({ id, gym_id: req.user.gym_id })
        .update({ assign_to: null })
        .returning('*');
      
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

// Get training plans assigned to current trainer (My Assign feature)
exports.getMyAssignments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category } = req.query;
    const trainerId = req.user.id; // Current trainer's ID
    
    const query = db('training_plans')
      .where({ 
        gym_id: req.user.gym_id,
        assign_to: trainerId 
      })
      .orderBy('created_at', 'desc');

    if (status) query.andWhere('status', status);
    if (category) query.andWhere('category', category);

    const rows = await query.limit(limit).offset((page - 1) * limit);
    const [{ count }] = await db('training_plans')
      .where({ 
        gym_id: req.user.gym_id,
        assign_to: trainerId 
      })
      .count('* as count');

    res.json({ 
      success: true, 
      data: rows, 
      pagination: { 
        page: Number(page), 
        limit: Number(limit), 
        total: Number(count) 
      } 
    });
  } catch (err) { next(err); }
};


