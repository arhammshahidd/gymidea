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
          exercises_details: plan.exercises_details || null,
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
                exercise_plan_category: ex.exercise_plan_category || assignment.category || null,
                exercise_types: ex.exercise_types ?? null,
                sets: Number(ex.sets || 0),
                reps: Number(ex.reps || 0),
                weight_kg: Number(ex.weight_kg ?? ex.weight ?? 0),
                minutes: Number(ex.training_minutes ?? ex.minutes ?? 0),
                user_level: ex.user_level || assignment.user_level || 'Beginner',
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
        exercises_details: plan.exercises_details || null,
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
              exercise_plan_category: ex.exercise_plan_category || assignment.category || null,
              exercise_types: ex.exercise_types ?? null,
              sets: Number(ex.sets || 0),
              reps: Number(ex.reps || 0),
              weight_kg: Number(ex.weight_kg ?? ex.weight ?? 0),
              minutes: Number(ex.training_minutes ?? ex.minutes ?? 0),
              user_level: ex.user_level || assignment.user_level || 'Beginner',
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

    // Check if assignment exists and belongs to this gym
    const assignment = await db('training_plan_assignments')
      .where({ id, gym_id: req.user.gym_id })
      .first();

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Update assignment
    const [updated] = await db('training_plan_assignments')
      .where({ id, gym_id: req.user.gym_id })
      .update(updateData)
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


