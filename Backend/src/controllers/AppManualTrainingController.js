const db = require('../config/db');

exports.createPlan = async (req, res) => {
  try {
    const { user_id, start_date, end_date, exercise_plan_category, total_workouts, training_minutes, items = [] } = req.body;
    const gymId = req.user?.gym_id ?? null;

    if (!user_id || !start_date || !end_date || !exercise_plan_category) {
      return res.status(400).json({ success: false, message: 'user_id, start_date, end_date, and exercise_plan_category are required' });
    }

    // Insert plan
    const [plan] = await db('app_manual_training_plans')
      .insert({ user_id, gym_id: gymId, start_date, end_date, exercise_plan_category, total_workouts: total_workouts || 0, training_minutes: training_minutes || 0 })
      .returning('*');

    // Insert items if provided
    if (Array.isArray(items) && items.length) {
      const rows = items.map((it) => ({
        plan_id: plan.id,
        workout_name: it.workout_name,
        sets: it.sets || 0,
        reps: it.reps || 0,
        weight_kg: it.weight_kg || 0,
        minutes: it.minutes || 0,
      }));
      await db('app_manual_training_plan_items').insert(rows);
    }

    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    console.error('Error creating app manual training plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to create manual training plan' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, exercise_plan_category, total_workouts, training_minutes, items } = req.body;

    const existing = await db('app_manual_training_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });

    const [updated] = await db('app_manual_training_plans')
      .where({ id })
      .update({ start_date, end_date, exercise_plan_category, total_workouts, training_minutes, updated_at: new Date() })
      .returning('*');

    if (Array.isArray(items)) {
      await db('app_manual_training_plan_items').where({ plan_id: id }).del();
      if (items.length) {
        const rows = items.map((it) => ({
          plan_id: id,
          workout_name: it.workout_name,
          sets: it.sets || 0,
          reps: it.reps || 0,
          weight_kg: it.weight_kg || 0,
          minutes: it.minutes || 0,
        }));
        await db('app_manual_training_plan_items').insert(rows);
      }
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating app manual training plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to update manual training plan' });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('app_manual_training_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });
    await db('app_manual_training_plans').where({ id }).del();
    return res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    console.error('Error deleting app manual training plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete manual training plan' });
  }
};

exports.getPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await db('app_manual_training_plans').where({ id }).first();
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    const items = await db('app_manual_training_plan_items').where({ plan_id: id }).orderBy('id', 'asc');
    return res.json({ success: true, data: { ...plan, items } });
  } catch (err) {
    console.error('Error getting app manual training plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to get manual training plan' });
  }
};

exports.listPlans = async (req, res) => {
  try {
    const { user_id } = req.query;
    const qb = db('app_manual_training_plans').select('*').orderBy('created_at', 'desc');
    if (user_id) qb.where({ user_id });
    const plans = await qb;
    return res.json({ success: true, data: plans });
  } catch (err) {
    console.error('Error listing app manual training plans:', err);
    return res.status(500).json({ success: false, message: 'Failed to list manual training plans' });
  }
};


