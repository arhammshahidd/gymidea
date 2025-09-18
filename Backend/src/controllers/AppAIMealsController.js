const db = require('../config/db');

function sumMacros(items) {
  return items.reduce((acc, it) => {
    acc.total_calories += Number(it.calories || 0);
    acc.total_proteins += Number(it.proteins || 0);
    acc.total_fats += Number(it.fats || 0);
    acc.total_carbs += Number(it.carbs || 0);
    return acc;
  }, { total_calories: 0, total_proteins: 0, total_fats: 0, total_carbs: 0 });
}

// AI Meal Plan Requests
exports.createRequest = async (req, res) => {
  try {
    const { user_id, meal_plan, age, height_cm, weight_kg, gender, country, illness, future_goal } = req.body;
    const gymId = req.user?.gym_id ?? null;
    if (!user_id || !meal_plan || !age || !height_cm || !weight_kg || !gender || !country || !future_goal) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    }
    const [row] = await db('app_ai_meal_plan_requests').insert({ user_id, gym_id: gymId, meal_plan, age, height_cm, weight_kg, gender, country, illness: illness || null, future_goal }).returning('*');
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('Error creating AI meal plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to create AI meal plan request' });
  }
};

exports.updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { meal_plan, age, height_cm, weight_kg, gender, country, illness, future_goal } = req.body;
    const existing = await db('app_ai_meal_plan_requests').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
    const [updated] = await db('app_ai_meal_plan_requests').where({ id }).update({ meal_plan, age, height_cm, weight_kg, gender, country, illness: illness || null, future_goal, updated_at: new Date() }).returning('*');
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating AI meal plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to update AI meal plan request' });
  }
};

exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('app_ai_meal_plan_requests').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
    await db('app_ai_meal_plan_requests').where({ id }).del();
    return res.json({ success: true, message: 'Request deleted' });
  } catch (err) {
    console.error('Error deleting AI meal plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete AI meal plan request' });
  }
};

exports.getRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await db('app_ai_meal_plan_requests').where({ id }).first();
    if (!row) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('Error getting AI meal plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to get AI meal plan request' });
  }
};

exports.listRequests = async (req, res) => {
  try {
    const { user_id } = req.query;
    const qb = db('app_ai_meal_plan_requests').select('*').orderBy('created_at', 'desc');
    if (user_id) qb.where({ user_id });
    const rows = await qb;
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing AI meal plan requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to list AI meal plan requests' });
  }
};

// AI Generated Meal Plans
exports.createGeneratedPlan = async (req, res) => {
  try {
    const { request_id, user_id, start_date, end_date, meal_category, items = [] } = req.body;
    const gymId = req.user?.gym_id ?? null;
    if (!request_id || !user_id || !start_date || !end_date || !meal_category) {
      return res.status(400).json({ success: false, message: 'request_id, user_id, start_date, end_date, meal_category are required' });
    }

    const macroTotals = sumMacros(Array.isArray(items) ? items : []);

    const [plan] = await db('app_ai_generated_meal_plans').insert({
      request_id, user_id, gym_id: gymId, meal_category, start_date, end_date,
      ...macroTotals
    }).returning('*');

    if (Array.isArray(items) && items.length) {
      const rows = items.map((it) => ({
        plan_id: plan.id,
        date: it.date || null,
        meal_type: it.meal_type,
        food_item_name: it.food_item_name,
        grams: it.grams,
        calories: it.calories || 0,
        proteins: it.proteins || 0,
        fats: it.fats || 0,
        carbs: it.carbs || 0,
      }));
      await db('app_ai_generated_meal_plan_items').insert(rows);
    }

    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    console.error('Error creating AI generated meal plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to create AI generated meal plan' });
  }
};

exports.updateGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, meal_category, items } = req.body;
    const existing = await db('app_ai_generated_meal_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });

    let macroTotals = {
      total_calories: existing.total_calories,
      total_proteins: existing.total_proteins,
      total_fats: existing.total_fats,
      total_carbs: existing.total_carbs,
    };
    if (Array.isArray(items)) {
      macroTotals = sumMacros(items);
    }

    const [updated] = await db('app_ai_generated_meal_plans')
      .where({ id })
      .update({ start_date, end_date, meal_category, ...macroTotals, updated_at: new Date() })
      .returning('*');

    if (Array.isArray(items)) {
      await db('app_ai_generated_meal_plan_items').where({ plan_id: id }).del();
      if (items.length) {
        const rows = items.map((it) => ({
          plan_id: id,
          date: it.date || null,
          meal_type: it.meal_type,
          food_item_name: it.food_item_name,
          grams: it.grams,
          calories: it.calories || 0,
          proteins: it.proteins || 0,
          fats: it.fats || 0,
          carbs: it.carbs || 0,
        }));
        await db('app_ai_generated_meal_plan_items').insert(rows);
      }
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating AI generated meal plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to update AI generated meal plan' });
  }
};

exports.deleteGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('app_ai_generated_meal_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });
    await db('app_ai_generated_meal_plans').where({ id }).del();
    return res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    console.error('Error deleting AI generated meal plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete AI generated meal plan' });
  }
};

exports.getGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await db('app_ai_generated_meal_plans').where({ id }).first();
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    const items = await db('app_ai_generated_meal_plan_items').where({ plan_id: id }).orderBy(['date', 'id']);
    return res.json({ success: true, data: { ...plan, items } });
  } catch (err) {
    console.error('Error getting AI generated meal plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to get AI generated meal plan' });
  }
};

exports.listGeneratedPlans = async (req, res) => {
  try {
    const { user_id } = req.query;
    const qb = db('app_ai_generated_meal_plans').select('*').orderBy('created_at', 'desc');
    if (user_id) qb.where({ user_id });
    const rows = await qb;
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing AI generated meal plans:', err);
    return res.status(500).json({ success: false, message: 'Failed to list AI generated meal plans' });
  }
};


