/**
 * Stats Calculator Utility
 * Calculates user statistics from daily_training_plans and daily_training_plan_items tables
 */

const db = require('../config/db');

/**
 * Calculate longest streak of consecutive workout days
 * @param {Array} completedDates - Array of dates (YYYY-MM-DD) with completed workouts
 * @returns {number} Longest streak in days
 */
function calculateLongestStreak(completedDates) {
  if (!completedDates || completedDates.length === 0) return 0;
  
  // Sort dates
  const sortedDates = [...new Set(completedDates)].sort();
  if (sortedDates.length === 0) return 0;
  
  let longestStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Consecutive day
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      // Streak broken
      currentStreak = 1;
    }
  }
  
  return longestStreak;
}

/**
 * Get dates for current week (Monday to Sunday)
 * @returns {Object} { start: Date, end: Date }
 */
function getCurrentWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  console.log(`📅 getCurrentWeekDates - Current date: ${now.toISOString()}, Day of week: ${dayOfWeek}`);
  console.log(`📅 getCurrentWeekDates - Week range: ${monday.toISOString()} to ${sunday.toISOString()}`);
  console.log(`📅 getCurrentWeekDates - Week range (date only): ${monday.toISOString().split('T')[0]} to ${sunday.toISOString().split('T')[0]}`);
  
  return { start: monday, end: sunday };
}

/**
 * Get dates for current month
 * @returns {Object} { start: Date, end: Date }
 */
function getCurrentMonthDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Get today's date in YYYY-MM-DD format
 * Uses local date to avoid timezone issues
 * @returns {string}
 */
function getTodayDate() {
  const now = new Date();
  // Get local date components to avoid timezone issues
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate all stats for a user from daily_training_plans and daily_training_plan_items
 * @param {number} userId - User ID
 * @returns {Object} Complete stats object
 */
async function calculateUserStats(userId, planType = null) {
  try {
    // Get all completed daily training plans for the user
    // IMPORTANT: Exclude stats records and ONLY include plans that are actually completed
    // This ensures incomplete plans (like day 2 in progress) are NOT included in stats
    // CRITICAL: Handle both boolean true and string 't' for is_completed (PostgreSQL can return either)
    let completedPlansQuery = db('daily_training_plans')
      .where(function() {
        // Handle both boolean true and string 't' for is_completed
        this.where('is_completed', true)
            .orWhere('is_completed', 't')
            .orWhere('is_completed', 1);
      })
      .where({ user_id: userId, is_stats_record: false })
      .whereNotNull('completed_at'); // Additional safeguard: must have completed_at timestamp
    
    // Filter by plan_type if specified
    if (planType) {
      // Handle web_assigned to include both web_assigned and web_assigne (typo variant)
      if (planType === 'web_assigned') {
        completedPlansQuery = completedPlansQuery.whereIn('plan_type', ['web_assigned', 'web_assigne']);
        console.log(`📊 Stats - Filtering by plan_type: web_assigned (including web_assigne variant) for user ${userId}`);
      } else {
        completedPlansQuery = completedPlansQuery.where({ plan_type: planType });
        console.log(`📊 Stats - Filtering by plan_type: ${planType} for user ${userId}`);
      }
    } else {
      console.log(`📊 Stats - No planType filter specified, will get ALL completed plans for user ${userId}`);
    }
    
    const completedPlans = await completedPlansQuery.orderBy('plan_date', 'desc');
    
    console.log(`📊 Stats - Found ${completedPlans.length} completed plans for user ${userId}${planType ? ` (plan_type: ${planType})` : ' (all plan types)'}`);
    
    // Debug: Log sample of completed plans to verify they're being found
    if (completedPlans.length > 0) {
      console.log(`📊 Stats - Sample completed plans (first 3):`, completedPlans.slice(0, 3).map(p => ({
        id: p.id,
        plan_date: p.plan_date,
        plan_type: p.plan_type,
        source_plan_id: p.source_plan_id,
        is_completed: p.is_completed,
        completed_at: p.completed_at ? 'has_value' : 'null'
      })));
    } else {
      console.warn(`⚠️ Stats - WARNING: No completed plans found! This might indicate a data issue.`);
      // Debug: Check if there are any plans at all for this user/planType
      let debugQuery = db('daily_training_plans')
        .where({ user_id: userId, is_stats_record: false });
      if (planType === 'web_assigned') {
        debugQuery = debugQuery.whereIn('plan_type', ['web_assigned', 'web_assigne']);
      } else if (planType) {
        debugQuery = debugQuery.where({ plan_type: planType });
      }
      const allPlansDebug = await debugQuery.select('id', 'plan_date', 'plan_type', 'is_completed', 'completed_at').limit(10);
      console.log(`📊 Stats - Debug: Found ${allPlansDebug.length} total plans (completed or not):`, allPlansDebug.map(p => ({
        id: p.id,
        plan_date: p.plan_date,
        plan_type: p.plan_type,
        is_completed: p.is_completed,
        completed_at: p.completed_at ? 'has_value' : 'null'
      })));
    }
    
    // Enhanced logging for AI plans specifically
    if (planType === 'ai_generated' || !planType) {
      const aiPlans = completedPlans.filter(p => p.plan_type === 'ai_generated');
      console.log(`📊 Stats - AI Generated plans found: ${aiPlans.length}`);
      aiPlans.forEach(plan => {
        console.log(`  🤖 AI Plan ${plan.id}: plan_date=${plan.plan_date}, is_completed=${plan.is_completed}, completed_at=${plan.completed_at}, plan_type=${plan.plan_type}`);
      });
    }
    
    completedPlans.forEach(plan => {
      console.log(`  - Completed plan ${plan.id}: plan_date=${plan.plan_date}, plan_type=${plan.plan_type}, is_completed=${plan.is_completed}, completed_at=${plan.completed_at}, is_stats_record=${plan.is_stats_record}`);
    });
    
    // Additional validation: Filter out any plans that don't have is_completed = true
    // This is a double-check to prevent incomplete plans from being included
    // CRITICAL: Handle both boolean true and string 't' for is_completed (PostgreSQL can return either)
    const validatedCompletedPlans = completedPlans.filter(plan => {
      // Check if plan is actually completed (handle boolean true, string 't', or number 1)
      const isCompleted = plan.is_completed === true || plan.is_completed === 't' || plan.is_completed === 1;
      const hasCompletedAt = plan.completed_at != null && plan.completed_at !== 'null';
      
      if (!isCompleted) {
        console.warn(`⚠️ Stats - WARNING: Plan ${plan.id} (plan_date: ${plan.plan_date}) has is_completed=${plan.is_completed} (type: ${typeof plan.is_completed}) but was returned by query! Filtering out.`);
        return false;
      }
      if (!hasCompletedAt) {
        console.warn(`⚠️ Stats - WARNING: Plan ${plan.id} (plan_date: ${plan.plan_date}) has is_completed=${plan.is_completed} but no completed_at timestamp! Filtering out.`);
        return false;
      }
      return true;
    });
    
    if (validatedCompletedPlans.length !== completedPlans.length) {
      console.warn(`⚠️ Stats - WARNING: Filtered out ${completedPlans.length - validatedCompletedPlans.length} incomplete plans from stats calculation`);
    }
    
    // Use validated plans only
    const finalCompletedPlans = validatedCompletedPlans;
    
    // Determine the plan type for this stats calculation
    // If planType was provided, use it; otherwise determine from plans
    let statsPlanType = planType || 'stats_record'; // Default fallback
    
    if (!planType && finalCompletedPlans.length > 0) {
      // If no planType filter was provided, determine from the plans
      // This should only happen if called without a planType filter
      const planTypeCounts = {};
      finalCompletedPlans.forEach(plan => {
        const pt = plan.plan_type || 'unknown';
        planTypeCounts[pt] = (planTypeCounts[pt] || 0) + 1;
      });
      
      if (Object.keys(planTypeCounts).length > 0) {
        const sortedTypes = Object.entries(planTypeCounts)
          .sort((a, b) => b[1] - a[1]);
        statsPlanType = sortedTypes[0][0];
      }
    }
    
    console.log(`📊 Stats - Calculating stats for plan_type: ${statsPlanType} (${finalCompletedPlans.length} completed plans)`);
    
    // Get all plans (including incomplete) for task calculation
    // IMPORTANT: Exclude stats records
    let allPlansQuery = db('daily_training_plans')
      .where({ user_id: userId, is_stats_record: false });
    
    // Filter by plan_type if specified
    if (planType) {
      // Handle web_assigned to include both web_assigned and web_assigne (typo variant)
      if (planType === 'web_assigned') {
        allPlansQuery = allPlansQuery.whereIn('plan_type', ['web_assigned', 'web_assigne']);
      } else {
        allPlansQuery = allPlansQuery.where({ plan_type: planType });
      }
    }
    
    const allPlans = await allPlansQuery.orderBy('plan_date', 'asc');
    
    console.log(`📊 Stats - Found ${allPlans.length} total plans (including incomplete) for user ${userId}`);
    console.log(`📊 Stats - Breakdown: ${finalCompletedPlans.length} completed, ${allPlans.length - finalCompletedPlans.length} incomplete`);
    
    // Calculate overall stats
    // Count individual workouts, not just completed plans
    let totalWorkouts = 0;
    finalCompletedPlans.forEach(plan => {
      try {
        let details = plan.exercises_details;
        if (typeof details === 'string') {
          details = JSON.parse(details);
        }
        
        let workouts = [];
        if (Array.isArray(details)) {
          workouts = details;
        } else if (details && typeof details === 'object') {
          if (Array.isArray(details.workouts)) {
            workouts = details.workouts;
          } else if (Array.isArray(details.exercises)) {
            workouts = details.exercises;
          } else if (Array.isArray(details.items)) {
            workouts = details.items;
          }
        }
        totalWorkouts += workouts.length;
      } catch (e) {
        // If parsing fails, count as 1 workout per completed plan (fallback)
        totalWorkouts += 1;
      }
    });
    
    // Calculate total minutes from exercises_details JSON
    const totalMinutes = finalCompletedPlans.reduce((sum, plan) => {
      try {
        let details = plan.exercises_details;
        if (typeof details === 'string') {
          details = JSON.parse(details);
        }
        
        let items = [];
        if (Array.isArray(details)) {
          items = details;
        } else if (details && typeof details === 'object') {
          if (Array.isArray(details.workouts)) {
            items = details.workouts;
          } else if (Array.isArray(details.exercises)) {
            items = details.exercises;
          } else if (Array.isArray(details.items)) {
            items = details.items;
          }
        }
        
        return sum + items.reduce((s, item) => s + (item.minutes || item.training_minutes || 0), 0);
      } catch (e) {
        // Skip invalid JSON
      }
      return sum;
    }, 0);
    
    // Daily workouts - group by date
    // Store ALL workouts for each day as arrays of workout names
    // Structure: {"2025-11-04": ["Chest", "Cardio"], "2025-11-03": ["Legs"]}
    // IMPORTANT: Use plan_date for grouping (the date the workout was planned for)
    // This ensures each day's workouts are stored separately and don't replace each other
    // Frontend can get count using array.length
    
    // Get today's date for use in calculations (used in remaining tasks, today's plans, etc.)
    // Use getTodayDate() which already returns local date in YYYY-MM-DD format
    const todayDateStr = getTodayDate();
    
    console.log(`📊 Stats - Today's date: ${todayDateStr}`);
    
    const dailyWorkouts = {};
    console.log(`📊 Stats - Processing ${finalCompletedPlans.length} completed plans for daily workouts`);
    finalCompletedPlans.forEach(plan => {
      // IMPORTANT: Double-check that plan is actually completed
      if (!plan.is_completed) {
        console.warn(`⚠️ Stats - WARNING: Plan ${plan.id} is NOT marked as completed (is_completed=${plan.is_completed}), but was included in completedPlans query! Skipping.`);
        return;
      }
      
      // Use plan_date for grouping (the date the workout was planned for)
      // This ensures day 1 workouts are stored under day 1, day 2 workouts under day 2, etc.
      // They won't replace each other because they have different dates
      let dateToUse = plan.plan_date;
      
      console.log(`📊 Stats - Processing completed plan ${plan.id}: plan_date=${plan.plan_date}, is_completed=${plan.is_completed}, completed_at=${plan.completed_at}`);
      
      if (!dateToUse) {
        console.log(`  ⏭️ Skipping plan ${plan.id}: no plan_date available (plan_date: ${plan.plan_date}, completed_at: ${plan.completed_at})`);
        return;
      }
      
      // Normalize date to YYYY-MM-DD format for consistent keys
      // CRITICAL: Use LOCAL date components to avoid timezone shifts
      // When dates are Date objects with timezone, toISOString() converts to UTC
      // which can shift the date by one day (e.g., Dec 02 GMT+0500 becomes Dec 01 UTC)
      let normalizedDate;
      if (dateToUse instanceof Date) {
        // Use LOCAL date components, not UTC
        const d = dateToUse;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        normalizedDate = `${year}-${month}-${day}`;
      } else if (typeof dateToUse === 'string') {
        if (dateToUse.includes('T')) {
          // If it has time component, extract just the date part
          normalizedDate = dateToUse.split('T')[0];
        } else {
          // Already YYYY-MM-DD format
          normalizedDate = dateToUse.split('T')[0];
        }
      } else {
        console.log(`  ⏭️ Skipping plan ${plan.id}: invalid plan_date type: ${typeof dateToUse}`);
        return;
      }
      
      console.log(`📊 Stats - Plan ${plan.id}: Using date ${normalizedDate} for grouping (plan_date: ${plan.plan_date}, completed_at: ${plan.completed_at})`);
      
      // Initialize daily workout entry as an array (simple structure: date -> array of workout names)
      if (!dailyWorkouts[normalizedDate]) {
        dailyWorkouts[normalizedDate] = [];
      }
      
      // Get workouts from this plan's exercises_details
      // According to distribution logic, each day should have 1-2 workouts
      try {
        let details = plan.exercises_details;
        if (typeof details === 'string') {
          details = JSON.parse(details);
        }
        
        let workouts = [];
        // Handle different structures: array, { workouts: [...], snapshots: [...] }, etc.
        if (Array.isArray(details)) {
          workouts = details;
        } else if (details && typeof details === 'object') {
          if (Array.isArray(details.workouts)) {
            workouts = details.workouts;
          } else if (Array.isArray(details.exercises)) {
            workouts = details.exercises;
          } else if (Array.isArray(details.items)) {
            workouts = details.items;
          }
        }
        
        // Each plan should have 1-2 workouts according to distribution logic
        // Limit to first 2 workouts to match distribution (max 2 workouts per day)
        const planWorkouts = workouts.slice(0, 2);
        
        // Only add workouts from this plan if we don't already have workouts for this day
        // This ensures we don't accumulate multiple plans' workouts on the same day
        if (dailyWorkouts[normalizedDate].length === 0) {
          // First plan for this day - add its workouts (up to 2)
          planWorkouts.forEach(workout => {
            const workoutName = workout.workout_name || workout.name || workout.exercise_name || 'Workout';
            if (workoutName && !dailyWorkouts[normalizedDate].includes(workoutName)) {
              dailyWorkouts[normalizedDate].push(workoutName);
            }
          });
          console.log(`📊 Stats - Plan ${plan.id}: Added ${dailyWorkouts[normalizedDate].length} workouts to date ${normalizedDate} (plan has ${workouts.length} total workouts)`);
        } else {
          // Another plan already exists for this day
          // According to distribution, each day should have only 1-2 workouts
          // Keep the first plan's workouts and log a warning
          console.log(`⚠️ Stats - Plan ${plan.id}: Date ${normalizedDate} already has ${dailyWorkouts[normalizedDate].length} workouts. Skipping additional workouts from plan ${plan.id} to maintain 1-2 workouts per day limit.`);
        }
        
        // Ensure array doesn't exceed 2 workouts (distribution logic limit)
        if (dailyWorkouts[normalizedDate].length > 2) {
          console.log(`⚠️ Stats - Date ${normalizedDate}: Workouts array has ${dailyWorkouts[normalizedDate].length} items, capping at 2 according to distribution logic`);
          dailyWorkouts[normalizedDate] = dailyWorkouts[normalizedDate].slice(0, 2);
        }
      } catch (e) {
        console.error(`Error parsing exercises_details for plan ${plan.id}:`, e);
        // Skip if parsing fails
      }
    });
    
    // Final safety check: Ensure array doesn't exceed 2 workouts per day
    Object.keys(dailyWorkouts).forEach(date => {
      const workoutArray = dailyWorkouts[date];
      if (Array.isArray(workoutArray)) {
        // Cap at 2 workouts per day (distribution logic)
        if (workoutArray.length > 2) {
          console.log(`⚠️ Stats - Date ${date}: Workouts array has ${workoutArray.length} items, capping at 2`);
          dailyWorkouts[date] = workoutArray.slice(0, 2);
        }
      } else {
        // If somehow it's not an array, convert it
        console.warn(`⚠️ Stats - Date ${date}: Expected array but got ${typeof workoutArray}, converting`);
        dailyWorkouts[date] = [];
      }
    });
    
    console.log(`📊 Stats - Daily workouts grouped by date: ${Object.keys(dailyWorkouts).length} days`);
    if (Object.keys(dailyWorkouts).length === 0) {
      console.warn(`⚠️ Stats - WARNING: No daily workouts found! This means no completed plans have valid plan_date or exercises_details.`);
      console.warn(`  - Completed plans count: ${finalCompletedPlans.length}`);
      if (finalCompletedPlans.length > 0) {
        console.warn(`  - Sample completed plan:`, {
          id: finalCompletedPlans[0].id,
          plan_date: finalCompletedPlans[0].plan_date,
          is_completed: finalCompletedPlans[0].is_completed,
          exercises_details_type: typeof finalCompletedPlans[0].exercises_details,
          exercises_details_length: finalCompletedPlans[0].exercises_details ? (typeof finalCompletedPlans[0].exercises_details === 'string' ? finalCompletedPlans[0].exercises_details.length : JSON.stringify(finalCompletedPlans[0].exercises_details).length) : 'null'
        });
      }
    } else {
      Object.keys(dailyWorkouts).forEach(date => {
        const workoutArray = dailyWorkouts[date];
        console.log(`  - ${date}: ${workoutArray.length} workouts (${workoutArray.join(', ')})`);
      });
    }
    
    // Calculate longest streak
    // Parse dates properly to handle ISO format
    // CRITICAL: Use LOCAL date components to avoid timezone shifts
    const completedDates = finalCompletedPlans
      .map(plan => {
        if (!plan.plan_date) return null;
        let normalizedDate;
        if (plan.plan_date instanceof Date) {
          // Use LOCAL date components, not UTC
          const d = plan.plan_date;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          normalizedDate = `${year}-${month}-${day}`;
        } else if (typeof plan.plan_date === 'string') {
          // Extract date part from string
          normalizedDate = plan.plan_date.split('T')[0];
        } else {
          return null;
        }
        return normalizedDate; // Return YYYY-MM-DD format
      })
      .filter(date => date !== null);
    
    console.log(`📊 Stats - Streak: Found ${completedDates.length} completed dates: ${completedDates.join(', ')}`);
    
    const longestStreak = calculateLongestStreak(completedDates);
    console.log(`📊 Stats - Streak: Longest streak calculated: ${longestStreak} days`);
    
    // Recent workouts - Get from daily_workouts (last 6 days)
    // Extract workouts from the 6 most recent days in dailyWorkouts
    // Sort by date (most recent first) and take first 6 days
    const recentWorkouts = [];
    const recentDays = [];
    
    // Get all dates from dailyWorkouts and sort them (most recent first)
    const dates = Object.keys(dailyWorkouts).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB - dateA; // Descending order (most recent first)
    });
    
    // Take only the 6 most recent days
    const sixMostRecentDays = dates.slice(0, 6);
    
    console.log(`📊 Stats - Recent workouts: Found ${dates.length} days with workouts, using ${sixMostRecentDays.length} most recent days`);
    console.log(`📊 Stats - Recent workouts: Most recent 6 days: ${sixMostRecentDays.join(', ')}`);
    
    // Extract workout names from each of the 6 most recent days
    for (const date of sixMostRecentDays) {
      const workoutArray = dailyWorkouts[date];
      if (workoutArray && Array.isArray(workoutArray) && workoutArray.length > 0) {
        // Add all workouts from this day
        workoutArray.forEach(workoutName => {
          if (workoutName && !recentWorkouts.includes(workoutName)) {
            recentWorkouts.push(workoutName);
          }
        });
        recentDays.push({
          date: date,
          workouts: workoutArray,
          count: workoutArray.length
        });
        console.log(`📊 Stats - Recent workouts: Added ${workoutArray.length} workouts from ${date} (${workoutArray.join(', ')})`);
          }
        }
    
    console.log(`📊 Stats - Recent workouts: Total ${recentWorkouts.length} unique workouts from ${sixMostRecentDays.length} days`);
    console.log(`📊 Stats - Recent workouts: Workout names: ${recentWorkouts.join(', ')}`);
    
    // Weekly progress
    // IMPORTANT: For completed plans, use completed_at date if available (for today's completions)
    // For incomplete plans, use plan_date
    const weekDates = getCurrentWeekDates();
    console.log(`📊 Stats - Weekly: Calculating week range from ${weekDates.start.toISOString()} to ${weekDates.end.toISOString()}`);
    console.log(`📊 Stats - Weekly: Week start (date only): ${weekDates.start.toISOString().split('T')[0]}, Week end (date only): ${weekDates.end.toISOString().split('T')[0]}`);
    
    const weekPlans = allPlans.filter(plan => {
      // Determine which date to use for filtering
      // For completed plans, prefer completed_at date (for accurate week/month grouping)
      // For incomplete plans, use plan_date
      let dateToUse = plan.plan_date;
      
      if (plan.is_completed && plan.completed_at) {
        try {
          let completedDate;
          if (plan.completed_at instanceof Date) {
            completedDate = new Date(plan.completed_at);
          } else if (typeof plan.completed_at === 'string') {
            completedDate = new Date(plan.completed_at);
          } else {
            completedDate = null;
          }
          
          if (completedDate) {
            // CRITICAL: Use LOCAL date components to avoid timezone shifts
            const d = completedDate;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const completedDateStr = `${year}-${month}-${day}`;
            
            // For completed plans, use completed_at date for accurate week/month grouping
            // This ensures plans completed this week are counted in this week's stats
            dateToUse = completedDateStr;
            console.log(`📊 Stats - Weekly: Plan ${plan.id} completed on ${completedDateStr}, using completed_at instead of plan_date (${plan.plan_date})`);
          }
        } catch (e) {
          console.error(`Error parsing completed_at for plan ${plan.id}:`, e);
          dateToUse = plan.plan_date;
        }
      }
      
      if (!dateToUse) {
        console.log(`  ⏭️ Skipping plan ${plan.id}: no date available (plan_date: ${plan.plan_date}, completed_at: ${plan.completed_at})`);
        return false;
      }
      
      // Handle date - it might be a Date object or string
      let planDate;
      if (dateToUse instanceof Date) {
        planDate = new Date(dateToUse);
      } else if (typeof dateToUse === 'string') {
        // Parse date string (handle both YYYY-MM-DD and ISO format)
        if (dateToUse.includes('T')) {
          planDate = new Date(dateToUse);
        } else {
          planDate = new Date(dateToUse + 'T00:00:00.000Z');
        }
      } else {
        console.log(`  ⏭️ Skipping plan ${plan.id}: invalid date type: ${typeof dateToUse}`);
        return false;
      }
      
      // CRITICAL: Use LOCAL date components to avoid timezone shifts
      let planDateStr;
      if (dateToUse instanceof Date) {
        const d = dateToUse;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        planDateStr = `${year}-${month}-${day}`;
      } else if (typeof dateToUse === 'string') {
        planDateStr = dateToUse.split('T')[0];
      } else {
        planDateStr = '';
      }
      
      // Create Date object for comparison (using UTC to avoid timezone issues in comparison)
      planDate.setHours(0, 0, 0, 0);
      const normalizedPlanDate = new Date(planDate);
      
      // Check if plan date is within the week range
      const isInWeek = normalizedPlanDate >= weekDates.start && normalizedPlanDate <= weekDates.end;
      
      if (isInWeek) {
        console.log(`  ✅ Plan ${plan.id}: date=${dateToUse} (normalized: ${planDateStr}, is_completed=${plan.is_completed}) is in week range`);
      } else {
        console.log(`  ⏭️ Plan ${plan.id}: date=${dateToUse} (normalized: ${planDateStr}) is OUTSIDE week range`);
      }
      
      return isInWeek;
    });
    
    console.log(`📊 Stats - Weekly: Found ${weekPlans.length} plans for week (${weekDates.start.toISOString().split('T')[0]} to ${weekDates.end.toISOString().split('T')[0]})`);
    weekPlans.forEach(plan => {
      console.log(`  - Week plan ${plan.id}: plan_date=${plan.plan_date}, is_completed=${plan.is_completed}, is_stats_record=${plan.is_stats_record}`);
    });
    
    const weekCompleted = weekPlans.filter(plan => plan.is_completed).length;
    const weekTotal = weekPlans.length;
    console.log(`📊 Stats - Weekly: ${weekCompleted} completed out of ${weekTotal} total plans`);
    const weekMinutes = weekPlans
      .filter(plan => plan.is_completed)
      .reduce((sum, plan) => {
        try {
          let details = plan.exercises_details;
          if (typeof details === 'string') {
            details = JSON.parse(details);
          }
          
          // Handle different structures: array, { workouts: [...], snapshots: [...] }, etc.
          let items = [];
          if (Array.isArray(details)) {
            items = details;
          } else if (details && typeof details === 'object') {
            if (Array.isArray(details.workouts)) {
              items = details.workouts;
            } else if (Array.isArray(details.exercises)) {
              items = details.exercises;
            } else if (Array.isArray(details.items)) {
              items = details.items;
            }
          }
          
          return sum + items.reduce((s, item) => s + (item.minutes || item.training_minutes || 0), 0);
        } catch (e) {}
        return sum;
      }, 0);
    
    // Count individual workouts (not just days) - count workout items from completed plans
    let weekWorkouts = 0;
    const completedWeekPlans = weekPlans.filter(plan => plan.is_completed);
    console.log(`📊 Stats - Weekly: Found ${completedWeekPlans.length} completed plans`);
    
    completedWeekPlans.forEach(plan => {
      try {
        let details = plan.exercises_details;
        if (typeof details === 'string') {
          details = JSON.parse(details);
        }
        
        let workoutCount = 0;
        // Handle different structures: array, { workouts: [...], snapshots: [...] }, etc.
        if (Array.isArray(details)) {
          // Count unique workouts/exercises in the array
          workoutCount = details.length;
          weekWorkouts += workoutCount;
          console.log(`  📊 Plan ${plan.id}: Found ${workoutCount} workouts in array format`);
        } else if (details && typeof details === 'object') {
          // If it's an object with workouts array, count those
          if (Array.isArray(details.workouts)) {
            workoutCount = details.workouts.length;
            weekWorkouts += workoutCount;
            console.log(`  📊 Plan ${plan.id}: Found ${workoutCount} workouts in workouts array`);
          } else if (Array.isArray(details.exercises)) {
            workoutCount = details.exercises.length;
            weekWorkouts += workoutCount;
            console.log(`  📊 Plan ${plan.id}: Found ${workoutCount} workouts in exercises array`);
          } else if (Array.isArray(details.items)) {
            workoutCount = details.items.length;
            weekWorkouts += workoutCount;
            console.log(`  📊 Plan ${plan.id}: Found ${workoutCount} workouts in items array`);
          } else {
            // If structure is unknown, count as 1 workout per completed plan (fallback)
            workoutCount = 1;
            weekWorkouts += workoutCount;
            console.log(`  ⚠️ Plan ${plan.id}: Unknown structure, using fallback count=1. Object keys: ${Object.keys(details || {})}`);
          }
        } else {
          // If no exercises_details, count as 1 workout per completed plan (fallback)
          workoutCount = 1;
          weekWorkouts += workoutCount;
          console.log(`  ⚠️ Plan ${plan.id}: No exercises_details, using fallback count=1`);
        }
      } catch (e) {
        // If parsing fails, count as 1 workout per completed plan (fallback)
        weekWorkouts += 1;
        console.error(`  ❌ Plan ${plan.id}: Error parsing exercises_details: ${e.message}`);
      }
    });
    
    console.log(`📊 Stats - Weekly: Total workouts counted: ${weekWorkouts}`);
    console.log(`📊 Stats - Weekly: Completed plans: ${weekCompleted}, Total plans: ${weekTotal}`);
    
    // Weekly batching logic: Every 6 days, new batch starts
    // Batch sizes: 12, 24, 34, 44, 54, ... (first batch 12, then 24, then +10 each time)
    // Calculate which batch we're in based on days with completed workouts
    const weeklyCompletedDates = completedWeekPlans.map(plan => {
      let dateToUse = plan.plan_date;
      if (plan.is_completed && plan.completed_at) {
        try {
          const completedDate = new Date(plan.completed_at);
          // CRITICAL: Use LOCAL date components to avoid timezone shifts
          const d = completedDate;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        } catch (e) {
          // If parsing fails, try to extract from plan_date
          if (plan.plan_date instanceof Date) {
            const d = plan.plan_date;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
          return typeof plan.plan_date === 'string' ? plan.plan_date.split('T')[0] : null;
        }
      }
      // Normalize plan_date
      if (dateToUse instanceof Date) {
        const d = dateToUse;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return typeof dateToUse === 'string' ? dateToUse.split('T')[0] : null;
    }).filter(Boolean);
    
    const uniqueCompletedDays = [...new Set(weeklyCompletedDates)].length;
    const batchNumber = Math.floor(uniqueCompletedDays / 6); // Which 6-day batch (0-indexed)
    
    // Calculate batch size for current batch
    let currentBatchSize;
    if (batchNumber === 0) {
      currentBatchSize = 12; // First batch: 12 workouts
    } else if (batchNumber === 1) {
      currentBatchSize = 24; // Second batch: 24 workouts
    } else {
      // Third batch onwards: 24 + (batchNumber - 1) * 10
      currentBatchSize = 24 + (batchNumber - 1) * 10;
    }
    
    // Calculate next batch size (for display when current batch is completed)
    let nextBatchSize;
    if (batchNumber === 0) {
      nextBatchSize = 24; // After first batch (12), next is 24
    } else if (batchNumber === 1) {
      nextBatchSize = 34; // After second batch (24), next is 34
    } else {
      // After current batch, next is current + 10
      nextBatchSize = currentBatchSize + 10;
    }
    
    // Calculate completed workouts (total in current week)
    const completedWorkouts = weekWorkouts;
    
    // Determine which batch to display based on completion status
    let displayCompleted = completedWorkouts;
    let displayTotal = currentBatchSize;
    let displayRemaining = Math.max(0, currentBatchSize - completedWorkouts);
    
    if (completedWorkouts >= currentBatchSize) {
      // Current batch completed, show next batch
      displayCompleted = completedWorkouts;
      displayTotal = nextBatchSize;
      displayRemaining = Math.max(0, nextBatchSize - completedWorkouts);
    }
    
    console.log(`📊 Stats - Weekly Batching: Batch #${batchNumber}, Current batch size: ${currentBatchSize}, Next batch size: ${nextBatchSize}, Completed: ${completedWorkouts}, Display: ${displayCompleted}/${displayTotal}`);
    
    const weeklyProgress = {
      completed: displayCompleted, // Format: 12/24 (12 completed out of 24 total)
      remaining: displayRemaining, // Format: 12/24 (12 remaining out of 24 total)
      total: displayTotal, // Total for current/next batch
      total_minutes: weekMinutes,
      total_workouts: weekWorkouts, // Individual workout count (not just days)
      batch_number: batchNumber,
      current_batch_size: currentBatchSize,
      next_batch_size: nextBatchSize
    };
    
    console.log(`📊 Stats - Weekly Progress calculated:`, {
      completed: weeklyProgress.completed,
      remaining: weeklyProgress.remaining,
      total_minutes: weeklyProgress.total_minutes,
      total_workouts: weeklyProgress.total_workouts
    });
    
    // Monthly progress
    // IMPORTANT: For completed plans, use completed_at date (for accurate month grouping)
    // For incomplete plans, use plan_date
    const monthDates = getCurrentMonthDates();
    console.log(`📊 Stats - Monthly: Calculating month range from ${monthDates.start.toISOString()} to ${monthDates.end.toISOString()}`);
    console.log(`📊 Stats - Monthly: Month start (date only): ${monthDates.start.toISOString().split('T')[0]}, Month end (date only): ${monthDates.end.toISOString().split('T')[0]}`);
    
    const monthPlans = allPlans.filter(plan => {
      // Determine which date to use for filtering
      // For completed plans, prefer completed_at date (for accurate month grouping)
      // For incomplete plans, use plan_date
      let dateToUse = plan.plan_date;
      
      if (plan.is_completed && plan.completed_at) {
        try {
          let completedDate;
          if (plan.completed_at instanceof Date) {
            completedDate = new Date(plan.completed_at);
          } else if (typeof plan.completed_at === 'string') {
            completedDate = new Date(plan.completed_at);
          } else {
            completedDate = null;
          }
          
          if (completedDate) {
            // CRITICAL: Use LOCAL date components to avoid timezone shifts
            const d = completedDate;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const completedDateStr = `${year}-${month}-${day}`;
            
            // For completed plans, use completed_at date for accurate month grouping
            // This ensures plans completed this month are counted in this month's stats
            dateToUse = completedDateStr;
            console.log(`📊 Stats - Monthly: Plan ${plan.id} completed on ${completedDateStr}, using completed_at instead of plan_date (${plan.plan_date})`);
          }
        } catch (e) {
          console.error(`Error parsing completed_at for plan ${plan.id}:`, e);
          dateToUse = plan.plan_date;
        }
      }
      
      if (!dateToUse) {
        console.log(`  ⏭️ Skipping plan ${plan.id}: no date available (plan_date: ${plan.plan_date}, completed_at: ${plan.completed_at})`);
        return false;
      }
      
      // Handle date - it might be a Date object or string
      // CRITICAL: Use LOCAL date components to avoid timezone shifts
      let planDateStr;
      if (dateToUse instanceof Date) {
        const d = dateToUse;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        planDateStr = `${year}-${month}-${day}`;
      } else if (typeof dateToUse === 'string') {
        planDateStr = dateToUse.split('T')[0];
      } else {
        console.log(`  ⏭️ Skipping plan ${plan.id}: invalid date type: ${typeof dateToUse}`);
        return false;
      }
      
      // Create Date object for comparison (using UTC to avoid timezone issues in comparison)
      let planDate;
      if (dateToUse instanceof Date) {
        planDate = new Date(dateToUse);
      } else if (typeof dateToUse === 'string') {
        if (dateToUse.includes('T')) {
          planDate = new Date(dateToUse);
        } else {
          planDate = new Date(dateToUse + 'T00:00:00.000Z');
        }
      }
      planDate.setHours(0, 0, 0, 0);
      const normalizedPlanDate = new Date(planDate);
      
      // Check if plan date is within the month range
      const isInMonth = normalizedPlanDate >= monthDates.start && normalizedPlanDate <= monthDates.end;
      
      if (isInMonth) {
        console.log(`  ✅ Plan ${plan.id}: date=${dateToUse} (normalized: ${planDateStr}, is_completed=${plan.is_completed}) is in month range`);
      } else {
        console.log(`  ⏭️ Plan ${plan.id}: date=${dateToUse} (normalized: ${planDateStr}) is OUTSIDE month range`);
      }
      
      return isInMonth;
    });
    
    console.log(`📊 Stats - Monthly: Found ${monthPlans.length} plans for month (${monthDates.start.toISOString().split('T')[0]} to ${monthDates.end.toISOString().split('T')[0]})`);
    const monthCompleted = monthPlans.filter(plan => plan.is_completed).length;
    const monthTotal = monthPlans.length;
    const monthMinutes = monthPlans
      .filter(plan => plan.is_completed)
      .reduce((sum, plan) => {
        try {
          let details = plan.exercises_details;
          if (typeof details === 'string') {
            details = JSON.parse(details);
          }
          
          // Handle different structures: array, { workouts: [...], snapshots: [...] }, etc.
          let items = [];
          if (Array.isArray(details)) {
            items = details;
          } else if (details && typeof details === 'object') {
            if (Array.isArray(details.workouts)) {
              items = details.workouts;
            } else if (Array.isArray(details.exercises)) {
              items = details.exercises;
            } else if (Array.isArray(details.items)) {
              items = details.items;
            }
          }
          
          return sum + items.reduce((s, item) => s + (item.minutes || item.training_minutes || 0), 0);
        } catch (e) {}
        return sum;
      }, 0);
    
    const now = new Date();
    const daysPassed = Math.floor((now - monthDates.start) / (1000 * 60 * 60 * 24)) + 1;
    const totalDaysInMonth = Math.floor((monthDates.end - monthDates.start) / (1000 * 60 * 60 * 24)) + 1;
    const completionRate = monthTotal > 0 ? (monthCompleted / monthTotal * 100) : 0;
    const dailyAvg = daysPassed > 0 ? Math.round(monthMinutes / daysPassed) : 0;
    
    // Count individual workouts for month (not just days)
    let monthWorkouts = 0;
    monthPlans
      .filter(plan => plan.is_completed)
      .forEach(plan => {
        try {
          let details = plan.exercises_details;
          if (typeof details === 'string') {
            details = JSON.parse(details);
          }
          
          if (Array.isArray(details)) {
            monthWorkouts += details.length;
          } else if (details && typeof details === 'object') {
            if (Array.isArray(details.workouts)) {
              monthWorkouts += details.workouts.length;
            } else if (Array.isArray(details.exercises)) {
              monthWorkouts += details.exercises.length;
            } else if (Array.isArray(details.items)) {
              monthWorkouts += details.items.length;
            }
          }
        } catch (e) {
          // Skip if parsing fails
        }
      });
    
    console.log(`📊 Stats - Monthly: Found ${monthCompleted} completed plans, ${monthWorkouts} total workouts`);
    
    // Monthly batching logic: Every 30 days, new batch starts
    // Batch sizes: 30, 60, 90, 120, ... (increments of 30)
    // Calculate which batch we're in based on days with completed workouts
    const monthCompletedDates = monthPlans
      .filter(plan => plan.is_completed)
      .map(plan => {
        let dateToUse = plan.plan_date;
        if (plan.is_completed && plan.completed_at) {
          try {
            const completedDate = new Date(plan.completed_at);
            // CRITICAL: Use LOCAL date components to avoid timezone shifts
            const d = completedDate;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          } catch (e) {
            // If parsing fails, try to extract from plan_date
            if (plan.plan_date instanceof Date) {
              const d = plan.plan_date;
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
            return typeof plan.plan_date === 'string' ? plan.plan_date.split('T')[0] : null;
          }
        }
        // Normalize plan_date
        if (dateToUse instanceof Date) {
          const d = dateToUse;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        return typeof dateToUse === 'string' ? dateToUse.split('T')[0] : null;
      })
      .filter(Boolean);
    
    const uniqueMonthCompletedDays = [...new Set(monthCompletedDates)].length;
    const monthBatchNumber = Math.floor(uniqueMonthCompletedDays / 30); // Which 30-day batch (0-indexed)
    
    // Calculate batch size (30, 60, 90, 120, ...)
    const monthBatchSize = 30 * (monthBatchNumber + 1);
    
    // Calculate completed workouts in current batch
    const monthCompletedWorkouts = monthWorkouts;
    
    // Calculate remaining in current batch
    const monthRemainingInBatch = Math.max(0, monthBatchSize - monthCompletedWorkouts);
    
    // If current batch is completed, show next batch
    let monthDisplayCompleted = monthCompletedWorkouts;
    let monthDisplayTotal = monthBatchSize;
    let monthDisplayRemaining = monthRemainingInBatch;
    
    if (monthCompletedWorkouts >= monthBatchSize) {
      // Current batch completed, show next batch
      const nextMonthBatchSize = monthBatchSize + 30;
      monthDisplayCompleted = monthCompletedWorkouts;
      monthDisplayTotal = nextMonthBatchSize;
      monthDisplayRemaining = Math.max(0, nextMonthBatchSize - monthCompletedWorkouts);
    }
    
    console.log(`📊 Stats - Monthly Batching: Batch #${monthBatchNumber}, Batch size: ${monthBatchSize}, Completed: ${monthCompletedWorkouts}, Display: ${monthDisplayCompleted}/${monthDisplayTotal}`);
    
    const monthlyProgress = {
      completed: monthDisplayCompleted, // Format: 30/60 (30 completed out of 60 total)
      remaining: monthDisplayRemaining, // Format: 30/60 (30 remaining out of 60 total)
      total: monthDisplayTotal, // Total for current batch
      completion_rate: parseFloat(completionRate.toFixed(1)),
      daily_avg: dailyAvg,
      days_passed: daysPassed,
      total_minutes: monthMinutes,
      total_workouts: monthWorkouts, // Individual workout count (not just days)
      batch_number: monthBatchNumber,
      batch_size: monthBatchSize
    };
    
    // Aggregate all items from daily_training_plan_items for this user
    // Note: This will be empty after migration, items are stored in stats_items JSON
    let allItems = [];
    try {
      const itemsData = await db('daily_training_plan_items')
        .join('daily_training_plans', 'daily_training_plan_items.daily_plan_id', 'daily_training_plans.id')
        .where('daily_training_plans.user_id', userId)
        .where('daily_training_plans.is_stats_record', false) // Exclude stats records
        .select(
          'daily_training_plan_items.*',
          'daily_training_plans.plan_date'
        )
        .orderBy('daily_training_plans.plan_date', 'desc')
        .orderBy('daily_training_plan_items.id', 'asc');
      
      allItems = itemsData.map(item => ({
        id: item.id,
        exercise_name: item.exercise_name,
        sets: item.sets,
        reps: item.reps,
        weight_kg: item.weight_kg,
        weight_min_kg: item.weight_min_kg || null,
        weight_max_kg: item.weight_max_kg || null,
        minutes: item.minutes,
        exercise_type: item.exercise_type,
        notes: item.notes,
        is_completed: item.is_completed,
        completed_at: item.completed_at,
        plan_date: item.plan_date,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));
    } catch (error) {
      // Table might not exist yet or already dropped
      console.log('Note: daily_training_plan_items table not available, using stats_items JSON instead');
      allItems = [];
    }
    
    // Build final stats object
    // IMPORTANT: Ensure ALL fields are always present, even if empty
    // This guarantees every stats record has daily, weekly, and monthly data
    const stats = {
      plan_type: statsPlanType, // Primary plan type from completed plans
      user_id: userId,
      date_updated: new Date(),
      // Daily workouts: Always an object (even if empty)
      daily_workouts: dailyWorkouts || {},
      // Overall stats: Always numbers (even if 0)
      total_workouts: totalWorkouts || 0,
      total_minutes: totalMinutes || 0,
      longest_streak: longestStreak || 0,
      // Recent workouts: Always an array (even if empty)
      recent_workouts: recentWorkouts || [],
      // Weekly progress: Always an object with all required fields
      weekly_progress: weeklyProgress || {
        completed: 0,
        remaining: 0,
        total: 0,
        total_minutes: 0,
        total_workouts: 0,
        batch_number: 0,
        current_batch_size: 12,
        next_batch_size: 24
      },
      // Monthly progress: Always an object with all required fields
      monthly_progress: monthlyProgress || {
        completed: 0,
        remaining: 0,
        total: 0,
        completion_rate: 0,
        daily_avg: 0,
        days_passed: 0,
        total_minutes: 0,
        total_workouts: 0,
        batch_number: 0,
        batch_size: 30
      },
      // Items: Always an array (even if empty)
      items: allItems || []
    };
    
    // Validate that all required fields are present
    if (!stats.daily_workouts || typeof stats.daily_workouts !== 'object') {
      console.warn(`⚠️ Stats validation: daily_workouts is missing or invalid, defaulting to {}`);
      stats.daily_workouts = {};
    }
    if (!stats.weekly_progress || typeof stats.weekly_progress !== 'object') {
      console.warn(`⚠️ Stats validation: weekly_progress is missing or invalid, defaulting to default object`);
      stats.weekly_progress = {
        completed: 0,
        remaining: 0,
        total: 0,
        total_minutes: 0,
        total_workouts: 0,
        batch_number: 0,
        current_batch_size: 12,
        next_batch_size: 24
      };
    }
    if (!stats.monthly_progress || typeof stats.monthly_progress !== 'object') {
      console.warn(`⚠️ Stats validation: monthly_progress is missing or invalid, defaulting to default object`);
      stats.monthly_progress = {
        completed: 0,
        remaining: 0,
        total: 0,
        completion_rate: 0,
        daily_avg: 0,
        days_passed: 0,
        total_minutes: 0,
        total_workouts: 0,
        batch_number: 0,
        batch_size: 30
      };
    }
    if (!Array.isArray(stats.recent_workouts)) {
      console.warn(`⚠️ Stats validation: recent_workouts is missing or invalid, defaulting to []`);
      stats.recent_workouts = [];
    }
    if (!Array.isArray(stats.items)) {
      console.warn(`⚠️ Stats validation: items is missing or invalid, defaulting to []`);
      stats.items = [];
    }
    
    console.log(`✅ Stats validation: All required fields present for plan_type ${statsPlanType}`);
    console.log(`  - daily_workouts: ${Object.keys(stats.daily_workouts).length} days`);
    console.log(`  - weekly_progress: ${JSON.stringify(stats.weekly_progress)}`);
    console.log(`  - monthly_progress: ${JSON.stringify(stats.monthly_progress)}`);
    
    return stats;
  } catch (error) {
    console.error('Error calculating user stats:', error);
    throw error;
  }
}

/**
 * Update or create user stats record in daily_training_plans table
 * Uses a special stats record with is_stats_record = true
 * @param {number} userId - User ID
 * @returns {Object} Updated stats record
 */
async function updateUserStats(userId) {
  try {
    console.log(`📊 updateUserStats - Starting stats update for user ${userId}`);
    
    // Define all plan types to create separate stats records for
    const planTypes = ['web_assigned', 'web_assigne', 'ai_generated', 'manual'];
    
    // Normalize plan types: web_assigne -> web_assigned
    const normalizePlanType = (pt) => {
      if (pt === 'web_assigne') return 'web_assigned';
      return pt;
    };
    
    // Get unique plan types from user's completed plans
    const allCompletedPlans = await db('daily_training_plans')
      .where({ user_id: userId, is_completed: true, is_stats_record: false })
      .whereNotNull('completed_at')
      .select('plan_type')
      .distinct();
    
    // Normalize and get unique plan types
    // Normalize web_assigne to web_assigned to avoid duplicates
    const normalizedPlanTypes = allCompletedPlans
      .map(p => normalizePlanType(p.plan_type))
      .filter(pt => pt && (pt === 'web_assigned' || pt === 'ai_generated' || pt === 'manual'));
    
    const userPlanTypes = [...new Set(normalizedPlanTypes)];
    
    // If no completed plans, still create stats records for all types (they'll be empty)
    // Use normalized plan types: web_assigned (not web_assigne), ai_generated, manual
    const normalizedPlanTypesList = ['web_assigned', 'ai_generated', 'manual'];
    const typesToProcess = userPlanTypes.length > 0 ? userPlanTypes : normalizedPlanTypesList;
    
    console.log(`📊 updateUserStats - Processing stats for plan types: ${typesToProcess.join(', ')}`);
    
    const updatedStats = [];
    
    // Create/update stats record for each plan type
    for (const planType of typesToProcess) {
      try {
        console.log(`📊 updateUserStats - Processing plan_type: ${planType}`);
        
        // Calculate stats for this plan type (handles web_assigned/web_assigne automatically)
        const stats = await calculateUserStats(userId, planType);
        
        console.log(`📊 updateUserStats - Calculated stats for ${planType}:`);
        console.log(`  - daily_workouts: ${Object.keys(stats.daily_workouts).length} days`);
        console.log(`  - recent_workouts: ${stats.recent_workouts.length} workouts`);
        console.log(`  - weekly_progress.total_workouts: ${stats.weekly_progress.total_workouts}`);
        console.log(`  - monthly_progress.total_workouts: ${stats.monthly_progress.total_workouts}`);
        console.log(`  - longest_streak: ${stats.longest_streak}`);
        
        // Validate stats data before saving
        if (!stats || typeof stats !== 'object') {
          console.error(`❌ updateUserStats - Invalid stats data for ${planType}`);
          continue;
        }
        
        // Check if stats record exists for this plan type
    const existing = await db('daily_training_plans')
          .where({ user_id: userId, is_stats_record: true, plan_type: planType })
      .first();
    
    if (existing) {
          console.log(`📊 updateUserStats - Found existing stats record for ${planType} with ID: ${existing.id}`);
          
      // Update existing stats record
          // Validate and stringify JSON fields safely
          let dailyWorkoutsJson, recentWorkoutsJson, weeklyProgressJson, monthlyProgressJson, itemsJson;
          
          try {
            dailyWorkoutsJson = JSON.stringify(stats.daily_workouts);
          } catch (e) {
            console.error(`❌ updateUserStats - ERROR stringifying daily_workouts:`, e);
            dailyWorkoutsJson = JSON.stringify({});
          }
          
          try {
            recentWorkoutsJson = JSON.stringify(stats.recent_workouts);
          } catch (e) {
            console.error(`❌ updateUserStats - ERROR stringifying recent_workouts:`, e);
            recentWorkoutsJson = JSON.stringify([]);
          }
          
          try {
            weeklyProgressJson = JSON.stringify(stats.weekly_progress);
          } catch (e) {
            console.error(`❌ updateUserStats - ERROR stringifying weekly_progress:`, e);
            weeklyProgressJson = JSON.stringify({});
          }
          
          try {
            monthlyProgressJson = JSON.stringify(stats.monthly_progress);
          } catch (e) {
            console.error(`❌ updateUserStats - ERROR stringifying monthly_progress:`, e);
            monthlyProgressJson = JSON.stringify({});
          }
          
          try {
            itemsJson = JSON.stringify(stats.items || []);
          } catch (e) {
            console.error(`❌ updateUserStats - ERROR stringifying items:`, e);
            itemsJson = JSON.stringify([]);
          }
          
          const updateData = {
            plan_type: planType, // Keep the plan_type for this stats record
          stats_date_updated: stats.date_updated,
            stats_daily_workouts: dailyWorkoutsJson,
          stats_total_workouts: stats.total_workouts,
          stats_total_minutes: stats.total_minutes,
          stats_longest_streak: stats.longest_streak,
            stats_recent_workouts: recentWorkoutsJson,
            stats_weekly_progress: weeklyProgressJson,
            stats_monthly_progress: monthlyProgressJson,
            stats_items: itemsJson,
          updated_at: new Date()
          };
          
          console.log(`📊 updateUserStats - Updating stats record for ${planType}...`);
          const updatedCount = await db('daily_training_plans')
            .where({ user_id: userId, is_stats_record: true, plan_type: planType })
            .update(updateData);
          
          if (updatedCount === 0) {
            console.error(`❌ updateUserStats - WARNING: Update query returned 0 affected rows for ${planType}!`);
          } else {
            console.log(`✅ updateUserStats - Successfully updated stats record for ${planType}`);
          }
      
      // Fetch and return updated record
      const updated = await db('daily_training_plans')
            .where({ user_id: userId, is_stats_record: true, plan_type: planType })
        .first();
          
          if (updated) {
            updatedStats.push(parseStatsRecord(updated));
          }
    } else {
          console.log(`📊 updateUserStats - No existing stats record for ${planType}, will create new one`);
          
      // Create new stats record in daily_training_plans table
      // Use NULL for plan_date since stats records don't have a specific date
          // Validate and stringify JSON fields safely
          let dailyWorkoutsJson, recentWorkoutsJson, weeklyProgressJson, monthlyProgressJson, itemsJson;
          
          try {
            dailyWorkoutsJson = JSON.stringify(stats.daily_workouts);
          } catch (e) {
            console.error(`❌ updateUserStats - ERROR stringifying daily_workouts for insert:`, e);
            dailyWorkoutsJson = JSON.stringify({});
          }
          
          try {
            recentWorkoutsJson = JSON.stringify(stats.recent_workouts);
          } catch (e) {
            console.error(`❌ updateUserStats - ERROR stringifying recent_workouts for insert:`, e);
            recentWorkoutsJson = JSON.stringify([]);
          }
          
          try {
            weeklyProgressJson = JSON.stringify(stats.weekly_progress);
          } catch (e) {
            console.error(`❌ updateUserStats - ERROR stringifying weekly_progress for insert:`, e);
            weeklyProgressJson = JSON.stringify({});
          }
          
          try {
            monthlyProgressJson = JSON.stringify(stats.monthly_progress);
          } catch (e) {
            console.error(`❌ updateUserStats - ERROR stringifying monthly_progress for insert:`, e);
            monthlyProgressJson = JSON.stringify({});
          }
          
          try {
            itemsJson = JSON.stringify(stats.items || []);
          } catch (e) {
            console.error(`❌ updateUserStats - ERROR stringifying items for insert:`, e);
            itemsJson = JSON.stringify([]);
          }
          
          const insertData = {
          user_id: stats.user_id,
          plan_date: null, // NULL for stats records
            plan_type: planType, // Use the plan type for this stats record
          plan_category: 'Stats', // Placeholder category
          is_stats_record: true,
          stats_date_updated: stats.date_updated,
            stats_daily_workouts: dailyWorkoutsJson,
          stats_total_workouts: stats.total_workouts,
          stats_total_minutes: stats.total_minutes,
          stats_longest_streak: stats.longest_streak,
            stats_recent_workouts: recentWorkoutsJson,
            stats_weekly_progress: weeklyProgressJson,
            stats_monthly_progress: monthlyProgressJson,
            stats_items: itemsJson
          };
          
          console.log(`📊 updateUserStats - Creating new stats record for ${planType}...`);
          try {
            const [newRecord] = await db('daily_training_plans')
              .insert(insertData)
              .returning('*');
        
            if (!newRecord) {
              console.error(`❌ updateUserStats - ERROR: Insert query did not return a record for ${planType}!`);
            } else {
              console.log(`✅ updateUserStats - Successfully created new stats record for ${planType} with ID: ${newRecord.id}`);
              updatedStats.push(parseStatsRecord(newRecord));
            }
          } catch (insertError) {
            // Handle duplicate key error - if constraint is on user_id alone, update existing record
            if (insertError.code === '23505' && insertError.constraint === 'daily_training_plans_stats_unique') {
              console.warn(`⚠️ updateUserStats - Duplicate key error for ${planType}. Attempting to update existing record instead.`);
              
              // Try to find and update the existing stats record
              // The constraint might be on user_id alone, so find any stats record for this user
              const existingStats = await db('daily_training_plans')
                .where({ user_id: userId, is_stats_record: true })
                .first();
              
              if (existingStats) {
                // Update the existing record with the new plan_type and stats
                const updateData = {
                  plan_type: planType,
                  stats_date_updated: stats.date_updated,
                  stats_daily_workouts: dailyWorkoutsJson,
                  stats_total_workouts: stats.total_workouts,
                  stats_total_minutes: stats.total_minutes,
                  stats_longest_streak: stats.longest_streak,
                  stats_recent_workouts: recentWorkoutsJson,
                  stats_weekly_progress: weeklyProgressJson,
                  stats_monthly_progress: monthlyProgressJson,
                  stats_items: itemsJson,
                  updated_at: new Date()
                };
                
                await db('daily_training_plans')
                  .where({ id: existingStats.id })
                  .update(updateData);
                
                const updated = await db('daily_training_plans')
                  .where({ id: existingStats.id })
                  .first();
                
                if (updated) {
                  console.log(`✅ updateUserStats - Updated existing stats record (ID: ${existingStats.id}) for ${planType}`);
                  updatedStats.push(parseStatsRecord(updated));
                }
              } else {
                console.error(`❌ updateUserStats - Duplicate key error but no existing stats record found for user ${userId}`);
              }
            } else {
              // Re-throw if it's not a duplicate key error
              throw insertError;
            }
          }
        }
      } catch (planTypeError) {
        console.error(`❌ updateUserStats - Error processing plan_type ${planType}:`, planTypeError);
        // Continue with next plan type
      }
    }
    
    console.log(`✅ updateUserStats - Completed stats update for user ${userId}. Updated ${updatedStats.length} stats records.`);
    
    // Return the first stats record (or most recent) for backward compatibility
    // Frontend can query by plan_type if needed
    return updatedStats.length > 0 ? updatedStats[0] : null;
  } catch (error) {
    console.error('Error updating user stats:', error);
    throw error;
  }
}

/**
 * Parse stats record from database (convert JSON strings to objects)
 * Parses from daily_training_plans table where is_stats_record = true
 * @param {Object} record - Database record from daily_training_plans table
 * @returns {Object} Parsed stats object
 */
function parseStatsRecord(record) {
  if (!record) return null;
  
  // Parse from daily_training_plans table
  return {
    id: record.id,
    user_id: record.user_id,
    date_updated: record.stats_date_updated,
    daily_workouts: record.stats_daily_workouts ? JSON.parse(record.stats_daily_workouts) : {},
    total_workouts: record.stats_total_workouts || 0,
    total_minutes: record.stats_total_minutes || 0,
    longest_streak: record.stats_longest_streak || 0,
    recent_workouts: record.stats_recent_workouts ? JSON.parse(record.stats_recent_workouts) : [],
    weekly_progress: record.stats_weekly_progress ? JSON.parse(record.stats_weekly_progress) : {},
    monthly_progress: record.stats_monthly_progress ? JSON.parse(record.stats_monthly_progress) : {},
    items: record.stats_items ? JSON.parse(record.stats_items) : [],
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

/**
 * Get user stats (with optional refresh)
 * Reads from daily_training_plans table where is_stats_record = true
 * @param {number} userId - User ID
 * @param {boolean} refresh - Whether to recalculate stats
 * @returns {Object} Stats object
 */
async function getUserStats(userId, refresh = false, planType = null) {
  try {
    if (refresh) {
      console.log(`📊 getUserStats - Refresh requested for user ${userId}, planType: ${planType || 'ALL'}`);
      return await updateUserStats(userId);
    }
    
    // Get stats from daily_training_plans table
    let statsQuery = db('daily_training_plans')
      .where({ user_id: userId, is_stats_record: true });
    
    // Filter by plan_type if specified
    if (planType) {
      statsQuery = statsQuery.where({ plan_type: planType });
      console.log(`📊 getUserStats - Querying stats record for user ${userId}, planType: ${planType}`);
    } else {
      console.log(`📊 getUserStats - Querying stats records for user ${userId} (no planType filter)`);
    }
    
    // If no planType specified, get all stats records (for backward compatibility, return first one)
    const records = planType 
      ? await statsQuery 
      : await statsQuery.orderBy('stats_date_updated', 'desc');
    
    console.log(`📊 getUserStats - Found ${records.length} stats record(s) for user ${userId}, planType: ${planType || 'ALL'}`);
    
    if (planType) {
      const record = records[0] || null;
      if (!record) {
        console.log(`📊 getUserStats - No stats record found for planType ${planType}, creating new one...`);
        // Create stats if they don't exist for this plan type
        await updateUserStats(userId);
        // After updating, fetch the specific plan type's stats
        const newRecord = await db('daily_training_plans')
          .where({ user_id: userId, is_stats_record: true, plan_type: planType })
          .first();
        if (!newRecord) {
          console.error(`❌ getUserStats - No stats record found for planType ${planType} even after updateUserStats`);
          
          // Debug: Check what stats records exist
          const allStatsRecords = await db('daily_training_plans')
            .where({ user_id: userId, is_stats_record: true })
            .select('id', 'plan_type', 'stats_date_updated', 'stats_total_workouts');
          console.log(`📊 getUserStats - Available stats records:`, allStatsRecords);
          
          return null;
        }
        console.log(`✅ getUserStats - Successfully created and retrieved stats record for planType ${planType}`);
        return parseStatsRecord(newRecord);
      }
      console.log(`✅ getUserStats - Found existing stats record for planType ${planType}, total_workouts: ${record.stats_total_workouts || 0}`);
      return parseStatsRecord(record);
    } else {
      // Return all stats records if no planType specified
      if (records.length === 0) {
        console.log(`📊 getUserStats - No stats records found, creating new ones...`);
        // Create stats if they don't exist
        return await updateUserStats(userId);
      }
      console.log(`✅ getUserStats - Returning most recent stats record (plan_type: ${records[0].plan_type}, total_workouts: ${records[0].stats_total_workouts || 0})`);
      // Return the most recently updated one for backward compatibility
      return parseStatsRecord(records[0]);
    }
  } catch (error) {
    console.error('Error getting user stats:', error);
    throw error;
  }
}

module.exports = {
  calculateUserStats,
  updateUserStats,
  getUserStats,
  parseStatsRecord
};

