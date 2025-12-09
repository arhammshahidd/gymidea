const db = require('../config/db');

// Helper function to create daily nutrition plans from meal plan
async function createDailyNutritionPlansFromPlan(plan, items, user_id, gym_id) {
  try {
    const startDate = new Date(plan.start_date);
    const endDate = new Date(plan.end_date);
    const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
    
    const dailyPlans = [];
    
    for (let i = 0; i < totalDays; i++) {
      // Calculate day_number from array index (1-indexed: Day 1, Day 2, etc.)
      const dayNumber = i + 1;
      
      // Distribute items across days
      const itemsPerDay = Math.ceil(items.length / totalDays);
      const dayItems = items.slice(i * itemsPerDay, (i + 1) * itemsPerDay);
      
      const dailyTotals = dayItems.reduce((totals, item) => {
        totals.calories += Number(item.calories || 0);
        totals.proteins += Number(item.proteins || 0);
        totals.fats += Number(item.fats || 0);
        totals.carbs += Number(item.carbs || 0);
        return totals;
      }, { calories: 0, proteins: 0, fats: 0, carbs: 0 });
      
      dailyPlans.push({
        user_id,
        gym_id,
        day_number: dayNumber,
        plan_type: 'manual',
        source_plan_id: plan.id,
        plan_category: plan.meal_category,
        total_calories: dailyTotals.calories,
        total_proteins: dailyTotals.proteins,
        total_fats: dailyTotals.fats,
        total_carbs: dailyTotals.carbs,
        meal_details: JSON.stringify(dayItems)
      });
    }
    
    // Insert daily plans
    const insertedPlans = await db('daily_nutrition_plans').insert(dailyPlans).returning('*');
    
    // Insert plan items
    for (const dailyPlan of insertedPlans) {
      const meals = JSON.parse(dailyPlan.meal_details || '[]');
      if (meals.length > 0) {
        const items = meals.map(meal => ({
          daily_plan_id: dailyPlan.id,
          meal_type: meal.meal_type || 'Breakfast',
          food_item_name: meal.food_item_name || 'Food Item',
          grams: meal.grams || 0,
          calories: meal.calories || 0,
          proteins: meal.proteins || 0,
          fats: meal.fats || 0,
          carbs: meal.carbs || 0,
          notes: null
        }));
        
        await db('daily_nutrition_plan_items').insert(items);
      }
    }
    
    console.log(`Created ${insertedPlans.length} daily nutrition plans for user ${user_id}`);
    return insertedPlans;
  } catch (error) {
    console.error('Error creating daily nutrition plans:', error);
    return [];
  }
}

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

    let planItems = [];
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
      planItems = await db('app_manual_meal_plan_items').insert(rows).returning('*');
    }

    // Automatically create daily plans for easy mobile access
    try {
      await createDailyNutritionPlansFromPlan(plan, planItems, user_id, gymId);
    } catch (dailyPlanError) {
      console.error('Failed to create daily nutrition plans:', dailyPlanError);
      // Don't fail the main request if daily plans creation fails
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
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    let query = db('app_manual_meal_plans').where({ id });
    
    // SECURITY: Ensure proper user isolation
    if (requestingUserRole !== 'gym_admin' && requestingUserRole !== 'trainer') {
      // Regular users can only access their own plans
      query = query.andWhere({ user_id: requestingUserId, gym_id: req.user.gym_id });
    } else {
      // Admin/trainer can access any plan in their gym
      query = query.andWhere({ gym_id: req.user.gym_id });
    }
    
    const plan = await query.first();
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
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    let qb = db('app_manual_meal_plans')
      .select('*')
      .orderBy('created_at', 'desc');
    
    // SECURITY: Ensure proper user isolation
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      // Admin/trainer can see plans for specific users or all users in their gym
      if (user_id) {
        qb = qb.where({ user_id: Number(user_id), gym_id: req.user.gym_id });
      } else {
        qb = qb.where({ gym_id: req.user.gym_id });
      }
    } else {
      // Regular users can only see their own plans
      // Ignore user_id from query and use authenticated user's ID
      qb = qb.where({ user_id: requestingUserId, gym_id: req.user.gym_id });
    }
    
    const plans = await qb;
    return res.json({ success: true, data: plans });
  } catch (err) {
    console.error('Error listing manual meal plans:', err);
    return res.status(500).json({ success: false, message: 'Failed to list manual meal plans' });
  }
};


