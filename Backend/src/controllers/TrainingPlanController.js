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
      training_minutes,
      sets,
      reps,
      weight_kg,
      status,
      assign_to,
      exercises_details,
    } = req.body;

    if (!start_date || !end_date || !category || !workout_name) {
      return res.status(400).json({ success: false, message: 'start_date, end_date, category, workout_name are required' });
    }

    const [plan] = await db('training_plans')
      .insert({
        gym_id: req.user.gym_id,
        trainer_id,
        user_id,
        start_date,
        end_date,
        category,
        workout_name,
        total_workouts: total_workouts ?? 0,
        training_minutes: training_minutes ?? 0,
        sets: sets ?? 0,
        reps: reps ?? 0,
        weight_kg: weight_kg ?? 0,
        status: status ?? 'PLANNED',
        assign_to: assign_to ?? null,
        exercises_details: exercises_details ?? null,
      })
      .returning('*');

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
    const deleted = await db('training_plans').where({ id, gym_id: req.user.gym_id }).del();
    if (!deleted) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, message: 'Plan deleted' });
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


