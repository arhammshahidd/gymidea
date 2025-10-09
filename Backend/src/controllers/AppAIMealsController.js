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

function groupItemsByDateOrDistribute(items, start, end) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1)

  // If items already have a date, group by date
  const hasDate = items.some(it => it.date)
  if (hasDate) {
    const map = new Map()
    for (const it of items) {
      const key = (it.date ? new Date(it.date) : null)
      const d = key ? new Date(Date.UTC(key.getFullYear(), key.getMonth(), key.getDate())) : null
      const iso = d ? d.toISOString().split('T')[0] : null
      if (!iso) continue
      if (!map.has(iso)) map.set(iso, [])
      map.get(iso).push(it)
    }
    const days = []
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const iso = d.toISOString().split('T')[0]
      days.push({ date: iso, items: map.get(iso) || [] })
    }
    return days
  }

  // Otherwise distribute evenly across days
  const days = []
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    days.push({ date: d.toISOString().split('T')[0], items: [] })
  }
  for (let i = 0; i < items.length; i++) {
    const idx = i % days.length
    days[idx].items.push(items[i])
  }
  return days
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
    // Accept alternate field names from mobile clients
    const {
      request_id: rawRequestId,
      user_id,
      start_date,
      end_date,
      meal_category,
      meal_plan_category,
      menu_plan_category,
      meal_plan, // sometimes used as category name
      items = [],
      name,
      email,
      contact,
      description,
    } = req.body;

    const gymId = req.user?.gym_id ?? null;
    const resolvedCategory = (meal_category || meal_plan_category || menu_plan_category || meal_plan || '').toString().trim();
    const request_id = rawRequestId ?? null; // optional for direct posts

    if (!user_id || !start_date || !end_date || !resolvedCategory) {
      return res.status(400).json({ success: false, message: 'user_id, start_date, end_date, and meal_category are required' });
    }

    const macroTotals = sumMacros(Array.isArray(items) ? items : []);
    const dailyPlansArr = groupItemsByDateOrDistribute(Array.isArray(items) ? items : [], start_date, end_date);
    
    // Validate date format
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    if (startDate > endDate) {
      return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
    }

    const [plan] = await db('app_ai_generated_meal_plans').insert({
      request_id,
      user_id,
      gym_id: gymId,
      meal_category: resolvedCategory,
      start_date,
      end_date,
      // approval-like fields
      name: name || null,
      email: email || null,
      contact: contact || null,
      description: description || null,
      menu_plan_category: resolvedCategory, // alias for consistency
      total_days: Math.max(1, Math.ceil((new Date(end_date) - new Date(start_date)) / (1000*60*60*24)) + 1),
      approval_status: 'PENDING',
      // nutrition totals
      total_calories: macroTotals.total_calories,
      total_proteins: macroTotals.total_proteins,
      total_fats: macroTotals.total_fats,
      total_carbs: macroTotals.total_carbs,
      // new daily plans JSON
      daily_plans: JSON.stringify(dailyPlansArr),
    }).returning('*');

    if (Array.isArray(items) && items.length) {
      const rows = items.map((it) => {
        // Validate required fields for each item
        if (!it.meal_type || !it.food_item_name || it.grams === undefined || it.grams === null) {
          throw new Error(`Invalid meal item: missing required fields (meal_type, food_item_name, grams)`);
        }
        
        // Validate meal_type enum
        const validMealTypes = ['Breakfast', 'Lunch', 'Dinner'];
        if (!validMealTypes.includes(it.meal_type)) {
          throw new Error(`Invalid meal_type: ${it.meal_type}. Must be one of: ${validMealTypes.join(', ')}`);
        }
        
        return {
          plan_id: plan.id,
          date: it.date || null,
          meal_type: it.meal_type,
          food_item_name: it.food_item_name,
          grams: Number(it.grams) || 0,
          calories: Number(it.calories) || 0,
          proteins: Number(it.proteins) || 0,
          fats: Number(it.fats) || 0,
          carbs: Number(it.carbs) || 0,
          // extras
          notes: it.notes || null,
          raw_item: it.raw_item ? JSON.stringify(it.raw_item) : null,
        };
      });
      await db('app_ai_generated_meal_plan_items').insert(rows);
    }

    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    console.error('Error creating AI generated meal plan:', err);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    console.error('Error details:', err.message, err.code, err.constraint);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create AI generated meal plan',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.updateGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, meal_category, items, name, email, contact, description, approval_status, approval_notes, approved_by, approved_at } = req.body;
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

    const totalDays = (start_date && end_date)
      ? Math.max(1, Math.ceil((new Date(end_date) - new Date(start_date)) / (1000*60*60*24)) + 1)
      : existing.total_days

    const dailyPlansArr = Array.isArray(items)
      ? groupItemsByDateOrDistribute(items, start_date || existing.start_date, end_date || existing.end_date)
      : undefined

    const updates = {
      start_date,
      end_date,
      meal_category,
      menu_plan_category: meal_category,
      name: name ?? existing.name,
      email: email ?? existing.email,
      contact: contact ?? existing.contact,
      description: description ?? existing.description,
      total_days: totalDays,
      approval_status: approval_status ?? existing.approval_status,
      approval_notes: approval_notes ?? existing.approval_notes,
      approved_by: approved_by ?? existing.approved_by,
      approved_at: approved_at ?? existing.approved_at,
      ...macroTotals,
      updated_at: new Date(),
    };

    if (dailyPlansArr) {
      updates.daily_plans = JSON.stringify(dailyPlansArr)
    }

    const [updated] = await db('app_ai_generated_meal_plans')
      .where({ id })
      .update(updates)
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
          notes: it.notes || null,
          raw_item: it.raw_item ? JSON.stringify(it.raw_item) : null,
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


// Bulk insert items for an existing generated meal plan
exports.bulkInsertItems = async (req, res) => {
  try {
    const { items } = req.body || {};
    const authUser = req.user || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required' });
    }
    if (items.length > 200) {
      return res.status(400).json({ success: false, message: 'items chunk too large (max 200)' });
    }

    // Validate all items minimally and collect plan_ids
    const planIds = new Set();
    for (const it of items) {
      if (!it || typeof it !== 'object') {
        return res.status(400).json({ success: false, message: 'Each item must be an object' });
      }
      if (!it.plan_id) {
        return res.status(400).json({ success: false, message: 'Each item must include plan_id' });
      }
      if (!it.meal_type || !it.food_item_name || it.grams === undefined || it.grams === null) {
        return res.status(400).json({ success: false, message: 'Each item requires meal_type, food_item_name, grams' });
      }
      const validMealTypes = ['Breakfast', 'Lunch', 'Dinner'];
      if (!validMealTypes.includes(it.meal_type)) {
        return res.status(400).json({ success: false, message: `Invalid meal_type: ${it.meal_type}` });
      }
      planIds.add(it.plan_id);
    }

    // Ensure all referenced plans exist and belong to same gym (if applicable)
    const plans = await db('app_ai_generated_meal_plans').whereIn('id', Array.from(planIds));
    if (plans.length !== planIds.size) {
      return res.status(400).json({ success: false, message: 'One or more plan_id do not exist' });
    }
    if (authUser?.gym_id) {
      const allSameGym = plans.every(p => p.gym_id === authUser.gym_id);
      if (!allSameGym) {
        return res.status(403).json({ success: false, message: 'Forbidden: plan belongs to different gym' });
      }
    }

    const rows = items.map((it) => ({
      plan_id: it.plan_id,
      date: it.date || null,
      meal_type: it.meal_type,
      food_item_name: it.food_item_name,
      grams: Number(it.grams) || 0,
      calories: Number(it.calories) || 0,
      proteins: Number(it.proteins) || 0,
      fats: Number(it.fats) || 0,
      carbs: Number(it.carbs) || 0,
      notes: it.notes || null,
      raw_item: it.raw_item ? JSON.stringify(it.raw_item) : null,
    }));

    const inserted = await db('app_ai_generated_meal_plan_items').insert(rows);
    // Update aggregate nutrition totals per affected plan (simple re-sum)
    for (const p of plans) {
      const agg = await db('app_ai_generated_meal_plan_items')
        .where({ plan_id: p.id })
        .sum({ total_calories: 'calories', total_proteins: 'proteins', total_fats: 'fats', total_carbs: 'carbs' })
        .first();
      await db('app_ai_generated_meal_plans')
        .where({ id: p.id })
        .update({
          total_calories: Number(agg?.total_calories || 0),
          total_proteins: Number(agg?.total_proteins || 0),
          total_fats: Number(agg?.total_fats || 0),
          total_carbs: Number(agg?.total_carbs || 0),
          updated_at: new Date(),
        });
    }

    return res.status(201).json({ success: true, inserted: rows.length });
  } catch (err) {
    console.error('Error bulk inserting AI meal plan items:', err);
    return res.status(500).json({ success: false, message: 'Failed to bulk insert items' });
  }
};
