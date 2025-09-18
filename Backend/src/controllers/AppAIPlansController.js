const db = require('../config/db');

// AI Plan Requests (input parameters)
exports.createRequest = async (req, res) => {
  try {
    const { user_id, exercise_plan, age, height_cm, weight_kg, gender, future_goal } = req.body;
    const gymId = req.user?.gym_id ?? null;
    if (!user_id || !exercise_plan || !age || !height_cm || !weight_kg || !gender || !future_goal) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const [request] = await db('app_ai_plan_requests').insert({ user_id, gym_id: gymId, exercise_plan, age, height_cm, weight_kg, gender, future_goal }).returning('*');
    return res.status(201).json({ success: true, data: request });
  } catch (err) {
    console.error('Error creating AI plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to create AI plan request' });
  }
};

exports.updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { exercise_plan, age, height_cm, weight_kg, gender, future_goal } = req.body;
    const existing = await db('app_ai_plan_requests').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
    const [updated] = await db('app_ai_plan_requests').where({ id }).update({ exercise_plan, age, height_cm, weight_kg, gender, future_goal, updated_at: new Date() }).returning('*');
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating AI plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to update AI plan request' });
  }
};

exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('app_ai_plan_requests').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
    await db('app_ai_plan_requests').where({ id }).del();
    return res.json({ success: true, message: 'Request deleted' });
  } catch (err) {
    console.error('Error deleting AI plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete AI plan request' });
  }
};

exports.getRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await db('app_ai_plan_requests').where({ id }).first();
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, data: request });
  } catch (err) {
    console.error('Error getting AI plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to get AI plan request' });
  }
};

exports.listRequests = async (req, res) => {
  try {
    const { user_id } = req.query;
    const qb = db('app_ai_plan_requests').select('*').orderBy('created_at', 'desc');
    if (user_id) qb.where({ user_id });
    const rows = await qb;
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing AI plan requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to list AI plan requests' });
  }
};

// AI Generated Plans (received plan)
exports.createGeneratedPlan = async (req, res) => {
  try {
    const { request_id, user_id, start_date, end_date, exercise_plan_category, total_workouts, training_minutes, items = [] } = req.body;
    const gymId = req.user?.gym_id ?? null;
    if (!request_id || !user_id || !start_date || !end_date || !exercise_plan_category) {
      return res.status(400).json({ success: false, message: 'request_id, user_id, start_date, end_date, exercise_plan_category are required' });
    }
    const [plan] = await db('app_ai_generated_plans').insert({ request_id, user_id, gym_id: gymId, start_date, end_date, exercise_plan_category, total_workouts: total_workouts || 0, training_minutes: training_minutes || 0 }).returning('*');
    if (Array.isArray(items) && items.length) {
      const rows = items.map((it) => ({ plan_id: plan.id, workout_name: it.workout_name, sets: it.sets || 0, reps: it.reps || 0, weight_kg: it.weight_kg || 0, minutes: it.minutes || 0 }));
      await db('app_ai_generated_plan_items').insert(rows);
    }
    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    console.error('Error creating AI generated plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to create AI generated plan' });
  }
};

exports.updateGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, exercise_plan_category, total_workouts, training_minutes, items } = req.body;
    const existing = await db('app_ai_generated_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });
    const [updated] = await db('app_ai_generated_plans').where({ id }).update({ start_date, end_date, exercise_plan_category, total_workouts, training_minutes, updated_at: new Date() }).returning('*');
    if (Array.isArray(items)) {
      await db('app_ai_generated_plan_items').where({ plan_id: id }).del();
      if (items.length) {
        const rows = items.map((it) => ({ plan_id: id, workout_name: it.workout_name, sets: it.sets || 0, reps: it.reps || 0, weight_kg: it.weight_kg || 0, minutes: it.minutes || 0 }));
        await db('app_ai_generated_plan_items').insert(rows);
      }
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating AI generated plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to update AI generated plan' });
  }
};

exports.deleteGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('app_ai_generated_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });
    await db('app_ai_generated_plans').where({ id }).del();
    return res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    console.error('Error deleting AI generated plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete AI generated plan' });
  }
};

exports.getGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await db('app_ai_generated_plans').where({ id }).first();
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    const items = await db('app_ai_generated_plan_items').where({ plan_id: id }).orderBy('id', 'asc');
    return res.json({ success: true, data: { ...plan, items } });
  } catch (err) {
    console.error('Error getting AI generated plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to get AI generated plan' });
  }
};

exports.listGeneratedPlans = async (req, res) => {
  try {
    const { user_id } = req.query;
    const qb = db('app_ai_generated_plans').select('*').orderBy('created_at', 'desc');
    if (user_id) qb.where({ user_id });
    const rows = await qb;
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing AI generated plans:', err);
    return res.status(500).json({ success: false, message: 'Failed to list AI generated plans' });
  }
};


