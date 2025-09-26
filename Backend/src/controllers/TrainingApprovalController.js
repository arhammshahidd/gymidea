const db = require('../config/db');

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
        })
        .returning('*');

      // Emit realtime event
      try {
        const io = req.app.get('io');
        if (io) io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:created', { ...row, source: 'mobile_app' });
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
        })
        .returning('*');
      
      // Emit realtime event
      try {
        const io = req.app.get('io');
        if (io) io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:created', row);
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
      if (io) io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:updated', row);
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
    try {
      const io = req.app.get('io');
      if (io) io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:status', row);
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

    // Parse exercises details if available
    let workoutPlan = [];
    if (row.exercises_details) {
      try {
        workoutPlan = JSON.parse(row.exercises_details);
      } catch (e) {
        console.error('Error parsing exercises details:', e);
        workoutPlan = [];
      }
    }

    // If no exercises_details, create a basic workout plan from the main record
    if (workoutPlan.length === 0 && row.workout_name) {
      workoutPlan = [{
        name: row.workout_name,
        sets: row.sets || 0,
        reps: row.reps || 0,
        weight: row.weight_kg || 0,
        exercise_types: row.exercise_types || '',
        training_minutes: row.minutes || 0
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
      workout_plan: workoutPlan,
      total_exercises: workoutPlan.length
    };

    res.json({ success: true, data: detailedData });
  } catch (err) { 
    next(err); 
  }
};


