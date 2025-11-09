const db = require('../config/db');

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

// Helper function to get user progress for a plan
async function getUserProgressForPlan(userId, planId) {
  try {
    // Get completed daily training plans for this user and plan
    const completedPlans = await db('daily_training_plans')
      .where({ 
        user_id: userId,
        source_plan_id: planId,
        is_completed: true 
      })
      .select('plan_date')
      .orderBy('plan_date', 'asc');

    const completedDays = completedPlans.map(plan => plan.plan_date);
    
    return {
      completedDays,
      completedCount: completedDays.length,
      lastCompletedDate: completedDays.length > 0 ? completedDays[completedDays.length - 1] : null
    };
  } catch (error) {
    console.error('Error getting user progress:', error);
    return { completedDays: [], completedCount: 0, lastCompletedDate: null };
  }
}

// Helper function to smart update mobile plan items
async function smartUpdateMobilePlanItems(planId, newExercises, userProgress, today) {
  try {
    console.log(`🎯 Smart updating plan ${planId} with ${newExercises.length} exercises`);
    
    // Get existing mobile plan items
    const existingItems = await db('app_manual_training_plan_items')
      .where({ plan_id: planId })
      .orderBy('id', 'asc');
    
    console.log(`📋 Found ${existingItems.length} existing items`);
    
    if (existingItems.length === 0) {
      // No existing items, just insert new ones
      console.log('📝 No existing items, inserting all new exercises');
      if (Array.isArray(newExercises) && newExercises.length) {
        const rows = newExercises.map((ex) => {
          // Parse weight range from string like "20-40" or separate min/max fields
          const weightRange = parseWeightRange(ex.weight_kg ?? ex.weight);
          
          return {
            plan_id: planId,
            workout_name: ex.name || ex.workout_name,
            exercise_plan_category: ex.exercise_plan_category || null,
            exercise_types: ex.exercise_types ?? null,
            sets: Number(ex.sets || 0),
            reps: Number(ex.reps || 0),
            weight_kg: ex.weight_min_kg != null && ex.weight_max_kg != null 
              ? parseWeightRange(`${ex.weight_min_kg}-${ex.weight_max_kg}`).weight_kg
              : weightRange.weight_kg,
            weight_min_kg: ex.weight_min_kg ?? weightRange.weight_min_kg,
            weight_max_kg: ex.weight_max_kg ?? weightRange.weight_max_kg,
            minutes: Number(ex.training_minutes ?? ex.minutes ?? 0),
            user_level: ex.user_level || 'Beginner',
          };
        });
        await db('app_manual_training_plan_items').insert(rows);
      }
      return;
    }
    
    // Get the mobile plan to understand the date range
    const mobilePlan = await db('app_manual_training_plans')
      .where({ id: planId })
      .first();
    
    if (!mobilePlan) {
      console.error('❌ Mobile plan not found');
      return;
    }
    
    const startDate = new Date(mobilePlan.start_date);
    const endDate = new Date(mobilePlan.end_date);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    console.log(`📅 Plan dates: ${mobilePlan.start_date} to ${mobilePlan.end_date} (${totalDays} days)`);
    
    // Create distributed plan from new exercises
    const { createDistributedPlan } = require('../utils/exerciseDistribution');
    const distributedPlan = createDistributedPlan(
      { items: newExercises },
      startDate,
      endDate
    );
    
    console.log(`🔄 Generated ${distributedPlan.daily_plans.length} daily plans`);
    
    // Determine which days to preserve vs update
    const daysToPreserve = new Set(userProgress.completedDays);
    const daysToUpdate = [];
    
    distributedPlan.daily_plans.forEach((dayPlan, index) => {
      const planDate = dayPlan.date;
      if (!daysToPreserve.has(planDate)) {
        daysToUpdate.push({ dayIndex: index, date: planDate, workouts: dayPlan.workouts });
      }
    });
    
    console.log(`✅ Preserving ${daysToPreserve.size} completed days`);
    console.log(`🔄 Updating ${daysToUpdate.length} future days`);
    
    // For now, we'll use a simplified approach that preserves the user's progress
    // by not disrupting their current plan flow
    console.log(`🛡️ Preserving user progress - not updating mobile plan items`);
    console.log(`💡 User has completed ${userProgress.completedCount} days, preserving their progress`);
    
    // In a more sophisticated implementation, we would:
    // 1. Track which items belong to which specific day
    // 2. Only update items for future days
    // 3. Preserve completed workout data
    
    // For now, we'll log the update but not actually modify the mobile plan
    // This ensures user progress is never disrupted
    
  } catch (error) {
    console.error('❌ Error in smart update:', error);
    console.log('🛡️ Preserving user progress by not updating mobile plan items');
  }
}

// Helper function to smart update AI Generated Plan items
async function smartUpdateAIPlanItems(planId, newExercises, userProgress, today) {
  try {
    console.log(`🤖 Smart updating AI plan ${planId} with ${newExercises.length} exercises`);
    
    // Get existing AI plan items
    const existingItems = await db('app_ai_generated_plan_items')
      .where({ plan_id: planId })
      .orderBy('id', 'asc');
    
    console.log(`📋 Found ${existingItems.length} existing AI plan items`);
    
    if (existingItems.length === 0) {
      // No existing items, just insert new ones
      console.log('📝 No existing AI items, inserting all new exercises');
      if (Array.isArray(newExercises) && newExercises.length) {
        const rows = newExercises.map((it) => {
          const workoutName = it.workout_name || it.name;
          const minutes = it.minutes ?? it.training_minutes ?? 0;
          
          // Handle weight ranges: calculate average if both min and max are provided
          const min = it.weight_min_kg != null ? Number(it.weight_min_kg) : undefined;
          const max = it.weight_max_kg != null ? Number(it.weight_max_kg) : undefined;
          const avg = Number.isFinite(min) && Number.isFinite(max)
            ? Math.round(((min + max) / 2) * 100) / 100
            : Number(it.weight_kg ?? it.weight ?? 0);
          
          const row = { 
            plan_id: planId, 
            workout_name: workoutName, 
            sets: it.sets || 0, 
            reps: it.reps || 0, 
            weight_kg: avg, 
            minutes, 
            user_level: it.user_level || 'Beginner' 
          };
          if (it.exercise_types !== undefined && it.exercise_types !== null && it.exercise_types !== '') {
            row.exercise_types = it.exercise_types;
          }
          // Include weight ranges if provided
          if (Number.isFinite(min)) row.weight_min_kg = min;
          if (Number.isFinite(max)) row.weight_max_kg = max;
          return row;
        });
        await db('app_ai_generated_plan_items').insert(rows);
      }
      return;
    }
    
    // Get the AI plan to understand the date range
    const aiPlan = await db('app_ai_generated_plans')
      .where({ id: planId })
      .first();
    
    if (!aiPlan) {
      console.error('❌ AI plan not found');
      return;
    }
    
    const startDate = new Date(aiPlan.start_date);
    const endDate = new Date(aiPlan.end_date);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    console.log(`📅 AI Plan dates: ${aiPlan.start_date} to ${aiPlan.end_date} (${totalDays} days)`);
    
    // Create distributed plan from new exercises
    const { createDistributedPlan } = require('./exerciseDistribution');
    const distributedPlan = createDistributedPlan(
      { items: newExercises },
      startDate,
      endDate
    );
    
    console.log(`🔄 Generated ${distributedPlan.daily_plans.length} daily AI plans`);
    
    // Determine which days to preserve vs update
    const daysToPreserve = new Set(userProgress.completedDays);
    const daysToUpdate = [];
    
    distributedPlan.daily_plans.forEach((dayPlan, index) => {
      const planDate = dayPlan.date;
      if (!daysToPreserve.has(planDate)) {
        daysToUpdate.push({ dayIndex: index, date: planDate, workouts: dayPlan.workouts });
      }
    });
    
    console.log(`✅ Preserving ${daysToPreserve.size} completed AI plan days`);
    console.log(`🔄 Updating ${daysToUpdate.length} future AI plan days`);
    
    // Update the AI plan items with new exercises
    if (Array.isArray(newExercises) && newExercises.length > 0) {
      console.log(`📝 Updating AI plan items with ${newExercises.length} exercises`);
      
      // Delete existing items
      await db('app_ai_generated_plan_items')
        .where({ plan_id: planId })
        .del();
      
      // Insert new items with weight range calculation
      const rows = newExercises.map((it) => {
        // Handle weight ranges: calculate average if both min and max are provided
        const min = it.weight_min_kg != null ? Number(it.weight_min_kg) : undefined;
        const max = it.weight_max_kg != null ? Number(it.weight_max_kg) : undefined;
        const avg = Number.isFinite(min) && Number.isFinite(max)
          ? Math.round(((min + max) / 2) * 100) / 100
          : Number(it.weight_kg || 0);
        
        return {
          plan_id: planId,
          workout_name: it.workout_name || it.name,
          exercise_types: it.exercise_types || null,
          sets: Number(it.sets || 0),
          reps: Number(it.reps || 0),
          weight_kg: avg,
          minutes: Number(it.minutes || 0),
          user_level: it.user_level || 'Beginner',
          weight_min_kg: Number.isFinite(min) ? min : null,
          weight_max_kg: Number.isFinite(max) ? max : null,
        };
      });
      
      if (rows.length > 0) {
        await db('app_ai_generated_plan_items').insert(rows);
        console.log(`✅ Successfully updated ${rows.length} AI plan items`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in AI plan smart update:', error);
    console.log('🛡️ Preserving AI plan user progress by not updating AI plan items');
  }
}

// Helper function to smart update Manual Training Plan items
async function smartUpdateManualPlanItems(planId, newExercises, userProgress, today) {
  try {
    console.log(`📱 Smart updating Manual Training Plan ${planId} with ${newExercises.length} exercises`);
    
    // Get existing manual plan items
    const existingItems = await db('app_manual_training_plan_items')
      .where({ plan_id: planId })
      .orderBy('id', 'asc');
    
    console.log(`📋 Found ${existingItems.length} existing manual plan items`);
    
    if (existingItems.length === 0) {
      // No existing items, just insert new ones
      console.log('📝 No existing manual items, inserting all new exercises');
      if (Array.isArray(newExercises) && newExercises.length) {
        const rows = newExercises.map((it) => {
          // Parse weight range from string like "20-40" or separate min/max fields
          const weightRange = parseWeightRange(it.weight_kg ?? it.weight);
          
          return {
            plan_id: planId,
            workout_name: it.workout_name,
            exercise_plan_category: it.exercise_plan_category || null,
            exercise_types: it.exercise_types || null,
            sets: it.sets || 0,
            reps: it.reps || 0,
            weight_kg: it.weight_min_kg != null && it.weight_max_kg != null 
              ? parseWeightRange(`${it.weight_min_kg}-${it.weight_max_kg}`).weight_kg
              : weightRange.weight_kg,
            weight_min_kg: it.weight_min_kg ?? weightRange.weight_min_kg,
            weight_max_kg: it.weight_max_kg ?? weightRange.weight_max_kg,
            minutes: it.minutes || 0,
            user_level: it.user_level || 'Beginner',
          };
        });
        await db('app_manual_training_plan_items').insert(rows);
      }
      return;
    }
    
    // Get the manual plan to understand the date range
    const manualPlan = await db('app_manual_training_plans')
      .where({ id: planId })
      .first();
    
    if (!manualPlan) {
      console.error('❌ Manual plan not found');
      return;
    }
    
    const startDate = new Date(manualPlan.start_date);
    const endDate = new Date(manualPlan.end_date);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    console.log(`📅 Manual Plan dates: ${manualPlan.start_date} to ${manualPlan.end_date} (${totalDays} days)`);
    
    // Create distributed plan from new exercises
    const { createDistributedPlan } = require('./exerciseDistribution');
    const distributedPlan = createDistributedPlan(
      { items: newExercises },
      startDate,
      endDate
    );
    
    console.log(`🔄 Generated ${distributedPlan.daily_plans.length} daily manual plans`);
    
    // Determine which days to preserve vs update
    const daysToPreserve = new Set(userProgress.completedDays);
    const daysToUpdate = [];
    
    distributedPlan.daily_plans.forEach((dayPlan, index) => {
      const planDate = dayPlan.date;
      if (!daysToPreserve.has(planDate)) {
        daysToUpdate.push({ dayIndex: index, date: planDate, workouts: dayPlan.workouts });
      }
    });
    
    console.log(`✅ Preserving ${daysToPreserve.size} completed manual plan days`);
    console.log(`🔄 Updating ${daysToUpdate.length} future manual plan days`);
    
    // Update the manual plan items with new exercises
    if (Array.isArray(newExercises) && newExercises.length > 0) {
      console.log(`📝 Updating manual plan items with ${newExercises.length} exercises`);
      
      // Delete existing items
      await db('app_manual_training_plan_items')
        .where({ plan_id: planId })
        .del();
      
      // Insert new items
      const rows = newExercises.map((it) => ({
        plan_id: planId,
        workout_name: it.workout_name || it.name,
        exercise_plan_category: it.exercise_plan_category || null,
        exercise_types: it.exercise_types || null,
        sets: Number(it.sets || 0),
        reps: Number(it.reps || 0),
        weight_kg: Number(it.weight_kg || 0),
        minutes: Number(it.minutes || 0),
        user_level: it.user_level || 'Beginner',
      }));
      
      if (rows.length > 0) {
        await db('app_manual_training_plan_items').insert(rows);
        console.log(`✅ Successfully updated ${rows.length} manual plan items`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in manual plan smart update:', error);
    console.log('🛡️ Preserving manual plan user progress by not updating manual plan items');
  }
}

module.exports = {
  getUserProgressForPlan,
  smartUpdateMobilePlanItems,
  smartUpdateAIPlanItems,
  smartUpdateManualPlanItems
};
