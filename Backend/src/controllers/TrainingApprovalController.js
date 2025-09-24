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


