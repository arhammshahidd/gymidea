const db = require('../config/db');
const { getUserProgressForPlan, smartUpdateMobilePlanItems, smartUpdateManualPlanItems } = require('../utils/smartPlanUpdates');

// Helper function to parse weight_kg string ranges like "20-40" into min, max, and average
function parseWeightRange(weightValue) {
  if (!weightValue) return { weight_kg: 0, weight_min_kg: null, weight_max_kg: null };
  
  // If it's already a number, return as is
  if (typeof weightValue === 'number' || (!isNaN(weightValue) && !String(weightValue).includes('-'))) {
    const num = Number(weightValue);
    return { 
      weight_kg: num, 
      weight_min_kg: null, 
      weight_max_kg: null 
    };
  }
  
  // If it's a string range like "20-40", parse it
  if (typeof weightValue === 'string' && weightValue.includes('-')) {
    const parts = weightValue.split('-').map(p => p.trim()).filter(p => p);
    if (parts.length === 2) {
      const min = Number(parts[0]);
      const max = Number(parts[1]);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        const avg = Math.round(((min + max) / 2) * 100) / 100;
        return { 
          weight_kg: avg, 
          weight_min_kg: min, 
          weight_max_kg: max 
        };
      }
    }
  }
  
  // Fallback: try to parse as number
  const num = Number(weightValue);
  return { 
    weight_kg: Number.isFinite(num) ? num : 0, 
    weight_min_kg: null, 
    weight_max_kg: null 
  };
}

// Helper function to create daily plans from training plan
exports.createDailyTrainingPlansFromPlan = async function createDailyTrainingPlansFromPlan(plan, items, user_id, gym_id) {
  try {
    const startDate = new Date(plan.start_date);
    const endDate = new Date(plan.end_date);

    // Prefer explicit daily_plans saved on app_manual_training_plans over re-distribution
    let dailyPlansSource = null;
    try {
      // If caller passed daily_plans inline, use it; else load from DB by plan.id
      if (Array.isArray(plan.daily_plans)) {
        dailyPlansSource = plan.daily_plans;
      } else if (typeof plan.daily_plans === 'string') {
        try { dailyPlansSource = JSON.parse(plan.daily_plans); } catch (_) {}
      } else if (plan?.id) {
        const manualPlanRow = await db('app_manual_training_plans').where({ id: plan.id }).first();
        if (manualPlanRow?.daily_plans) {
          try { dailyPlansSource = JSON.parse(manualPlanRow.daily_plans); } catch (_) {}
        }
      }
    } catch (e) {}

    // Fallback to smart distribution if no saved daily_plans were found
    if (!Array.isArray(dailyPlansSource) || dailyPlansSource.length === 0) {
      const { createDistributedPlan } = require('../utils/exerciseDistribution');
      const distributedPlan = createDistributedPlan({ items }, startDate, endDate);
      dailyPlansSource = distributedPlan.daily_plans;
    }

    const dailyPlans = [];
    const insertedPlans = [];

    // Convert daily plans (from saved distribution or fallback) to mobile format
    for (const dayPlan of dailyPlansSource) {
      const dayItems = dayPlan.workouts || [];
      
      const totalSets = dayItems.reduce((sum, item) => sum + (item.sets || 0), 0);
      const totalReps = dayItems.reduce((sum, item) => sum + (item.reps || 0), 0);
      const totalWeight = dayItems.reduce((sum, item) => sum + (item.weight_kg || 0), 0);
      const totalMinutes = dayItems.reduce((sum, item) => sum + (item.training_minutes || item.minutes || 0), 0);
      
      // Normalize date to YYYY-MM-DD format
      let planDate = dayPlan.date;
      if (planDate instanceof Date) {
        planDate = planDate.toISOString().split('T')[0];
      } else if (typeof planDate === 'string') {
        planDate = new Date(planDate).toISOString().split('T')[0];
      }
      
      const dailyPlanData = {
        user_id,
        gym_id,
        plan_date: planDate,
        plan_type: 'manual',
        source_plan_id: plan.id,
        plan_category: plan.exercise_plan_category || 'General',
        user_level: dayItems[0]?.user_level || plan.user_level || 'Beginner',
        exercises_details: JSON.stringify(dayItems),
        is_stats_record: false
      };
      
      // Check if daily plan already exists (using unique constraint fields)
      const existing = await db('daily_training_plans')
        .where({
          user_id: user_id,
          plan_date: planDate,
          plan_type: 'manual',
          source_plan_id: plan.id,
          is_stats_record: false
        })
        .modify((qb) => { 
          if (gym_id != null) {
            qb.andWhere({ gym_id: gym_id });
          }
        })
        .first();
      
      let dailyPlan;
      if (existing) {
        // Update existing plan
        const [updated] = await db('daily_training_plans')
          .where({ id: existing.id })
          .update({
            exercises_details: JSON.stringify(dayItems),
            plan_category: plan.exercise_plan_category || 'General',
            user_level: dayItems[0]?.user_level || plan.user_level || 'Beginner',
            updated_at: new Date()
          })
          .returning('*');
        dailyPlan = updated;
        console.log(`✅ Updated existing daily plan ${updated.id} for date ${planDate}`);
      } else {
        // Create new daily plan - wrap in try-catch to handle duplicate key errors
        try {
          const [inserted] = await db('daily_training_plans')
            .insert(dailyPlanData)
            .returning('*');
          dailyPlan = inserted;
          console.log(`✅ Created daily plan ${inserted.id} for date ${planDate}`);
        } catch (insertErr) {
          // Handle duplicate key constraint violation
          if (insertErr.code === '23505' && insertErr.constraint === 'daily_training_plans_user_plan_unique') {
            console.log(`⚠️ Duplicate key detected - plan already exists for manual plan (user_id: ${user_id}, plan_date: ${planDate}, plan_type: manual, source_plan_id: ${plan.id}). Fetching existing plan...`);
            
            // Fetch the existing plan that caused the conflict
            const existingPlan = await db('daily_training_plans')
              .where({
                user_id: user_id,
                plan_date: planDate,
                plan_type: 'manual',
                source_plan_id: plan.id,
                is_stats_record: false
              })
              .modify((qb) => { 
                if (gym_id != null) {
                  qb.andWhere({ gym_id: gym_id });
                }
              })
              .first();
            
            if (existingPlan) {
              // Update the existing plan with new data
              const [updated] = await db('daily_training_plans')
                .where({ id: existingPlan.id })
                .update({
                  exercises_details: JSON.stringify(dayItems),
                  plan_category: plan.exercise_plan_category || 'General',
                  user_level: dayItems[0]?.user_level || plan.user_level || 'Beginner',
                  updated_at: new Date()
                })
                .returning('*');
              dailyPlan = updated;
              console.log(`✅ Updated existing daily plan ${updated.id} after duplicate key conflict (date: ${planDate}, plan_type: manual)`);
            } else {
              console.error(`❌ CRITICAL: Duplicate key error but couldn't find existing plan!`, insertErr);
              // Skip this plan and continue
              continue;
            }
          } else {
            // Re-throw if it's not a duplicate key error
            console.error(`❌ Error inserting daily plan for date ${planDate}:`, insertErr);
            throw insertErr;
          }
        }
      }
      
      if (dailyPlan) {
        insertedPlans.push(dailyPlan);
      }
    }
    
    // Insert plan items
    for (const dailyPlan of insertedPlans) {
      const exercises = JSON.parse(dailyPlan.exercises_details || '[]');
      if (exercises.length > 0) {
        const items = exercises.map(ex => {
          // Parse weight range from string like "20-40" or separate min/max fields
          const weightRange = parseWeightRange(ex.weight_kg ?? ex.weight);
          
          return {
            daily_plan_id: dailyPlan.id,
            exercise_name: ex.workout_name || 'Exercise',
            sets: ex.sets || 0,
            reps: ex.reps || 0,
            weight_kg: weightRange.weight_kg,
            weight_min_kg: ex.weight_min_kg ?? weightRange.weight_min_kg,
            weight_max_kg: ex.weight_max_kg ?? weightRange.weight_max_kg,
            minutes: ex.minutes || 0,
            exercise_type: ex.exercise_types || null,
            notes: null
          };
        });
        
        // Items are now stored in exercises_details JSON column
        // No need to insert into daily_training_plan_items table
      }
    }
    
    console.log(`Created ${insertedPlans.length} daily training plans for user ${user_id}`);
    return insertedPlans;
  } catch (error) {
    console.error('Error creating daily training plans:', error);
    return [];
  }
}

exports.createPlan = async (req, res) => {
  try {
    const { user_id: bodyUserId, start_date, end_date, exercise_plan_category, total_workouts, total_exercises, training_minutes, items = [], daily_plans } = req.body;
    const authedUserId = req.user?.id ?? null;
    const gymId = req.user?.gym_id ?? null;

    // Prefer the authenticated user's id when not provided or to avoid FK/gym mismatches
    const targetUserId = Number(bodyUserId || authedUserId);

    if (!targetUserId || !start_date || !end_date || !exercise_plan_category) {
      return res.status(400).json({ success: false, message: 'user_id, start_date, end_date, and exercise_plan_category are required' });
    }

    // Validate date order
    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ success: false, message: 'start_date must be on or before end_date' });
    }

    // Validate that target user exists (avoid FK violation 500s)
    try {
      const userRow = await db('users').where({ id: targetUserId }).first();
      if (!userRow) {
        return res.status(400).json({ success: false, message: `User ${targetUserId} does not exist` });
      }
    } catch (lookupErr) {
      // If users table lookup fails, surface a clear error
      return res.status(500).json({ success: false, message: 'User lookup failed' });
    }

    // Insert plan
    let plan;
    try {
      const inserted = await db('app_manual_training_plans')
        .insert({ user_id: targetUserId, gym_id: gymId, start_date, end_date, exercise_plan_category, total_workouts: total_workouts || 0, total_exercises: total_exercises || (Array.isArray(items) ? items.length : 0), training_minutes: training_minutes || 0, exercises_details: Array.isArray(items) ? JSON.stringify(items) : null, daily_plans: Array.isArray(daily_plans) ? JSON.stringify(daily_plans) : (typeof daily_plans === 'string' ? daily_plans : null) })
        .returning('*');
      plan = Array.isArray(inserted) ? inserted[0] : inserted;
    } catch (insertErr) {
      console.error('❌ Insert manual plan failed:', insertErr);
      // Common cause is FK violation on user_id
      return res.status(400).json({ success: false, message: 'Failed to create manual training plan (check user_id and dates)' });
    }

    // Insert items if provided
    let planItems = [];
    if (Array.isArray(items) && items.length) {
      const rows = items.map((it) => {
        // Parse weight range from string like "20-40" or separate min/max fields
        const weightRange = parseWeightRange(it.weight_kg ?? it.weight);
        
        return {
          plan_id: plan.id,
          workout_name: it.workout_name || it.name || 'Exercise',
          exercise_plan_category: it.exercise_plan_category || null,
          exercise_types: it.exercise_types || null,
          sets: Number(it.sets || 0),
          reps: Number(it.reps || 0),
          weight_kg: weightRange.weight_kg,
          weight_min_kg: it.weight_min_kg ?? weightRange.weight_min_kg,
          weight_max_kg: it.weight_max_kg ?? weightRange.weight_max_kg,
          minutes: Number(it.minutes || 0),
          user_level: it.user_level || 'Beginner',
        };
      });
      try {
        planItems = await db('app_manual_training_plan_items').insert(rows).returning('*');
      } catch (itemsErr) {
        console.error('❌ Insert manual plan items failed:', itemsErr);
        return res.status(400).json({ success: false, message: 'Failed to save exercises for manual plan (check workout fields)' });
      }
    }

    // Automatically create daily plans for easy mobile access
    try {
      const createdPlans = await createDailyTrainingPlansFromPlan(plan, planItems, targetUserId, gymId);
      if (createdPlans && createdPlans.length > 0) {
        console.log(`✅ Created ${createdPlans.length} daily training plans for manual plan ${plan.id}`);
      } else {
        console.warn(`⚠️ No daily plans were created for manual plan ${plan.id} - this might indicate an issue`);
      }
    } catch (dailyPlanError) {
      console.error('❌ Failed to create daily plans for manual plan:', {
        plan_id: plan.id,
        user_id: targetUserId,
        error: dailyPlanError.message,
        stack: dailyPlanError.stack
      });
      // Don't fail the main request if daily plans creation fails, but log it clearly
    }

    // Sync daily plans from manual plan to daily_training_plans (similar to assigned plans)
    // This ensures plans are properly synced even if createDailyTrainingPlansFromPlan had issues
    try {
      const { syncDailyPlansFromManualPlanHelper } = require('./DailyTrainingController');
      const syncedPlans = await syncDailyPlansFromManualPlanHelper(plan.id);
      if (syncedPlans && syncedPlans.length > 0) {
        console.log(`✅ Synced ${syncedPlans.length} daily plans from manual plan ${plan.id}`);
      } else {
        console.warn(`⚠️ No daily plans were synced for manual plan ${plan.id} - this might indicate an issue`);
      }
    } catch (syncError) {
      console.error('❌ Failed to sync daily plans from manual plan:', {
        plan_id: plan.id,
        error: syncError.message,
        stack: syncError.stack
      });
      // Don't fail the main request if sync fails, but log it clearly
    }

    // Get approval_id if plan is already approved (unlikely for new plan, but check anyway)
    let approval_id = null;
    if (plan.approval_status === 'APPROVED') {
      try {
        // Try multiple queries to find the approval record
        // IMPORTANT: training_approvals table doesn't have 'approved_at' column
        // Use 'updated_at' instead (gets updated when approval_status changes to APPROVED)
        // First try with plan_type='manual' (most reliable since we know this column exists)
        let approval = await db('training_approvals')
          .where({ plan_id: plan.id, plan_type: 'manual', approval_status: 'APPROVED' })
          .orderBy('updated_at', 'desc')
          .first();
        
        if (!approval) {
          approval = await db('training_approvals')
            .where({ plan_id: plan.id, source: 'manual', approval_status: 'APPROVED' })
            .orderBy('updated_at', 'desc')
            .first();
        }
        
        if (!approval) {
          approval = await db('training_approvals')
            .where({ plan_id: plan.id, approval_status: 'APPROVED' })
            .orderBy('updated_at', 'desc')
            .first();
        }
        
        if (approval) {
          approval_id = approval.id;
        }
      } catch (approvalError) {
        console.error('❌ Error fetching approval_id for manual plan:', approvalError);
      }
    }

    return res.status(201).json({ success: true, data: { ...plan, approval_id } });
  } catch (err) {
    console.error('Error creating app manual training plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to create manual training plan' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, exercise_plan_category, total_workouts, total_exercises, training_minutes, items } = req.body;

    const existing = await db('app_manual_training_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });

    const [updated] = await db('app_manual_training_plans')
      .where({ id })
      .update({ start_date, end_date, exercise_plan_category, total_workouts, total_exercises, training_minutes, updated_at: new Date() })
      .returning('*');

    if (Array.isArray(items)) {
      console.log(`📱 Smart updating Manual Training Plan ${id} with ${items.length} exercises`);
      
      // Get user's progress to determine which workouts are completed
      const userProgress = await getUserProgressForPlan(existing.user_id, id);
      const today = new Date().toISOString().split('T')[0];
      
      console.log(`📊 Manual Plan user progress: ${userProgress.completedDays} completed days, today: ${today}`);
      
      // Only update future workouts, preserve completed ones
      await smartUpdateManualPlanItems(id, items, userProgress, today);
    }

    // Get approval_id if plan is approved
    let approval_id = null;
    if (updated.approval_status === 'APPROVED') {
      try {
        // Try multiple queries to find the approval record
        // IMPORTANT: training_approvals table doesn't have 'approved_at' column
        // Use 'updated_at' instead (gets updated when approval_status changes to APPROVED)
        // First try with plan_type='manual' (most reliable since we know this column exists)
        let approval = await db('training_approvals')
          .where({ plan_id: id, plan_type: 'manual', approval_status: 'APPROVED' })
          .orderBy('updated_at', 'desc')
          .first();
        
        if (!approval) {
          approval = await db('training_approvals')
            .where({ plan_id: id, source: 'manual', approval_status: 'APPROVED' })
            .orderBy('updated_at', 'desc')
            .first();
        }
        
        if (!approval) {
          approval = await db('training_approvals')
            .where({ plan_id: id, approval_status: 'APPROVED' })
            .orderBy('updated_at', 'desc')
            .first();
        }
        
        if (approval) {
          approval_id = approval.id;
        }
      } catch (approvalError) {
        console.error('❌ Error fetching approval_id for manual plan:', approvalError);
      }
    }

    return res.json({ success: true, data: { ...updated, approval_id } });
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
    // Delete daily mobile mirrors first to avoid orphaned mobile days
    try {
      const dailyPlans = await db('daily_training_plans')
        .where({ source_plan_id: id, plan_type: 'manual', user_id: existing.user_id, gym_id: existing.gym_id });
      const dailyPlanIds = dailyPlans.map(p => p.id);
      if (dailyPlanIds.length > 0) {
        // Items are now stored in exercises_details JSON column
        // No need to delete from daily_training_plan_items table
        await db('daily_training_plans').whereIn('id', dailyPlanIds).del();
      }
    } catch (mirrorErr) {
      console.error('❌ Failed deleting daily mirrors for manual plan:', mirrorErr);
    }

    // Delete plan items then the plan
    await db('app_manual_training_plan_items').where({ plan_id: id }).del();
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
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    let query = db('app_manual_training_plans').where({ id });
    
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
    
    // Get approval_id from training_approvals if plan is approved
    let approval_id = null;
    if (plan.approval_status === 'APPROVED') {
      try {
        // Try multiple queries to find the approval record
        // IMPORTANT: training_approvals table doesn't have 'approved_at' column
        // Use 'updated_at' instead (gets updated when approval_status changes to APPROVED)
        // First try with plan_type='manual' (most reliable since we know this column exists)
        let approval = await db('training_approvals')
          .where({ plan_id: id, plan_type: 'manual', approval_status: 'APPROVED' })
          .orderBy('updated_at', 'desc')
          .first();
        
        // If not found, try with source='manual' (in case source column exists and is set)
        if (!approval) {
          approval = await db('training_approvals')
            .where({ plan_id: id, source: 'manual', approval_status: 'APPROVED' })
            .orderBy('updated_at', 'desc')
            .first();
        }
        
        // If still not found, try without plan_type/source filter (fallback)
        if (!approval) {
          approval = await db('training_approvals')
            .where({ plan_id: id, approval_status: 'APPROVED' })
            .orderBy('updated_at', 'desc')
            .first();
        }
        
        if (approval) {
          approval_id = approval.id;
          console.log(`✅ Found approval_id ${approval_id} for manual plan ${id} (plan_type: ${approval.plan_type || 'N/A'}, source: ${approval.source || 'N/A'})`);
        } else {
          console.log(`⚠️ No approval record found for approved manual plan ${id} (plan_id=${id}, approval_status=APPROVED)`);
        }
      } catch (approvalError) {
        console.error('❌ Error fetching approval_id for manual plan:', approvalError);
        // Continue without approval_id if lookup fails
      }
    }
    
    const items = await db('app_manual_training_plan_items').where({ plan_id: id }).orderBy('id', 'asc');
    return res.json({ success: true, data: { ...plan, items, approval_id } });
  } catch (err) {
    console.error('Error getting app manual training plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to get manual training plan' });
  }
};

exports.listPlans = async (req, res) => {
  try {
    const { user_id } = req.query;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;
    const gymId = req.user?.gym_id;
    
    // Validate user authentication
    if (!requestingUserId) {
      console.error('❌ listPlans - No user_id found in req.user');
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    console.log(`📋 listPlans - Request from user ${requestingUserId}, role: ${requestingUserRole}, gym_id: ${gymId}`);
    
    let qb = db('app_manual_training_plans')
      .select('*')
      .orderBy('created_at', 'desc');
    
    // SECURITY: Ensure proper user isolation
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      // Admin/trainer can see plans for specific users or all users in their gym
      if (user_id) {
        if (gymId) {
          qb = qb.where({ user_id: Number(user_id), gym_id: gymId });
        } else {
          qb = qb.where({ user_id: Number(user_id) });
        }
      } else {
        if (gymId) {
          qb = qb.where({ gym_id: gymId });
        } else {
          // If no gym_id, admin/trainer can see all plans (fallback)
          console.warn('⚠️ listPlans - Admin/trainer has no gym_id, showing all plans');
        }
      }
    } else {
      // Regular users can only see their own plans
      // gym_id can be null for standalone users, so don't filter by it if null
      if (gymId) {
        qb = qb.where({ user_id: requestingUserId, gym_id: gymId });
      } else {
        qb = qb.where({ user_id: requestingUserId });
      }
    }
    
    // CRITICAL: Filter out assigned plans (mirrored from training_plan_assignments)
    // Assigned plans have web_plan_id set to the assignment ID (non-null integer)
    // True manual plans don't have web_plan_id (it's null)
    // This ensures "Plans" tab only shows manual plans, not assigned plans
    // Assigned plans should only appear in "Schedules" tab via /api/trainingPlans/assignments/user/:user_id
    try {
      const targetUserIdForFilter = requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer' 
        ? (user_id ? Number(user_id) : requestingUserId)
        : requestingUserId;
      
      // PRIMARY FILTER: Exclude plans with web_plan_id set (these are mirrored from assignments)
      // When an assignment is created, it creates a mirrored plan with web_plan_id = assignment.id
      // True manual plans have web_plan_id = NULL
      qb = qb.whereNull('web_plan_id');
      
      // SECONDARY FILTER: Exclude plans that have a corresponding assignment by date range
      // This catches edge cases where web_plan_id might be NULL but the plan is still an assignment
      // We check if there's an assignment with matching user_id, start_date, and end_date
      const assignments = await db('training_plan_assignments')
        .where({ user_id: targetUserIdForFilter })
        .modify((qb) => {
          if (gymId) {
            qb.andWhere({ gym_id: gymId });
          }
        })
        .select('start_date', 'end_date');
      
      if (assignments.length > 0) {
        // Exclude plans whose start_date and end_date exactly match any assignment
        // This ensures no assigned plans slip through even if web_plan_id is NULL
    qb = qb.where(function() {
          assignments.forEach((assignment, index) => {
            if (index === 0) {
              this.whereNot(function() {
                this.where({ start_date: assignment.start_date })
                  .andWhere({ end_date: assignment.end_date });
              });
            } else {
              this.andWhereNot(function() {
                this.where({ start_date: assignment.start_date })
                  .andWhere({ end_date: assignment.end_date });
              });
            }
          });
    });
    
        console.log(`📋 listPlans - Excluding ${assignments.length} assigned plans by web_plan_id filter (IS NULL) and date range matching. Only returning true manual plans.`);
      } else {
        console.log(`📋 listPlans - No assignments found for user ${targetUserIdForFilter}. Only returning true manual plans (web_plan_id IS NULL).`);
      }
    } catch (filterErr) {
      console.error('❌ Error applying web_plan_id filter:', filterErr);
      // Continue without the filter if it fails (shouldn't happen, but be safe)
      console.warn('⚠️ Continuing without web_plan_id filter');
    }
    
    let plans;
    try {
      plans = await qb;
      console.log(`📋 listPlans - Found ${plans.length} manual plans`);
    } catch (queryErr) {
      console.error('❌ Error executing query:', {
        error: queryErr.message,
        stack: queryErr.stack,
        sql: queryErr.sql
      });
      throw queryErr; // Re-throw to be caught by outer catch
    }
    
    // Get all approval_ids for approved plans in a single query (more efficient)
    const planIds = plans.map(p => p.id);
    let approvalsMap = {};
    
    if (planIds.length > 0) {
      try {
        // Try multiple queries to find approval records
        // IMPORTANT: training_approvals table doesn't have 'approved_at' column
        // Use 'updated_at' instead (gets updated when approval_status changes to APPROVED)
        // First try with plan_type='manual' (most reliable since we know this column exists)
        let approvals = await db('training_approvals')
          .whereIn('plan_id', planIds)
          .where({ plan_type: 'manual', approval_status: 'APPROVED' })
          .select('id', 'plan_id', 'updated_at', 'plan_type', 'source')
          .orderBy('updated_at', 'desc');
        
        // If some plans don't have approvals with plan_type='manual', try with source='manual'
        const foundPlanIds = approvals.map(a => a.plan_id);
        const missingPlanIds = planIds.filter(id => !foundPlanIds.includes(id));
        
        if (missingPlanIds.length > 0) {
          const additionalApprovals = await db('training_approvals')
            .whereIn('plan_id', missingPlanIds)
            .where({ source: 'manual', approval_status: 'APPROVED' })
            .select('id', 'plan_id', 'updated_at', 'plan_type', 'source')
            .orderBy('updated_at', 'desc');
          
          approvals = [...approvals, ...additionalApprovals];
        }
        
        // If still missing, try without plan_type/source filter (fallback)
        const stillMissingPlanIds = planIds.filter(id => !approvals.map(a => a.plan_id).includes(id));
        if (stillMissingPlanIds.length > 0) {
          const fallbackApprovals = await db('training_approvals')
            .whereIn('plan_id', stillMissingPlanIds)
            .where({ approval_status: 'APPROVED' })
            .select('id', 'plan_id', 'updated_at', 'plan_type', 'source')
            .orderBy('updated_at', 'desc');
          
          approvals = [...approvals, ...fallbackApprovals];
        }
        
        // Group by plan_id and take the most recent approval for each plan
        approvals.forEach(approval => {
          if (!approvalsMap[approval.plan_id]) {
            approvalsMap[approval.plan_id] = approval.id;
          }
        });
        
        if (Object.keys(approvalsMap).length > 0) {
          console.log(`✅ Found ${Object.keys(approvalsMap).length} approval_ids for ${planIds.length} manual plans`);
        }
      } catch (approvalError) {
        console.error('❌ Error fetching approval_ids for manual plans:', approvalError);
        // Continue without approval_ids if lookup fails
      }
    }
    
    // Add approval_id to each plan
    const plansWithApprovalId = plans.map(plan => ({
      ...plan,
      approval_id: plan.approval_status === 'APPROVED' ? (approvalsMap[plan.id] || null) : null
    }));
    
    return res.json({ success: true, data: plansWithApprovalId });
  } catch (err) {
    // CRITICAL: Log detailed error information to help diagnose the 500 error
    console.error('❌ CRITICAL ERROR in listPlans:', {
      error_message: err.message,
      error_stack: err.stack,
      error_name: err.name,
      error_code: err.code,
      requesting_user_id: req.user?.id,
      requesting_user_role: req.user?.role,
      gym_id: req.user?.gym_id,
      query_user_id: req.query?.user_id,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to list manual training plans',
      error: err.message,
      debug: process.env.NODE_ENV === 'development' ? {
        stack: err.stack,
        name: err.name,
        code: err.code
      } : undefined
    });
  }
};


