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

exports.createPlan = async (req, res) => {
  try {
    const { user_id, meal_category, start_date, end_date, items = [] } = req.body;
    const gymId = req.user?.gym_id ?? null;
    if (!user_id || !meal_category || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'user_id, meal_category, start_date, end_date are required' });
    }

    const macroTotals = sumMacros(Array.isArray(items) ? items : []);

    const [plan] = await db('app_manual_meal_plans').insert({
      user_id,
      gym_id: gymId,
      meal_category,
      start_date,
      end_date,
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
      await db('app_manual_meal_plan_items').insert(rows);
    }

    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    console.error('Error creating manual meal plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to create manual meal plan' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { meal_category, start_date, end_date, items } = req.body;

    const existing = await db('app_manual_meal_plans').where({ id }).first();
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

    const [updated] = await db('app_manual_meal_plans')
      .where({ id })
      .update({ meal_category, start_date, end_date, ...macroTotals, updated_at: new Date() })
      .returning('*');

    if (Array.isArray(items)) {
      await db('app_manual_meal_plan_items').where({ plan_id: id }).del();
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
        await db('app_manual_meal_plan_items').insert(rows);
      }
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating manual meal plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to update manual meal plan' });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('app_manual_meal_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });
    await db('app_manual_meal_plans').where({ id }).del();
    return res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    console.error('Error deleting manual meal plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete manual meal plan' });
  }
};

exports.getPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await db('app_manual_meal_plans').where({ id }).first();
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    const items = await db('app_manual_meal_plan_items').where({ plan_id: id }).orderBy(['date', 'id']);
    return res.json({ success: true, data: { ...plan, items } });
  } catch (err) {
    console.error('Error getting manual meal plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to get manual meal plan' });
  }
};

exports.listPlans = async (req, res) => {
  try {
    const { user_id } = req.query;
    const qb = db('app_manual_meal_plans').select('*').orderBy('created_at', 'desc');
    if (user_id) qb.where({ user_id });
    const plans = await qb;
    return res.json({ success: true, data: plans });
  } catch (err) {
    console.error('Error listing manual meal plans:', err);
    return res.status(500).json({ success: false, message: 'Failed to list manual meal plans' });
  }
};


