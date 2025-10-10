const db = require('../config/db');

// Assign a food menu to a user (simple linkage, no approval)
exports.assignToUser = async (req, res, next) => {
  try {
    const { food_menu_id, user_id, start_date, end_date, notes } = req.body
    if (!food_menu_id || !user_id) {
      return res.status(400).json({ success: false, message: 'food_menu_id and user_id are required' })
    }

    // Ensure menu exists for gym
    const menu = await db('food_menu')
      .where({ id: food_menu_id, gym_id: req.user.gym_id }).first()
    if (!menu) {
      return res.status(404).json({ success: false, message: 'Food menu not found' })
    }

    console.log('Backend: Found menu for assignment:', {
      id: menu.id,
      menu_plan_category: menu.menu_plan_category,
      breakfast: menu.breakfast,
      lunch: menu.lunch,
      dinner: menu.dinner,
      total_daily_calories: menu.total_daily_calories
    })

    // Denormalize menu details onto assignment so "My Assignments" has everything instantly
    const toTextJson = (val) => {
      if (val == null) return null
      if (typeof val === 'string') return val
      try { return JSON.stringify(val) } catch { return null }
    }

    const parseArray = (val) => {
      if (!val) return []
      if (Array.isArray(val)) return val
      try { const j = JSON.parse(val); return Array.isArray(j) ? j : [] } catch { return [] }
    }

    // Compute totals from meals if menu totals are missing/zero
    const bArr = parseArray(menu.breakfast)
    const lArr = parseArray(menu.lunch)
    const dArr = parseArray(menu.dinner)
    const totalsFromMeals = calculateDailyTotals(bArr, lArr, dArr)

    const assignmentPayload = {
      gym_id: req.user.gym_id,
      food_menu_id,
      user_id,
      start_date: start_date || menu.start_date || null,
      end_date: end_date || menu.end_date || null,
      status: 'ASSIGNED',
      notes: notes || null,
      menu_plan_category: menu.menu_plan_category || null,
      breakfast: toTextJson(menu.breakfast),
      lunch: toTextJson(menu.lunch),
      dinner: toTextJson(menu.dinner),
      total_daily_protein: Number(menu.total_daily_protein || 0) || totalsFromMeals.total_daily_protein,
      total_daily_fats: Number(menu.total_daily_fats || 0) || totalsFromMeals.total_daily_fats,
      total_daily_carbs: Number(menu.total_daily_carbs || 0) || totalsFromMeals.total_daily_carbs,
      total_daily_calories: Number(menu.total_daily_calories || 0) || totalsFromMeals.total_daily_calories
    }

    console.log('Backend: Assignment payload:', {
      ...assignmentPayload,
      breakfast: assignmentPayload.breakfast ? 'Has breakfast data' : 'No breakfast data',
      lunch: assignmentPayload.lunch ? 'Has lunch data' : 'No lunch data',
      dinner: assignmentPayload.dinner ? 'Has dinner data' : 'No dinner data'
    })

    const [assignment] = await db('food_menu_assignments')
      .insert(assignmentPayload)
      .returning('*')

    console.log('Backend: Created assignment:', {
      id: assignment.id,
      menu_plan_category: assignment.menu_plan_category,
      breakfast: assignment.breakfast ? 'Has breakfast data' : 'No breakfast data',
      lunch: assignment.lunch ? 'Has lunch data' : 'No lunch data',
      dinner: assignment.dinner ? 'Has dinner data' : 'No dinner data',
      total_daily_calories: assignment.total_daily_calories
    })

    res.status(201).json({ success: true, data: assignment })
  } catch (err) { next(err) }
}

// List assignments for a user (most recent first), joined with basic menu info
exports.listAssignments = async (req, res, next) => {
  try {
    const { user_id, page = 1, limit = 20 } = req.query
    const db = require('../config/db')
    const q = db('food_menu_assignments as a')
      .where('a.gym_id', req.user.gym_id)
      .orderBy('a.created_at', 'desc')

    if (user_id) q.andWhere('a.user_id', user_id)

    // IMPORTANT: Do NOT let updates to the original food_menu affect assignments.
    // Return ONLY the snapshot stored on the assignment rows.
    const rows = await q
      .leftJoin('food_menu as m', 'm.id', 'a.food_menu_id')
      .leftJoin('users as u', 'u.id', 'a.user_id')
      .select(
        'a.*',
        'u.name as user_name',
        'u.phone as user_phone',
        'u.email as user_email'
      )
      .limit(limit)
      .offset((page - 1) * limit)

    // Parse JSON fields for each assignment
    const parsedRows = rows.map(assignment => {
      const b = assignment.breakfast ? JSON.parse(assignment.breakfast) : []
      const l = assignment.lunch ? JSON.parse(assignment.lunch) : []
      const d = assignment.dinner ? JSON.parse(assignment.dinner) : []
      const totals = calculateDailyTotals(b, l, d)
      return {
        ...assignment,
        breakfast: b,
        lunch: l,
        dinner: d,
        total_daily_calories: Number(assignment.total_daily_calories || 0) || totals.total_daily_calories,
        total_daily_protein: Number(assignment.total_daily_protein || 0) || totals.total_daily_protein,
        total_daily_carbs: Number(assignment.total_daily_carbs || 0) || totals.total_daily_carbs,
        total_daily_fats: Number(assignment.total_daily_fats || 0) || totals.total_daily_fats,
        // User information
        user_name: assignment.user_name,
        user_phone: assignment.user_phone,
        user_email: assignment.user_email
      }
    });

    console.log('Backend: Returning assignments:', parsedRows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      user_name: r.user_name,
      user_phone: r.user_phone,
      menu_plan_category: r.menu_plan_category,
      breakfast: r.breakfast ? 'Has breakfast data' : 'No breakfast data',
      lunch: r.lunch ? 'Has lunch data' : 'No lunch data',
      dinner: r.dinner ? 'Has dinner data' : 'No dinner data',
      total_daily_calories: r.total_daily_calories
    })))

    res.json({ success: true, data: parsedRows })
  } catch (err) { next(err) }
}

// Mobile App: Get food menu assignments for a specific user id (params)
// GET /api/foodMenu/assignments/user/:user_id
exports.getUserFoodAssignments = async (req, res, next) => {
  try {
    const { user_id } = req.params
    const { page = 1, limit = 50 } = req.query

    // SECURITY: Ensure the requesting user can only access their own assignments
    // or if it's a gym admin/trainer, they can access any user in their gym
    const requestingUserId = req.user.id
    const requestingUserRole = req.user.role
    
    let query = db('food_menu_assignments as a')
      .where('a.gym_id', req.user.gym_id)
      .orderBy('a.created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit)

    // If the requesting user is not an admin/trainer, they can only see their own assignments
    if (requestingUserRole !== 'gym_admin' && requestingUserRole !== 'trainer') {
      query = query.andWhere('a.user_id', requestingUserId)
    } else {
      // Admin/trainer can access specific user's assignments
      query = query.andWhere('a.user_id', Number(user_id))
    }

    const rows = await query

    // Parse JSON meal fields for mobile consumption
    const parsed = rows.map((a) => {
      const b = a.breakfast ? JSON.parse(a.breakfast) : []
      const l = a.lunch ? JSON.parse(a.lunch) : []
      const d = a.dinner ? JSON.parse(a.dinner) : []
      const totals = calculateDailyTotals(b, l, d)
      return {
        ...a,
        breakfast: b,
        lunch: l,
        dinner: d,
        total_daily_calories: Number(a.total_daily_calories || 0) || totals.total_daily_calories,
        total_daily_protein: Number(a.total_daily_protein || 0) || totals.total_daily_protein,
        total_daily_carbs: Number(a.total_daily_carbs || 0) || totals.total_daily_carbs,
        total_daily_fats: Number(a.total_daily_fats || 0) || totals.total_daily_fats,
      }
    })

    res.json({ success: true, data: parsed })
  } catch (err) { next(err) }
}

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
    
    // Parse JSON fields for each menu
    const parsedRows = rows.map(menu => ({
      ...menu,
      breakfast: menu.breakfast ? JSON.parse(menu.breakfast) : null,
      lunch: menu.lunch ? JSON.parse(menu.lunch) : null,
      dinner: menu.dinner ? JSON.parse(menu.dinner) : null
    }));
    
    const [{ count }] = await db('food_menu')
      .where('gym_id', req.user.gym_id)
      .count('* as count');
    
    res.json({
      success: true,
      data: parsedRows,
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
    
    // Parse JSON fields for response
    const responseMenu = {
      ...menu,
      breakfast: menu.breakfast ? JSON.parse(menu.breakfast) : null,
      lunch: menu.lunch ? JSON.parse(menu.lunch) : null,
      dinner: menu.dinner ? JSON.parse(menu.dinner) : null
    };
    
    res.json({
      success: true,
      data: responseMenu
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

// Update a food menu assignment
exports.updateAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      start_date,
      end_date,
      notes,
      status,
      menu_plan_category,
      breakfast,
      lunch,
      dinner
    } = req.body;

    console.log('Backend: Updating assignment with ID:', id, 'Gym ID:', req.user.gym_id);
    console.log('Backend: Request body:', req.body);

    // Check if assignment exists
    const existingAssignment = await db('food_menu_assignments')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .first();

    console.log('Backend: Existing assignment found:', existingAssignment);

    if (!existingAssignment) {
      console.log('Backend: Assignment not found');
      return res.status(404).json({
        success: false,
        message: 'Food menu assignment not found'
      });
    }

    // Prepare update data
    const updateData = {};
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (menu_plan_category !== undefined) updateData.menu_plan_category = menu_plan_category;
    
    // Handle meal updates - these are independent of the original food menu
    if (breakfast !== undefined) {
      updateData.breakfast = breakfast ? JSON.stringify(breakfast) : null;
    }
    if (lunch !== undefined) {
      updateData.lunch = lunch ? JSON.stringify(lunch) : null;
    }
    if (dinner !== undefined) {
      updateData.dinner = dinner ? JSON.stringify(dinner) : null;
    }

    // Recalculate nutrition totals if meals were updated
    if (breakfast !== undefined || lunch !== undefined || dinner !== undefined) {
      const breakfastItems = breakfast || (existingAssignment.breakfast ? JSON.parse(existingAssignment.breakfast) : []);
      const lunchItems = lunch || (existingAssignment.lunch ? JSON.parse(existingAssignment.lunch) : []);
      const dinnerItems = dinner || (existingAssignment.dinner ? JSON.parse(existingAssignment.dinner) : []);
      
      const dailyTotals = calculateDailyTotals(breakfastItems, lunchItems, dinnerItems);
      updateData.total_daily_protein = dailyTotals.total_daily_protein;
      updateData.total_daily_fats = dailyTotals.total_daily_fats;
      updateData.total_daily_carbs = dailyTotals.total_daily_carbs;
      updateData.total_daily_calories = dailyTotals.total_daily_calories;
    }

    const [updatedAssignment] = await db('food_menu_assignments')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .update(updateData)
      .returning('*');

    // Parse JSON fields for response
    const responseAssignment = {
      ...updatedAssignment,
      breakfast: updatedAssignment.breakfast ? JSON.parse(updatedAssignment.breakfast) : null,
      lunch: updatedAssignment.lunch ? JSON.parse(updatedAssignment.lunch) : null,
      dinner: updatedAssignment.dinner ? JSON.parse(updatedAssignment.dinner) : null
    };

    res.json({
      success: true,
      data: responseAssignment,
      message: 'Food menu assignment updated successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Delete a food menu assignment
exports.deleteAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('Backend: Deleting assignment with ID:', id, 'Gym ID:', req.user.gym_id);

    const deletedCount = await db('food_menu_assignments')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .del();

    console.log('Backend: Deleted count:', deletedCount);

    if (deletedCount === 0) {
      console.log('Backend: No assignment found to delete');
      return res.status(404).json({
        success: false,
        message: 'Food menu assignment not found'
      });
    }

    console.log('Backend: Assignment deleted successfully');
    res.json({
      success: true,
      message: 'Food menu assignment deleted successfully'
    });
  } catch (err) {
    console.error('Backend: Error deleting assignment:', err);
    next(err);
  }
};