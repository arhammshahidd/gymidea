const db = require('../config/db');

// Helper function to generate daily plans from existing plans
async function generateDailyPlansFromExistingPlan(planType, sourcePlanId, user_id, gym_id, start_date, end_date) {
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
  
  const dailyPlans = [];
  
  for (let i = 0; i < totalDays; i++) {
    const dayNumber = i + 1; // Day 1, Day 2, ...
    
    if (planType === 'training') {
      // Get training plan details
      let planData = null;
      let items = [];
      
      if (sourcePlanId) {
        // Get from appropriate training plan table
        const planTables = [
          'app_manual_training_plans',
          'app_ai_generated_plans', 
          'training_plans'
        ];
        
        for (const table of planTables) {
          planData = await db(table).where({ id: sourcePlanId }).first();
          if (planData) {
            // Get items from corresponding items table
            const itemTables = [
              'app_manual_training_plan_items',
              'app_ai_generated_plan_items',
              'training_plan_items'
            ];
            
            const itemTableIndex = planTables.indexOf(table);
            if (itemTableIndex < itemTables.length) {
              items = await db(itemTables[itemTableIndex]).where({ plan_id: sourcePlanId });
            }
            break;
          }
        }
      }
      
      if (planData) {
        dailyPlans.push({
          user_id,
          gym_id,
          day_number: dayNumber,
          plan_type: 'manual', // or determine from source
          source_plan_id: sourcePlanId,
          plan_category: planData.exercise_plan_category || planData.category || 'General',
          // workout_name removed - can be derived from exercises_details if needed
          // Totals are now calculated from exercises_details when needed
          user_level: planData.user_level || 'Beginner',
          exercises_details: JSON.stringify(items)
        });
      }
    } else if (planType === 'nutrition') {
      // Get nutrition plan details
      let planData = null;
      let items = [];
      
      if (sourcePlanId) {
        // Get from appropriate nutrition plan table
        const planTables = [
          'app_manual_meal_plans',
          'app_ai_generated_meal_plans'
        ];
        
        for (const table of planTables) {
          planData = await db(table).where({ id: sourcePlanId }).first();
          if (planData) {
            // Get items from corresponding items table
            const itemTables = [
              'app_manual_meal_plan_items',
              'app_ai_generated_meal_plan_items'
            ];
            
            const itemTableIndex = planTables.indexOf(table);
            if (itemTableIndex < itemTables.length) {
              items = await db(itemTables[itemTableIndex]).where({ plan_id: sourcePlanId });
            }
            break;
          }
        }
      }
      
      if (planData) {
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
          plan_type: 'manual', // or determine from source
          source_plan_id: sourcePlanId,
          plan_category: planData.meal_category || planData.meal_plan_category || 'General',
          total_calories: dailyTotals.calories,
          total_proteins: dailyTotals.proteins,
          total_fats: dailyTotals.fats,
          total_carbs: dailyTotals.carbs,
          meal_details: JSON.stringify(dayItems)
        });
      }
    }
  }
  
  return dailyPlans;
}

// Create daily training plans
exports.createDailyTrainingPlans = async (req, res) => {
  try {
    const { user_id, source_plan_id, start_date, end_date, plan_category, exercises } = req.body;
    const gym_id = req.user?.gym_id || null;
    
    if (!user_id || !start_date || !end_date || !plan_category) {
      return res.status(400).json({ 
        success: false, 
        message: 'user_id, start_date, end_date, and plan_category are required' 
      });
    }
    
    // Generate daily plans
    const dailyPlans = await generateDailyPlansFromExistingPlan('training', source_plan_id, user_id, gym_id, start_date, end_date);
    
    // If no source plan, create from provided exercises
    if (dailyPlans.length === 0 && exercises) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
      
      for (let i = 0; i < totalDays; i++) {
        const dayNumber = i + 1;
        
        const exerciseArray = Array.isArray(exercises) ? exercises : [];
        const totalSets = exerciseArray.reduce((sum, ex) => sum + (ex.sets || 0), 0);
        const totalReps = exerciseArray.reduce((sum, ex) => sum + (ex.reps || 0), 0);
        const totalWeight = exerciseArray.reduce((sum, ex) => sum + (ex.weight_kg || 0), 0);
        const totalMinutes = exerciseArray.reduce((sum, ex) => sum + (ex.minutes || 0), 0);
        
        dailyPlans.push({
          user_id,
          gym_id,
          day_number: dayNumber,
          plan_type: 'manual',
          source_plan_id: source_plan_id || null,
          plan_category,
          // workout_name removed
          user_level: 'Beginner',
          exercises_details: JSON.stringify(exerciseArray)
        });
      }
    }
    
    // Insert daily plans
    const insertedPlans = await db('daily_training_plans').insert(dailyPlans).returning('*');
    
    // Insert plan items if provided
    for (const plan of insertedPlans) {
      const exercises = JSON.parse(plan.exercises_details || '[]');
      if (exercises.length > 0) {
        const items = exercises.map(ex => ({
          daily_plan_id: plan.id,
          exercise_name: ex.exercise_name || ex.workout_name || 'Exercise',
          sets: ex.sets || 0,
          reps: ex.reps || 0,
          weight_kg: ex.weight_kg || 0,
          minutes: ex.minutes || 0,
          exercise_type: ex.exercise_type || null,
          notes: ex.notes || null
        }));
        
        // Items are now stored in exercises_details JSON column
        // No need to insert into daily_training_plan_items table
      }
    }
    
    res.status(201).json({ 
      success: true, 
      data: insertedPlans,
      message: `Created ${insertedPlans.length} daily training plans`
    });
  } catch (err) {
    console.error('Error creating daily training plans:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create daily training plans' 
    });
  }
};

// Create daily nutrition plans
exports.createDailyNutritionPlans = async (req, res) => {
  try {
    const { user_id, plan_type, source_plan_id, start_date, end_date, plan_category, meals } = req.body;
    const gym_id = req.user?.gym_id || null;
    
    if (!user_id || !start_date || !end_date || !plan_category) {
      return res.status(400).json({ 
        success: false, 
        message: 'user_id, start_date, end_date, and plan_category are required' 
      });
    }
    
    // Generate daily plans
    const dailyPlans = await generateDailyPlansFromExistingPlan('nutrition', source_plan_id, user_id, gym_id, start_date, end_date);
    
    // If no source plan, create from provided meals
    if (dailyPlans.length === 0 && meals) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
      
  for (let i = 0; i < totalDays; i++) {
    const dayNumber = i + 1; // Day index (1-based)
        
        const mealArray = Array.isArray(meals) ? meals : [];
        const dailyTotals = mealArray.reduce((totals, meal) => {
          totals.calories += Number(meal.calories || 0);
          totals.proteins += Number(meal.proteins || 0);
          totals.fats += Number(meal.fats || 0);
          totals.carbs += Number(meal.carbs || 0);
          return totals;
        }, { calories: 0, proteins: 0, fats: 0, carbs: 0 });
        
        dailyPlans.push({
          user_id,
          gym_id,
          day_number: dayNumber,
          plan_type: plan_type || 'manual',
          source_plan_id: source_plan_id || null,
          plan_category,
          total_calories: dailyTotals.calories,
          total_proteins: dailyTotals.proteins,
          total_fats: dailyTotals.fats,
          total_carbs: dailyTotals.carbs,
          meal_details: JSON.stringify(mealArray)
        });
      }
    }
    
    // Insert daily plans
    const insertedPlans = await db('daily_nutrition_plans').insert(dailyPlans).returning('*');
    
    // Insert plan items if provided
    for (const plan of insertedPlans) {
      const meals = JSON.parse(plan.meal_details || '[]');
      if (meals.length > 0) {
        const items = meals.map(meal => ({
          daily_plan_id: plan.id,
          meal_type: meal.meal_type || 'Breakfast',
          food_item_name: meal.food_item_name || meal.name || 'Food Item',
          grams: meal.grams || 0,
          calories: meal.calories || 0,
          proteins: meal.proteins || 0,
          fats: meal.fats || 0,
          carbs: meal.carbs || 0,
          notes: meal.notes || null
        }));
        
        await db('daily_nutrition_plan_items').insert(items);
      }
    }
    
    res.status(201).json({ 
      success: true, 
      data: insertedPlans,
      message: `Created ${insertedPlans.length} daily nutrition plans`
    });
  } catch (err) {
    console.error('Error creating daily nutrition plans:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create daily nutrition plans' 
    });
  }
};

// Get user's daily plans using day_number (manual/assigned/ai)
exports.getUserDailyPlans = async (req, res) => {
  try {
    const { user_id, start_day, end_day, plan_type } = req.query;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    // SECURITY: Ensure proper user isolation
    let targetUserId;
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      if (!user_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'user_id is required' 
        });
      }
      targetUserId = Number(user_id);
    } else {
      targetUserId = requestingUserId;
    }
    
    const startDayNumber = start_day ? Number(start_day) : null;
    const endDayNumber = end_day ? Number(end_day) : null;
    
    // Get training plans (day_number based)
    const trainingPlans = await db('daily_training_plans')
      .where({ user_id: targetUserId })
      .modify((qb) => {
        if (startDayNumber != null) qb.where('day_number', '>=', startDayNumber);
        if (endDayNumber != null) qb.where('day_number', '<=', endDayNumber);
        if (plan_type) qb.where('plan_type', plan_type);
      })
      .orderBy('source_plan_id', 'asc')
      .orderBy('day_number', 'asc');
    
    // Get nutrition plans (day_number based)
    const nutritionPlans = await db('daily_nutrition_plans')
      .where({ user_id: targetUserId })
      .modify((qb) => {
        if (startDayNumber != null) qb.where('day_number', '>=', startDayNumber);
        if (endDayNumber != null) qb.where('day_number', '<=', endDayNumber);
        if (plan_type) qb.where('plan_type', plan_type);
      })
      .orderBy('source_plan_id', 'asc')
      .orderBy('day_number', 'asc');
    
    // Get detailed items for each plan
    const trainingPlanIds = trainingPlans.map(p => p.id);
    const nutritionPlanIds = nutritionPlans.map(p => p.id);
    
    // Items are now stored in exercises_details JSON column
    // Parse items from exercises_details for each plan
    const trainingItems = [];
    for (const plan of trainingPlans) {
      try {
        const details = plan.exercises_details;
        if (details) {
          const parsed = typeof details === 'string' ? JSON.parse(details) : details;
          if (Array.isArray(parsed)) {
            trainingItems.push(...parsed);
          } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.workouts)) {
            trainingItems.push(...parsed.workouts);
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
    
    const nutritionItems = nutritionPlanIds.length > 0
      ? await db('daily_nutrition_plan_items').whereIn('daily_plan_id', nutritionPlanIds)
      : [];
    
    // Group items by plan
    const trainingItemsByPlan = trainingItems.reduce((acc, item) => {
      if (!acc[item.daily_plan_id]) acc[item.daily_plan_id] = [];
      acc[item.daily_plan_id].push(item);
      return acc;
    }, {});
    
    const nutritionItemsByPlan = nutritionItems.reduce((acc, item) => {
      if (!acc[item.daily_plan_id]) acc[item.daily_plan_id] = [];
      acc[item.daily_plan_id].push(item);
      return acc;
    }, {});
    
    // Attach items to plans
    const enrichedTrainingPlans = trainingPlans.map(plan => ({
      ...plan,
      exercises_details: JSON.parse(plan.exercises_details || '[]'),
      items: trainingItemsByPlan[plan.id] || []
    }));
    
    const enrichedNutritionPlans = nutritionPlans.map(plan => ({
      ...plan,
      meal_details: JSON.parse(plan.meal_details || '[]'),
      items: nutritionItemsByPlan[plan.id] || []
    }));
    
    res.json({ 
      success: true, 
      data: {
        training_plans: enrichedTrainingPlans,
        nutrition_plans: enrichedNutritionPlans
      }
    });
  } catch (err) {
    console.error('Error getting user daily plans:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get user daily plans' 
    });
  }
};

// Update daily plan completion status
exports.updateDailyPlanCompletion = async (req, res) => {
  try {
    const { plan_id, plan_type, is_completed, completion_notes } = req.body;
    
    if (!plan_id || !plan_type) {
      return res.status(400).json({ 
        success: false, 
        message: 'plan_id and plan_type are required' 
      });
    }
    
    const tableName = plan_type === 'training' ? 'daily_training_plans' : 'daily_nutrition_plans';
    
    const updates = {
      is_completed: is_completed || false,
      updated_at: new Date()
    };
    
    if (is_completed) {
      updates.completed_at = new Date();
    } else {
      updates.completed_at = null;
    }
    
    if (completion_notes) {
      updates.completion_notes = completion_notes;
    }
    
    const [updated] = await db(tableName)
      .where({ id: plan_id })
      .update(updates)
      .returning('*');
    
    if (!updated) {
      return res.status(404).json({ 
        success: false, 
        message: 'Plan not found' 
      });
    }

    // Auto-sync user stats after completion (only for training plans)
    if (plan_type === 'training' && is_completed) {
      try {
        const { updateUserStats } = require('../utils/statsCalculator');
        await updateUserStats(updated.user_id);
        console.log('✅ User stats synced automatically after plan completion');
      } catch (statsErr) {
        console.error('⚠️ Failed to auto-sync user stats:', statsErr);
        // Don't fail the request if stats sync fails
      }
    }
    
    res.json({ 
      success: true, 
      data: updated,
      message: 'Plan completion status updated'
    });
  } catch (err) {
    console.error('Error updating daily plan completion:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update plan completion status' 
    });
  }
};

// Get today's plans for a user (using day_number)
exports.getTodaysPlans = async (req, res) => {
  try {
    const { user_id } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    if (!user_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'user_id is required' 
      });
    }
    
    // SECURITY: Ensure proper user isolation
    let targetUserId = user_id;
    if (requestingUserRole !== 'gym_admin' && requestingUserRole !== 'trainer') {
      // Regular users can only access their own plans
      targetUserId = requestingUserId;
    }
    
    // Get today's training plan using day_number-based logic
    // Since day_number is sequential and doesn't depend on dates, we find the next incomplete plan
    // This is more aligned with the day_number system than trying to map "today" to a day_number
    const trainingPlans = await db('daily_training_plans')
      .where({ user_id: targetUserId })
      .whereNotNull('day_number')
      .where('is_stats_record', false)
      .orderBy('source_plan_id', 'asc')
      .orderBy('day_number', 'asc');
    
    // Find the next incomplete plan (or most recent plan if all are completed)
    // Group by source_plan_id and find the first incomplete day_number
    const plansBySource = {};
    trainingPlans.forEach(plan => {
      const sourceId = plan.source_plan_id || 'no_source';
      if (!plansBySource[sourceId]) {
        plansBySource[sourceId] = [];
      }
      plansBySource[sourceId].push(plan);
    });
    
    // For each source, find the first incomplete plan, or the most recent plan if all completed
    let trainingPlan = null;
    Object.keys(plansBySource).forEach(sourceId => {
      const sourcePlans = plansBySource[sourceId];
      const incompletePlan = sourcePlans.find(p => !p.is_completed);
      if (incompletePlan) {
        if (!trainingPlan || incompletePlan.day_number < trainingPlan.day_number) {
          trainingPlan = incompletePlan;
        }
      } else if (sourcePlans.length > 0) {
        // All completed, use the most recent (highest day_number)
        const mostRecent = sourcePlans[sourcePlans.length - 1];
        if (!trainingPlan || mostRecent.day_number > trainingPlan.day_number) {
          trainingPlan = mostRecent;
        }
      }
    });
    
    // Similar logic for nutrition plans
    const nutritionPlans = await db('daily_nutrition_plans')
      .where({ user_id: targetUserId })
      .whereNotNull('day_number')
      .orderBy('source_plan_id', 'asc')
      .orderBy('day_number', 'asc');
    
    const nutritionPlansBySource = {};
    nutritionPlans.forEach(plan => {
      const sourceId = plan.source_plan_id || 'no_source';
      if (!nutritionPlansBySource[sourceId]) {
        nutritionPlansBySource[sourceId] = [];
      }
      nutritionPlansBySource[sourceId].push(plan);
    });
    
    let nutritionPlan = null;
    Object.keys(nutritionPlansBySource).forEach(sourceId => {
      const sourcePlans = nutritionPlansBySource[sourceId];
      const incompletePlan = sourcePlans.find(p => !p.is_completed);
      if (incompletePlan) {
        if (!nutritionPlan || incompletePlan.day_number < nutritionPlan.day_number) {
          nutritionPlan = incompletePlan;
        }
      } else if (sourcePlans.length > 0) {
        const mostRecent = sourcePlans[sourcePlans.length - 1];
        if (!nutritionPlan || mostRecent.day_number > nutritionPlan.day_number) {
          nutritionPlan = mostRecent;
        }
      }
    });
    
    // Get items for each plan
    let trainingItems = [];
    let nutritionItems = [];
    
    if (trainingPlan) {
      // Items are now stored in exercises_details JSON column
      // Parse items from exercises_details
      try {
        const details = trainingPlan.exercises_details;
        if (details) {
          const parsed = typeof details === 'string' ? JSON.parse(details) : details;
          if (Array.isArray(parsed)) {
            trainingItems = parsed;
          } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.workouts)) {
            trainingItems = parsed.workouts;
          }
        }
      } catch (e) {
        trainingItems = [];
      }
    }
    
    if (nutritionPlan) {
      nutritionItems = await db('daily_nutrition_plan_items')
        .where({ daily_plan_id: nutritionPlan.id });
    }
    
    const response = {
      date: today,
      training_plan: trainingPlan ? {
        ...trainingPlan,
        exercises_details: JSON.parse(trainingPlan.exercises_details || '[]'),
        items: trainingItems
      } : null,
      nutrition_plan: nutritionPlan ? {
        ...nutritionPlan,
        meal_details: JSON.parse(nutritionPlan.meal_details || '[]'),
        items: nutritionItems
      } : null
    };
    
    res.json({ 
      success: true, 
      data: response
    });
  } catch (err) {
    console.error('Error getting today\'s plans:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get today\'s plans' 
    });
  }
};

// Sync existing plans to daily plans
exports.syncExistingPlansToDaily = async (req, res) => {
  try {
    const { user_id, plan_type, source_plan_id } = req.body;
    
    if (!user_id || !plan_type || !source_plan_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'user_id, plan_type, and source_plan_id are required' 
      });
    }
    
    // Get the source plan
    let sourcePlan = null;
    let start_date, end_date, category;
    
    if (plan_type === 'training') {
      // Try different training plan tables
      const tables = ['app_manual_training_plans', 'app_ai_generated_plans', 'training_plans'];
      for (const table of tables) {
        sourcePlan = await db(table).where({ id: source_plan_id }).first();
        if (sourcePlan) {
          start_date = sourcePlan.start_date;
          end_date = sourcePlan.end_date;
          category = sourcePlan.exercise_plan_category || sourcePlan.category || 'General';
          break;
        }
      }
    } else if (plan_type === 'nutrition') {
      // Try different nutrition plan tables
      const tables = ['app_manual_meal_plans', 'app_ai_generated_meal_plans'];
      for (const table of tables) {
        sourcePlan = await db(table).where({ id: source_plan_id }).first();
        if (sourcePlan) {
          start_date = sourcePlan.start_date;
          end_date = sourcePlan.end_date;
          category = sourcePlan.meal_category || sourcePlan.meal_plan_category || 'General';
          break;
        }
      }
    }
    
    if (!sourcePlan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Source plan not found' 
      });
    }
    
    // Generate daily plans
    const dailyPlans = await generateDailyPlansFromExistingPlan(
      plan_type, 
      source_plan_id, 
      user_id, 
      req.user?.gym_id || null, 
      start_date, 
      end_date
    );
    
    if (dailyPlans.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No daily plans could be generated from source plan' 
      });
    }
    
    // Insert daily plans
    const tableName = plan_type === 'training' ? 'daily_training_plans' : 'daily_nutrition_plans';
    const insertedPlans = await db(tableName).insert(dailyPlans).returning('*');
    
    res.json({ 
      success: true, 
      data: insertedPlans,
      message: `Synced ${insertedPlans.length} daily ${plan_type} plans`
    });
  } catch (err) {
    console.error('Error syncing existing plans to daily:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to sync existing plans to daily plans' 
    });
  }
};
