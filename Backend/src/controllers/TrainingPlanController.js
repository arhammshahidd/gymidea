const db = require('../config/db');
const { createDistributedPlan } = require('../utils/exerciseDistribution');

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
          workout_name: it.workout_name,
          exercise_plan_category: it.exercise_plan_category ?? resolvedCategory ?? null,
          sets: Number(it.sets || 0),
          reps: Number(it.reps || 0),
          weight: Number(it.weight_kg || 0),
          weight_kg: Number(it.weight_kg || 0),
          training_minutes: Number(it.minutes || 0),
          minutes: Number(it.minutes || 0),
        };
        if (it.exercise_types !== undefined && it.exercise_types !== null && it.exercise_types !== '') {
          row.exercise_types = it.exercise_types;
        }
        return row;
      });

      // Create distributed plan
      const distributedPlan = createDistributedPlan(
        { items: normalized },
        new Date(start_date),
        new Date(end_date)
      );

      normalizedExercisesDetails = JSON.stringify(distributedPlan.daily_plans);
      computedWorkoutName = computedWorkoutName || normalized.map(n => n.name).filter(Boolean).join(', ');
      computedTotalWorkouts = computedTotalWorkouts ?? distributedPlan.total_exercises;
      computedTrainingMinutes = computedTrainingMinutes ?? distributedPlan.total_training_minutes;
      computedSets = computedSets ?? normalized.reduce((s, n) => s + (n.sets || 0), 0);
      computedReps = computedReps ?? normalized.reduce((s, n) => s + (n.reps || 0), 0);
      computedWeightKg = computedWeightKg ?? normalized.reduce((s, n) => s + (n.weight || 0), 0);
      computedTotalExercises = computedTotalExercises ?? distributedPlan.total_exercises;
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
      trainer_id: trainer_id ? parseInt(trainer_id) : req.user.id,
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
      weight_kg: computedWeightKg ?? '',
      exercise_types: null, // Will be calculated from exercises
      status: status ?? 'PLANNED',
      assign_to: assign_to ? parseInt(assign_to) : null,
      exercises_details: normalizedExercisesDetails ?? exercises_details ?? null,
      user_level: user_level ?? 'Beginner',
    };

    console.log('Inserting plan data:', planData);
    console.log('Exercises details being inserted:', planData.exercises_details);
    console.log('Workout name being inserted:', planData.workout_name);
    console.log('Gym ID being inserted:', planData.gym_id);
    console.log('Trainer ID being inserted:', planData.trainer_id);

    console.log('About to insert plan data into database...');
    let plan;
    try {
      [plan] = await db('training_plans')
        .insert(planData)
        .returning('*');
      console.log('Plan inserted successfully:', plan);
    } catch (dbError) {
      console.error('Database insert error:', dbError);
      console.error('Plan data that failed to insert:', planData);
      throw dbError;
    }

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
              exercise_plan_category: resolvedCategory || null,
              exercise_types: ex.exercise_types ?? null,
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
    console.log('Update request received:', req.params, req.body);
    console.log('Exercises details in request:', req.body.exercises_details);
    console.log('Exercises details type:', typeof req.body.exercises_details);
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.gym_id;
    
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
          for (const m of mobilePlans) {
            await db('app_manual_training_plan_items').where({ plan_id: m.id }).del();
            if (Array.isArray(parsed) && parsed.length) {
              const rows = parsed.map((ex) => ({
                plan_id: m.id,
                workout_name: ex.name || ex.workout_name,
                exercise_plan_category: ex.exercise_plan_category || updated.category || null,
                exercise_types: ex.exercise_types ?? null,
                sets: Number(ex.sets || 0),
                reps: Number(ex.reps || 0),
                weight_kg: Number(ex.weight_kg ?? ex.weight ?? 0),
                minutes: Number(ex.training_minutes ?? ex.minutes ?? 0),
                user_level: ex.user_level || updated.user_level || 'Beginner',
              }));
              if (rows.length) await db('app_manual_training_plan_items').insert(rows);
            }
          }
        }
      }
    } catch (mirrorErr) {
      console.error('Update mirror to mobile failed:', mirrorErr?.message || mirrorErr);
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
  } catch (err) { next(err); }
};

// Get my assignments (for trainers)
exports.getMyAssignments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, category } = req.query;
    const trainerId = req.user.id;

    const query = db('training_plan_assignments')
      .where({ 
        gym_id: req.user.gym_id,
        trainer_id: trainerId 
      })
      .orderBy('created_at', 'desc');

    if (status) query.andWhere('status', status);
    if (category) query.andWhere('category', category);

    const rows = await query.limit(limit).offset((page - 1) * limit);
    const [{ count }] = await db('training_plan_assignments')
      .where({ 
        gym_id: req.user.gym_id,
        trainer_id: trainerId 
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
      filteredUpdateData.weight_kg = filteredUpdateData.weight_kg === '' ? '' : filteredUpdateData.weight_kg.toString();
    }

    // Final validation - ensure no empty strings in numeric fields
    const numericFields = ['total_workouts', 'total_exercises', 'training_minutes', 'sets', 'reps'];
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

    // Update assignment
    const [updated] = await db('training_plan_assignments')
      .where({ id, gym_id: req.user.gym_id })
      .update(filteredUpdateData)
      .returning('*');

    // Mirror changes to mobile app
    try {
      // Find the mobile plan linked to this assignment
      const mobilePlan = await db('app_manual_training_plans')
        .where({ web_plan_id: assignment.id })
        .first();

      if (mobilePlan) {
        // Update mobile plan
        await db('app_manual_training_plans')
          .where({ id: mobilePlan.id })
          .update({
            exercise_plan_category: updated.category,
            start_date: updated.start_date,
            end_date: updated.end_date,
            total_workouts: updated.total_workouts || 0,
            total_exercises: updated.total_exercises || 0,
            training_minutes: updated.training_minutes || 0,
          });

        // Update mobile plan items if exercises_details changed
        if (updateData.exercises_details) {
          // Delete existing items
          await db('app_manual_training_plan_items')
            .where({ plan_id: mobilePlan.id })
            .del();

          // Insert new items
          try {
            const parsed = JSON.parse(updateData.exercises_details);
            if (Array.isArray(parsed) && parsed.length) {
              const rows = parsed.map((ex) => ({
                plan_id: mobilePlan.id,
                workout_name: ex.name || ex.workout_name,
                exercise_plan_category: updated.category || null,
                exercise_types: ex.exercise_types ?? null,
                sets: Number(ex.sets || 0),
                reps: Number(ex.reps || 0),
                weight_kg: Number(ex.weight_kg ?? ex.weight ?? 0),
                minutes: Number(ex.training_minutes ?? ex.minutes ?? 0),
                user_level: updated.user_level || 'Beginner',
              }));
              if (rows.length) await db('app_manual_training_plan_items').insert(rows);
            }
          } catch (_) { /* swallow parse error */ }
        }
      }
    } catch (mirrorErr) {
      console.error('Assignment update mirror to mobile failed:', mirrorErr?.message || mirrorErr);
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

    // Delete mobile mirror first
    try {
      const mobilePlan = await db('app_manual_training_plans')
        .where({ web_plan_id: assignment.id })
        .first();

      if (mobilePlan) {
        // Delete mobile plan items
        await db('app_manual_training_plan_items')
          .where({ plan_id: mobilePlan.id })
          .del();

        // Delete mobile plan
        await db('app_manual_training_plans')
          .where({ id: mobilePlan.id })
          .del();
      }
    } catch (mirrorErr) {
      console.error('Assignment delete mirror to mobile failed:', mirrorErr?.message || mirrorErr);
    }

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

    const query = db('training_plan_assignments')
      .where({ 
        gym_id: req.user.gym_id,
        user_id: parseInt(user_id)
      })
      .orderBy('created_at', 'desc');

    const rows = await query.limit(limit).offset((page - 1) * limit);
    const [{ count }] = await db('training_plan_assignments')
      .where({ 
        gym_id: req.user.gym_id,
        user_id: parseInt(user_id)
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


