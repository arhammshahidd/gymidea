const db = require('../config/db');

// Helper function to calculate nutrition totals from food items
const calculateNutritionTotals = (foodItems) => {
  if (!foodItems || !Array.isArray(foodItems)) return { protein: 0, fats: 0, carbs: 0, calories: 0 };
  
  return foodItems.reduce((totals, item) => {
    return {
      protein: totals.protein + (parseFloat(item.protein) || 0),
      fats: totals.fats + (parseFloat(item.fats) || 0),
      carbs: totals.carbs + (parseFloat(item.carbs) || 0),
      calories: totals.calories + (parseFloat(item.calories) || 0)
    };
  }, { protein: 0, fats: 0, carbs: 0, calories: 0 });
};

// List all approval food menu requests
exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category, start_date, end_date } = req.query;
    
    const query = db('approval_food_menu')
      .where('gym_id', req.user.gym_id)
      .orderBy('created_at', 'desc');
    
    // Apply filters
    if (status) query.andWhere('approval_status', status);
    if (category) query.andWhere('menu_plan_category', category);
    if (start_date) query.andWhere('created_at', '>=', start_date);
    if (end_date) query.andWhere('created_at', '<=', end_date);
    
    const rows = await query
      .limit(limit)
      .offset((page - 1) * limit);
    
    // Parse JSON fields for response
    const parsedRows = rows.map(row => ({
      ...row,
      food_items: row.food_items ? JSON.parse(row.food_items) : []
    }));
    
    const [{ count }] = await db('approval_food_menu')
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

// Get a single approval food menu request by ID
exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const request = await db('approval_food_menu')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .first();
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Approval food menu request not found'
      });
    }
    
    // Parse JSON fields for response
    const parsedRequest = {
      ...request,
      food_items: request.food_items ? JSON.parse(request.food_items) : []
    };
    
    res.json({
      success: true,
      data: parsedRequest
    });
  } catch (err) {
    next(err);
  }
};

// Create a new approval food menu request
exports.create = async (req, res, next) => {
  try {
    const {
      user_id,
      name,
      email,
      contact,
      menu_plan_category,
      total_days,
      description,
      food_items
    } = req.body;
    
    // Validate required fields
    if (!name || !email || !contact || !menu_plan_category || !food_items) {
      return res.status(400).json({
        success: false,
        message: 'name, email, contact, menu_plan_category, and food_items are required'
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
    
    // Validate food_items is an array
    if (!Array.isArray(food_items) || food_items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'food_items must be a non-empty array'
      });
    }
    
    // Validate each food item has required fields
    for (let i = 0; i < food_items.length; i++) {
      const item = food_items[i];
      if (!item.food_item_name || !item.grams || item.protein === undefined || 
          item.fats === undefined || item.carbs === undefined || item.calories === undefined) {
        return res.status(400).json({
          success: false,
          message: `food_items[${i}] must have food_item_name, grams, protein, fats, carbs, and calories`
        });
      }
    }
    
    // Calculate nutrition totals
    const nutritionTotals = calculateNutritionTotals(food_items);
    
    // Create the approval request
    const [request] = await db('approval_food_menu')
      .insert({
        gym_id: req.user.gym_id,
        user_id: user_id || null,
        name,
        email,
        contact,
        menu_plan_category,
        total_days: total_days || 30,
        description: description || null,
        food_items: JSON.stringify(food_items),
        total_protein: nutritionTotals.protein,
        total_fats: nutritionTotals.fats,
        total_carbs: nutritionTotals.carbs,
        total_calories: nutritionTotals.calories,
        approval_status: 'PENDING'
      })
      .returning('*');
    
    // Parse JSON fields for response
    const responseRequest = {
      ...request,
      food_items: JSON.parse(request.food_items)
    };
    
    res.status(201).json({
      success: true,
      data: responseRequest,
      message: 'Approval food menu request created successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Update an existing approval food menu request
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      contact,
      menu_plan_category,
      total_days,
      description,
      food_items
    } = req.body;
    
    // Check if request exists
    const existingRequest = await db('approval_food_menu')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .first();
    
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Approval food menu request not found'
      });
    }
    
    // Don't allow updates if already approved or rejected
    if (existingRequest.approval_status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update request that has already been approved or rejected'
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
    
    // Validate food_items if provided
    if (food_items) {
      if (!Array.isArray(food_items) || food_items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'food_items must be a non-empty array'
        });
      }
      
      // Validate each food item has required fields
      for (let i = 0; i < food_items.length; i++) {
        const item = food_items[i];
        if (!item.food_item_name || !item.grams || item.protein === undefined || 
            item.fats === undefined || item.carbs === undefined || item.calories === undefined) {
          return res.status(400).json({
            success: false,
            message: `food_items[${i}] must have food_item_name, grams, protein, fats, carbs, and calories`
          });
        }
      }
    }
    
    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (contact !== undefined) updateData.contact = contact;
    if (menu_plan_category !== undefined) updateData.menu_plan_category = menu_plan_category;
    if (total_days !== undefined) updateData.total_days = total_days;
    if (description !== undefined) updateData.description = description;
    if (food_items !== undefined) {
      updateData.food_items = JSON.stringify(food_items);
      // Recalculate nutrition totals
      const nutritionTotals = calculateNutritionTotals(food_items);
      updateData.total_protein = nutritionTotals.protein;
      updateData.total_fats = nutritionTotals.fats;
      updateData.total_carbs = nutritionTotals.carbs;
      updateData.total_calories = nutritionTotals.calories;
    }
    
    const [updatedRequest] = await db('approval_food_menu')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .update(updateData)
      .returning('*');
    
    // Parse JSON fields for response
    const responseRequest = {
      ...updatedRequest,
      food_items: updatedRequest.food_items ? JSON.parse(updatedRequest.food_items) : []
    };
    
    res.json({
      success: true,
      data: responseRequest,
      message: 'Approval food menu request updated successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Delete an approval food menu request
exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const deletedCount = await db('approval_food_menu')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .del();
    
    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Approval food menu request not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Approval food menu request deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Update approval status (Approve/Reject)
exports.updateApprovalStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approval_status, approval_notes } = req.body;
    
    if (!approval_status || !['PENDING', 'APPROVED', 'REJECTED'].includes(approval_status)) {
      return res.status(400).json({
        success: false,
        message: 'approval_status must be PENDING, APPROVED, or REJECTED'
      });
    }
    
    // Check if request exists
    const existingRequest = await db('approval_food_menu')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .first();
    
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Approval food menu request not found'
      });
    }
    
    // Prepare update data
    const updateData = {
      approval_status,
      approval_notes: approval_notes || null
    };
    
    // Set approval details if approving or rejecting
    if (approval_status === 'APPROVED' || approval_status === 'REJECTED') {
      updateData.approved_by = req.user.id;
      updateData.approved_at = new Date();
    } else {
      // Reset approval details if setting back to pending
      updateData.approved_by = null;
      updateData.approved_at = null;
    }
    
    const [updatedRequest] = await db('approval_food_menu')
      .where({
        id: id,
        gym_id: req.user.gym_id
      })
      .update(updateData)
      .returning('*');
    
    // Parse JSON fields for response
    const responseRequest = {
      ...updatedRequest,
      food_items: updatedRequest.food_items ? JSON.parse(updatedRequest.food_items) : []
    };
    
    res.json({
      success: true,
      data: responseRequest,
      message: `Approval food menu request ${approval_status.toLowerCase()} successfully`
    });
  } catch (err) {
    next(err);
  }
};

// Get approval food menu categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await db('approval_food_menu')
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

// Get approval statistics
exports.getStats = async (req, res, next) => {
  try {
    const stats = await db('approval_food_menu')
      .where('gym_id', req.user.gym_id)
      .select('approval_status')
      .count('* as count')
      .groupBy('approval_status');
    
    const formattedStats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    };
    
    stats.forEach(stat => {
      formattedStats.total += parseInt(stat.count);
      formattedStats[stat.approval_status.toLowerCase()] = parseInt(stat.count);
    });
    
    res.json({
      success: true,
      data: formattedStats
    });
  } catch (err) {
    next(err);
  }
};
