const db = require('../config/db');
const { createDistributedPlan } = require('../utils/exerciseDistribution');

// List approvals
exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, approval_status, category, user_id } = req.query;
    const query = db('training_approvals').where({ gym_id: req.user.gym_id }).orderBy('created_at', 'desc');
    if (approval_status) query.andWhere('approval_status', approval_status);
    if (category) query.andWhere('category', category);
    if (user_id) query.andWhere('user_id', user_id);
    const rows = await query.limit(limit).offset((page - 1) * limit);
    const [{ count }] = await db('training_approvals').where({ gym_id: req.user.gym_id }).count('* as count');
    res.json({ success: true, data: rows, pagination: { page: Number(page), limit: Number(limit), total: Number(count) } });
  } catch (err) { next(err); }
};

// Create approval record
exports.create = async (req, res, next) => {
  try {
    const body = req.body || {};
    
    // Check if this is a mobile submission (has JWT token and is using mobile endpoint or has mobile-specific fields)
    const isMobileSubmission = req.user.id && (
      req.path.includes('/mobile/submit') || 
      (!body.user_id && !body.user_name && !body.user_phone) ||
      body.plan_category_name || 
      body.exercise_types
    );
    
    if (isMobileSubmission) {
      // Handle mobile submission through web portal endpoint
      const required = ['start_date', 'end_date', 'workout_name', 'category'];
      for (const field of required) {
        if (!body[field]) {
          return res.status(400).json({ 
            success: false, 
            message: `${field} is required` 
          });
        }
      }

      // Validate date format
      const startDate = new Date(body.start_date);
      const endDate = new Date(body.end_date);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid date format. Use YYYY-MM-DD' 
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'Start date cannot be after end date' 
        });
      }

      // Calculate total days
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      const [row] = await db('training_approvals')
        .insert({
          gym_id: req.user.gym_id,
          user_id: req.user.id,
          user_name: req.user.name || req.user.user_name || body.user_name || 'Mobile User',
          user_phone: req.user.phone || req.user.user_phone || body.user_phone || '',
          start_date: body.start_date,
          end_date: body.end_date,
          workout_name: body.workout_name,
          sets: body.sets ?? 0,
          reps: body.reps ?? 0,
          weight_kg: body.weight_kg ?? 0,
          category: body.category,
          plan_category_name: body.plan_category_name || body.category,
          total_days: totalDays,
          total_training_minutes: body.total_training_minutes ?? 0,
          total_workouts: body.total_workouts ?? 0,
          minutes: body.minutes ?? 0,
          exercise_types: body.exercise_types || null,
          user_level: body.user_level ?? 'Beginner',
          approval_status: 'PENDING',
          notes: body.notes || null,
          // New fields for enhanced data structure
          plan_id: body.plan_id || null,
          plan_type: body.plan_type || 'manual',
          exercise_plan_category: body.exercise_plan_category || body.category,
          items: body.items ? JSON.stringify(body.items) : null,
          daily_plans: body.daily_plans ? JSON.stringify(body.daily_plans) : null,
          total_exercises: body.total_exercises || (body.items ? body.items.length : 0),
          exercises_details: body.exercises_details || (body.items ? JSON.stringify(body.items) : null),
        })
        .returning('*');

      // Emit realtime event
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:created', { ...row, source: 'mobile_app' });
          if (row.user_id) io.to(`user:${row.user_id}`).emit('trainingApproval:created', { ...row, source: 'mobile_app' });
        }
      } catch (e) {}
      
      res.status(201).json({ 
        success: true, 
        message: 'Training approval submitted successfully',
        data: {
          id: row.id,
          approval_status: row.approval_status,
          created_at: row.created_at
        }
      });
    } else {
      // Handle web portal submission
      const required = ['user_id', 'user_name', 'user_phone', 'start_date', 'end_date', 'workout_name', 'category'];
      for (const f of required) {
        if (!body[f]) return res.status(400).json({ success: false, message: `${f} is required` });
      }
      
      const [row] = await db('training_approvals')
        .insert({
          gym_id: req.user.gym_id,
          user_id: body.user_id,
          user_name: body.user_name,
          user_phone: body.user_phone,
          start_date: body.start_date,
          end_date: body.end_date,
          workout_name: body.workout_name,
          sets: body.sets ?? 0,
          reps: body.reps ?? 0,
          weight_kg: body.weight_kg ?? 0,
          category: body.category,
          plan_category_name: body.plan_category_name || body.category,
          total_days: body.total_days || Math.ceil((new Date(body.end_date) - new Date(body.start_date)) / (1000 * 60 * 60 * 24)) + 1,
          total_training_minutes: body.total_training_minutes ?? 0,
          total_workouts: body.total_workouts ?? 0,
          minutes: body.minutes ?? 0,
          exercise_types: (body.exercise_types !== undefined && body.exercise_types !== null && body.exercise_types !== '') ? body.exercise_types : null,
          user_level: body.user_level ?? 'Beginner',
          approval_status: body.approval_status ?? 'PENDING',
          notes: body.notes ?? null,
          // New fields for enhanced data structure
          plan_id: body.plan_id || null,
          plan_type: body.plan_type || 'manual',
          exercise_plan_category: body.exercise_plan_category || body.category,
          items: body.items ? JSON.stringify(body.items) : null,
          daily_plans: body.daily_plans ? JSON.stringify(body.daily_plans) : null,
          total_exercises: body.total_exercises || (body.items ? body.items.length : 0),
          exercises_details: body.exercises_details || (body.items ? JSON.stringify(body.items) : null),
        })
        .returning('*');
      
      // Emit realtime event
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:created', row);
          if (row.user_id) io.to(`user:${row.user_id}`).emit('trainingApproval:created', row);
        }
      } catch (e) {}
      
      res.status(201).json({ success: true, data: row });
    }
  } catch (err) { next(err); }
};

// Get single
exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = await db('training_approvals').where({ id, gym_id: req.user.gym_id }).first();
    if (!row) return res.status(404).json({ success: false, message: 'Approval not found' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

// Update
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const update = { ...req.body };
    delete update.gym_id;
    const [row] = await db('training_approvals')
      .where({ id, gym_id: req.user.gym_id })
      .update(update)
      .returning('*');
    if (!row) return res.status(404).json({ success: false, message: 'Approval not found' });
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:updated', row);
        if (row.user_id) io.to(`user:${row.user_id}`).emit('trainingApproval:updated', row);
      }
    } catch (e) {}
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

// Delete
exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await db('training_approvals').where({ id, gym_id: req.user.gym_id }).del();
    if (!deleted) return res.status(404).json({ success: false, message: 'Approval not found' });
    try {
      const io = req.app.get('io');
      if (io) io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:deleted', { id });
    } catch (e) {}
    res.json({ success: true, message: 'Approval deleted' });
  } catch (err) { next(err); }
};

// Update approval status explicitly
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approval_status } = req.body;
    if (!approval_status) return res.status(400).json({ success: false, message: 'approval_status is required' });
    
    const [row] = await db('training_approvals')
      .where({ id, gym_id: req.user.gym_id })
      .update({ approval_status })
      .returning('*');
    if (!row) return res.status(404).json({ success: false, message: 'Approval not found' });

    // If approved, create a training plan assignment
    if (approval_status === 'APPROVED') {
      try {
        // Parse exercises and create distributed plan
        let exercises = [];
        if (row.items) {
          try {
            exercises = JSON.parse(row.items);
          } catch (e) {
            console.error('Error parsing items:', e);
          }
        }
        
        if (exercises.length === 0 && row.exercises_details) {
          try {
            exercises = JSON.parse(row.exercises_details);
          } catch (e) {
            console.error('Error parsing exercises_details:', e);
          }
        }

        // Create distributed plan
        const distributedPlan = createDistributedPlan(
          { items: exercises },
          new Date(row.start_date),
          new Date(row.end_date)
        );

        // Create a training plan first
        const [trainingPlan] = await db('training_plans')
          .insert({
            gym_id: req.user.gym_id,
            user_id: row.user_id,
            trainer_id: req.user.id, // Current user (trainer/gym_admin) becomes the trainer
            start_date: row.start_date,
            end_date: row.end_date,
            workout_name: row.workout_name,
            category: row.category || row.plan_category_name,
            user_level: row.user_level || 'Beginner',
            status: 'ACTIVE',
            total_workouts: distributedPlan.total_exercises || row.total_workouts || 0,
            total_exercises: distributedPlan.total_exercises || 0,
            training_minutes: distributedPlan.total_training_minutes || row.total_training_minutes || row.minutes || 0,
            sets: row.sets || 0,
            reps: row.reps || 0,
            weight_kg: row.weight_kg || 0,
            exercises_details: JSON.stringify(distributedPlan.daily_plans),
            assign_to: row.user_id,
            created_by: req.user.id
          })
          .returning('*');

        // Create training plan assignment
        const [assignment] = await db('training_plan_assignments')
          .insert({
            gym_id: req.user.gym_id,
            web_plan_id: trainingPlan.id,
            trainer_id: req.user.id,
            user_id: row.user_id,
            start_date: row.start_date,
            end_date: row.end_date,
            category: row.category || row.plan_category_name,
            user_level: row.user_level || 'Beginner',
            status: 'ACTIVE',
            total_workouts: distributedPlan.total_exercises || row.total_workouts || 0,
            total_exercises: distributedPlan.total_exercises || 0,
            training_minutes: distributedPlan.total_training_minutes || row.total_training_minutes || row.minutes || 0,
            sets: row.sets || 0,
            reps: row.reps || 0,
            weight_kg: row.weight_kg || 0,
            exercises_details: JSON.stringify(distributedPlan.daily_plans),
          })
          .returning('*');

        // Mirror assignment to mobile app
        try {
          const [mobilePlan] = await db('app_manual_training_plans')
            .insert({
              user_id: row.user_id,
              gym_id: req.user.gym_id,
              exercise_plan_category: assignment.category,
              start_date: assignment.start_date,
              end_date: assignment.end_date,
              total_workouts: assignment.total_workouts || 0,
              total_exercises: assignment.total_exercises || 0,
              training_minutes: assignment.training_minutes || 0,
              status: 'ACTIVE',
              web_plan_id: assignment.id,
            })
            .returning('*');

          // Add exercise items from distributed daily plans
          if (distributedPlan.daily_plans && distributedPlan.daily_plans.length > 0) {
            try {
              const allExercises = [];
              
              // Flatten all exercises from daily plans
              distributedPlan.daily_plans.forEach((dayPlan) => {
                if (dayPlan.workouts && dayPlan.workouts.length > 0) {
                  dayPlan.workouts.forEach((exercise) => {
                    allExercises.push({
                      plan_id: mobilePlan.id,
                      workout_name: exercise.name || exercise.workout_name,
                      exercise_plan_category: exercise.exercise_plan_category || assignment.category || null,
                      exercise_types: exercise.exercise_types ?? null,
                      sets: Number(exercise.sets || 0),
                      reps: Number(exercise.reps || 0),
                      weight_kg: Number(exercise.weight_kg ?? exercise.weight ?? 0),
                      minutes: Number(exercise.training_minutes ?? exercise.minutes ?? 0),
                      user_level: exercise.user_level || assignment.user_level || 'Beginner',
                    });
                  });
                }
              });
              
              if (allExercises.length) {
                await db('app_manual_training_plan_items').insert(allExercises);
              }
            } catch (parseErr) {
              console.error('Error creating mobile exercise items:', parseErr);
            }
          }
        } catch (mobileErr) {
          console.error('Error creating mobile plan mirror:', mobileErr);
        }

        console.log('Training plan assignment created successfully:', assignment.id);
      } catch (assignmentErr) {
        console.error('Error creating training plan assignment:', assignmentErr);
        // Don't fail the approval if assignment creation fails
      }
    }

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:status', row);
        if (row.user_id) io.to(`user:${row.user_id}`).emit('trainingApproval:status', row);
      }
    } catch (e) {}
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

// Mobile app specific endpoint for training approval submission
exports.mobileSubmit = async (req, res, next) => {
  try {
    const body = req.body || {};
    
    // Required fields for mobile submission
    const required = ['start_date', 'end_date', 'workout_name', 'category'];
    for (const field of required) {
      if (!body[field]) {
        return res.status(400).json({ 
          success: false, 
          message: `${field} is required` 
        });
      }
    }

    // Validate date format
    const startDate = new Date(body.start_date);
    const endDate = new Date(body.end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Start date cannot be after end date' 
      });
    }

    // Validate user_level if provided
    if (body.user_level && !['Beginner', 'Intermediate', 'Expert'].includes(body.user_level)) {
      return res.status(400).json({ 
        success: false, 
        message: 'user_level must be one of: Beginner, Intermediate, Expert' 
      });
    }

    // Calculate total days
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Create training approval record
    const [row] = await db('training_approvals')
      .insert({
        gym_id: req.user.gym_id,
        user_id: req.user.id,
        user_name: req.user.name || req.user.user_name || 'Mobile User',
        user_phone: req.user.phone || req.user.user_phone || '',
        start_date: body.start_date,
        end_date: body.end_date,
        workout_name: body.workout_name,
        sets: body.sets ?? 0,
        reps: body.reps ?? 0,
        weight_kg: body.weight_kg ?? 0,
        category: body.category,
        plan_category_name: body.plan_category_name || body.category,
        total_days: totalDays,
        total_training_minutes: body.total_training_minutes ?? 0,
        total_workouts: body.total_workouts ?? 0,
        minutes: body.minutes ?? 0,
        exercise_types: body.exercise_types || null,
        user_level: body.user_level ?? 'Beginner',
        approval_status: 'PENDING',
        notes: body.notes || null,
      })
      .returning('*');

    // Emit realtime event for web portal
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:created', {
          ...row,
          source: 'mobile_app'
        });
      }
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Training approval submitted successfully',
      data: {
        id: row.id,
        approval_status: row.approval_status,
        created_at: row.created_at
      }
    });
  } catch (err) { 
    next(err); 
  }
};

// Get detailed training approval with workout plan breakdown
exports.getDetailed = async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = await db('training_approvals').where({ id, gym_id: req.user.gym_id }).first();
    
    if (!row) {
      return res.status(404).json({ success: false, message: 'Approval not found' });
    }

    // Parse items (all exercises) if available
    let items = [];
    if (row.items) {
      try {
        items = JSON.parse(row.items);
      } catch (e) {
        console.error('Error parsing items:', e);
        items = [];
      }
    }

    // Parse daily plans if available
    let dailyPlans = [];
    if (row.daily_plans) {
      try {
        dailyPlans = JSON.parse(row.daily_plans);
      } catch (e) {
        console.error('Error parsing daily plans:', e);
        dailyPlans = [];
      }
    }

    // Parse exercises details if available (backward compatibility)
    let workoutPlan = [];
    if (row.exercises_details) {
      try {
        workoutPlan = JSON.parse(row.exercises_details);
      } catch (e) {
        console.error('Error parsing exercises details:', e);
        workoutPlan = [];
      }
    }

    // If no items but we have exercises_details, use that
    if (items.length === 0 && workoutPlan.length > 0) {
      items = workoutPlan;
    }

    // If no items or exercises_details, create a basic workout plan from the main record
    if (items.length === 0 && row.workout_name) {
      items = [{
        name: row.workout_name,
        workout_name: row.workout_name,
        sets: row.sets || 0,
        reps: row.reps || 0,
        weight: row.weight_kg || 0,
        weight_kg: row.weight_kg || 0,
        exercise_types: row.exercise_types || '',
        training_minutes: row.minutes || 0,
        minutes: row.minutes || 0
      }];
    }

    // Calculate total days if not set
    if (!row.total_days) {
      const startDate = new Date(row.start_date);
      const endDate = new Date(row.end_date);
      row.total_days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    const detailedData = {
      ...row,
      items: items,
      daily_plans: dailyPlans,
      workout_plan: items, // For backward compatibility
      total_exercises: items.length
    };

    res.json({ success: true, data: detailedData });
  } catch (err) { 
    next(err); 
  }
};


