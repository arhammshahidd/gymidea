const db = require('../config/db');

// Helper function to calculate nutrition totals
const calculateNutritionTotals = (mealItems) => {
  if (!mealItems || !Array.isArray(mealItems)) return { protein: 0, fats: 0, carbs: 0, calories: 0 };
  
  return mealItems.reduce((totals, item) => {
    return {
      protein: totals.protein + (parseFloat(item.protein) || 0),
      fats: totals.fats + (parseFloat(item.fats) || 0),
      carbs: totals.carbs + (parseFloat(item.carbs) || 0),
      calories: totals.calories + (parseFloat(item.total_calories) || 0)
    };
  }, { protein: 0, fats: 0, carbs: 0, calories: 0 });
};

// Helper function to calculate total daily nutrition
const calculateDailyTotals = (breakfast, lunch, dinner) => {
  const breakfastTotals = calculateNutritionTotals(breakfast);
  const lunchTotals = calculateNutritionTotals(lunch);
  const dinnerTotals = calculateNutritionTotals(dinner);
  
  return {
    total_daily_protein: breakfastTotals.protein + lunchTotals.protein + dinnerTotals.protein,
    total_daily_fats: breakfastTotals.fats + lunchTotals.fats + dinnerTotals.fats,
    total_daily_carbs: breakfastTotals.carbs + lunchTotals.carbs + dinnerTotals.carbs,
    total_daily_calories: breakfastTotals.calories + lunchTotals.calories + dinnerTotals.calories
  };
};

// List all food menus for the gym
exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, status, start_date, end_date } = req.query;
    
    const query = db('food_menu')
      .where('gym_id', req.user.gym_id)
      .orderBy('created_at', 'desc');
    
    // Apply filters
    if (category) query.andWhere('menu_plan_category', category);
    if (status) query.andWhere('status', status);
    if (start_date) query.andWhere('start_date', '>=', start_date);
    if (end_date) query.andWhere('end_date', '<=', end_date);
    
    const rows = await query
      .limit(limit)
      .offset((page - 1) * limit);
    
    const [{ count }] = await db('food_menu')
      .where('gym_id', req.user.gym_id)
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
  } catch (err) {
    next(err);
  }
};

// Get a single food menu by ID
exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const menu = await db('food_menu')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .first();
    
    if (!menu) {
      return res.status(404).json({
        success: false,
        message: 'Food menu not found'
      });
    }
    
    res.json({
      success: true,
      data: menu
    });
  } catch (err) {
    next(err);
  }
};

// Create a new food menu
exports.create = async (req, res, next) => {
  try {
    const {
      menu_plan_category,
      start_date,
      end_date,
      breakfast,
      lunch,
      dinner,
      status
    } = req.body;
    
    // Validate required fields
    if (!menu_plan_category || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'menu_plan_category, start_date, and end_date are required'
      });
    }
    
    // Validate menu plan category
    const validCategories = ['Weight Gain', 'Weight Lose', 'Muscle building'];
    if (!validCategories.includes(menu_plan_category)) {
      return res.status(400).json({
        success: false,
        message: 'menu_plan_category must be one of: Weight Gain, Weight Lose, Muscle building'
      });
    }
    
    // Calculate daily nutrition totals
    const dailyTotals = calculateDailyTotals(breakfast, lunch, dinner);
    
    // Create the food menu
    const [menu] = await db('food_menu')
      .insert({
        gym_id: req.user.gym_id,
        menu_plan_category,
        start_date,
        end_date,
        breakfast: breakfast ? JSON.stringify(breakfast) : null,
        lunch: lunch ? JSON.stringify(lunch) : null,
        dinner: dinner ? JSON.stringify(dinner) : null,
        total_daily_protein: dailyTotals.total_daily_protein,
        total_daily_fats: dailyTotals.total_daily_fats,
        total_daily_carbs: dailyTotals.total_daily_carbs,
        total_daily_calories: dailyTotals.total_daily_calories,
        status: status || 'ACTIVE'
      })
      .returning('*');
    
    // Parse JSON fields for response
    const responseMenu = {
      ...menu,
      breakfast: menu.breakfast ? JSON.parse(menu.breakfast) : null,
      lunch: menu.lunch ? JSON.parse(menu.lunch) : null,
      dinner: menu.dinner ? JSON.parse(menu.dinner) : null
    };
    
    res.status(201).json({
      success: true,
      data: responseMenu,
      message: 'Food menu created successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Update an existing food menu
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      menu_plan_category,
      start_date,
      end_date,
      breakfast,
      lunch,
      dinner,
      status
    } = req.body;
    
    // Check if menu exists
    const existingMenu = await db('food_menu')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .first();
    
    if (!existingMenu) {
      return res.status(404).json({
        success: false,
        message: 'Food menu not found'
      });
    }
    
    // Validate menu plan category if provided
    if (menu_plan_category) {
      const validCategories = ['Weight Gain', 'Weight Lose', 'Muscle building'];
      if (!validCategories.includes(menu_plan_category)) {
        return res.status(400).json({
          success: false,
          message: 'menu_plan_category must be one of: Weight Gain, Weight Lose, Muscle building'
        });
      }
    }
    
    // Calculate daily nutrition totals
    const dailyTotals = calculateDailyTotals(breakfast, lunch, dinner);
    
    // Prepare update data
    const updateData = {};
    if (menu_plan_category !== undefined) updateData.menu_plan_category = menu_plan_category;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (breakfast !== undefined) updateData.breakfast = breakfast ? JSON.stringify(breakfast) : null;
    if (lunch !== undefined) updateData.lunch = lunch ? JSON.stringify(lunch) : null;
    if (dinner !== undefined) updateData.dinner = dinner ? JSON.stringify(dinner) : null;
    if (status !== undefined) updateData.status = status;
    
    // Update nutrition totals
    updateData.total_daily_protein = dailyTotals.total_daily_protein;
    updateData.total_daily_fats = dailyTotals.total_daily_fats;
    updateData.total_daily_carbs = dailyTotals.total_daily_carbs;
    updateData.total_daily_calories = dailyTotals.total_daily_calories;
    
    const [updatedMenu] = await db('food_menu')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .update(updateData)
      .returning('*');
    
    // Parse JSON fields for response
    const responseMenu = {
      ...updatedMenu,
      breakfast: updatedMenu.breakfast ? JSON.parse(updatedMenu.breakfast) : null,
      lunch: updatedMenu.lunch ? JSON.parse(updatedMenu.lunch) : null,
      dinner: updatedMenu.dinner ? JSON.parse(updatedMenu.dinner) : null
    };
    
    res.json({
      success: true,
      data: responseMenu,
      message: 'Food menu updated successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Delete a food menu
exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const deletedCount = await db('food_menu')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .del();
    
    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Food menu not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Food menu deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Update food menu status
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be ACTIVE or INACTIVE'
      });
    }
    
    const [updatedMenu] = await db('food_menu')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .update({ status })
      .returning('*');
    
    if (!updatedMenu) {
      return res.status(404).json({
        success: false,
        message: 'Food menu not found'
      });
    }
    
    // Parse JSON fields for response
    const responseMenu = {
      ...updatedMenu,
      breakfast: updatedMenu.breakfast ? JSON.parse(updatedMenu.breakfast) : null,
      lunch: updatedMenu.lunch ? JSON.parse(updatedMenu.lunch) : null,
      dinner: updatedMenu.dinner ? JSON.parse(updatedMenu.dinner) : null
    };
    
    res.json({
      success: true,
      data: responseMenu,
      message: 'Food menu status updated successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Get food menu categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await db('food_menu')
      .where('gym_id', req.user.gym_id)
      .distinct('menu_plan_category')
      .pluck('menu_plan_category');
    
    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    next(err);
  }
};
