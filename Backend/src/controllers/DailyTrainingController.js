const db = require('../config/db');

// NOTE: Helper function convertPlanDateToDayNumber removed - day_number is now required in all requests
// No backward compatibility needed - all clients must use day_number

/**
 * Helper function: Normalize date string to YYYY-MM-DD format
 * @param {string} dateStr - The date string to normalize
 * @returns {string} - Normalized date string in YYYY-MM-DD format
 */
const normalizeDate = (dateStr) => {
  try {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  } catch (e) {
    return dateStr;
  }
};

// Get daily training plans for a user (day_number only)
exports.getDailyPlans = async (req, res, next) => {
  try {
    const { user_id, day_number, plan_type, include_completed } = req.query;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    const gym_id = req.user.gym_id;
    const shouldIncludeCompleted = include_completed === 'true' || include_completed === true;

    let query = db('daily_training_plans')
      .select('*')
      .where('is_stats_record', false) // CRITICAL: Always exclude stats records at SQL level
      .orderBy('day_number', 'asc'); // Day-based sequencing using day_number

    // SECURITY: Ensure proper user isolation
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      // Admin/trainer can see plans for specific users or all users in their gym
      if (user_id) {
        query = query.where({ user_id: Number(user_id) });
      }
      if (gym_id != null) {
        query = query.andWhere({ gym_id: gym_id });
      }
    } else {
      // Regular users can only see their own plans
      // Don't filter by gym_id for mobile users - they should see their plans regardless of gym
      // This allows plans created from training approvals to be visible
      // IMPORTANT: Always exclude stats records at SQL level to prevent interference
      query = query.where({ 
        user_id: requestingUserId,
        is_stats_record: false 
      });
      
      // IMPORTANT: If plan_type is not specified, default to web_assigned for assigned plans
      // This prevents manual plan data from interfering with assigned plans
      // However, if plan_type is explicitly provided, use it (for manual/AI plans)
      if (!plan_type) {
        // Default to web_assigned to prevent manual plan interference
        // Frontend should explicitly pass plan_type=manual or plan_type=ai_generated if needed
        query = query.whereIn('plan_type', ['web_assigned', 'web_assigne']);
        console.log(`📊 getDailyPlans - No plan_type specified, defaulting to web_assigned to prevent manual plan interference`);
      }
    }

    const isMobileRequest = req.originalUrl?.includes('/mobile/') || requestingUserRole === 'USER';
    
    const targetDayNumber = day_number ? Number(day_number) : null;
    if (targetDayNumber && !isMobileRequest) {
      query = query.andWhere('day_number', targetDayNumber);
    }
    
    // Apply plan_type filter (if not already applied above for regular users)
    if (plan_type && (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer')) {
      // For admin/trainer, apply plan_type filter if provided
      if (plan_type === 'web_assigned') {
        query = query.whereIn('plan_type', ['web_assigned', 'web_assigne']);
      } else {
        query = query.andWhere('plan_type', plan_type);
      }
    } else if (plan_type && requestingUserRole !== 'gym_admin' && requestingUserRole !== 'trainer') {
      // For regular users, if plan_type is explicitly provided, use it (overrides default)
      if (plan_type === 'web_assigned') {
        query = query.whereIn('plan_type', ['web_assigned', 'web_assigne']);
      } else {
        query = query.andWhere('plan_type', plan_type);
      }
      console.log(`📊 getDailyPlans - Explicit plan_type filter applied: ${plan_type}`);
    }

    let plans = await query;

    // Log all plans returned from SQL query
    console.log(`📊 getDailyPlans - SQL query returned ${plans.length} plans`);
    plans.forEach(plan => {
      console.log(`  - Plan ${plan.id}: day_number=${plan.day_number}, is_completed=${plan.is_completed}, is_stats_record=${plan.is_stats_record}`);
    });
    
    // Add assignment_id helper for clarity (no plan_type enforcement)
        plans.forEach(plan => {
      if (plan.source_plan_id) {
        plan.assignment_id = Number(plan.source_plan_id);
      }
    });

    // Additional filter: Remove completed plans from previous days
    // This ensures Day 1 completed workouts don't show when Day 2 is active
    // With day_number, we simply find the first incomplete day_number for each source
    if (!date || isMobileRequest) {
      // Add debug logging
      console.log(`📊 getDailyPlans - Filtering ${plans.length} plans by day_number`);
      
      // IMPORTANT: Find the first incomplete plan based on day_number.
      // This ensures we start from the next uncompleted day after reload
      // instead of always snapping back to Day 1.
      // Logic:
      //   - Group plans by source_plan_id (for assigned plans, each assignment is separate)
      //   - For each source_plan_id, find the earliest plan where is_completed = false
      //   - If all are completed for a source_plan_id, use the earliest day_number from that source
      //   - Use the earliest firstIncompleteDay across all source_plan_ids
      let firstIncompleteDay = 1; // Fallback: Day 1
      
      // Group plans by source_plan_id to handle multiple assignments
      const plansBySource = {};
      plans.forEach(plan => {
        if (plan.day_number == null) return; // Skip plans without day_number
        const sourceId = plan.source_plan_id || 'no_source';
        if (!plansBySource[sourceId]) {
          plansBySource[sourceId] = [];
        }
        plansBySource[sourceId].push(plan);
      });
      
      console.log(`📊 getDailyPlans - Grouped plans by source_plan_id:`, Object.keys(plansBySource).map(sourceId => ({
        source_plan_id: sourceId,
        plan_count: plansBySource[sourceId].length
      })));
      
      // Find first incomplete day_number for each source_plan_id
      const firstIncompleteDaysBySource = {};
      Object.keys(plansBySource).forEach(sourceId => {
        const sourcePlans = [...plansBySource[sourceId]]
          .filter(p => p.day_number != null)
          .sort((a, b) => (a.day_number || 0) - (b.day_number || 0));
        
        // Find the first incomplete plan for this source
        let firstIncompleteDayForSource = null;
        for (const plan of sourcePlans) {
          // Check if plan is incomplete (handle null/undefined/false properly)
          // CRITICAL: Check all possible representations of is_completed
          // PostgreSQL can return 't'/'f' as strings, or true/false as booleans
          const isCompleted = plan.is_completed === true || 
                              plan.is_completed === 't' || 
                              plan.is_completed === 1 || 
                              plan.is_completed === 'true' ||
                              String(plan.is_completed).toLowerCase() === 'true';
          const hasCompletedAt = plan.completed_at != null && 
                                 plan.completed_at !== 'null' && 
                                 plan.completed_at !== '' &&
                                 String(plan.completed_at).trim() !== '';
          // A plan is considered completed ONLY if BOTH is_completed is true AND completed_at exists
          // This ensures we don't accidentally mark incomplete plans as completed
          const isActuallyCompleted = isCompleted && hasCompletedAt;
          
          // Log for debugging
          console.log(`🔍 Checking plan ${plan.id} (Day ${plan.day_number}): is_completed=${plan.is_completed} (type: ${typeof plan.is_completed}, raw: ${JSON.stringify(plan.is_completed)}), completed_at=${plan.completed_at}, isActuallyCompleted=${isActuallyCompleted}`);
          
          if (!isActuallyCompleted) {
            firstIncompleteDayForSource = plan.day_number;
            console.log(`✅ Found first incomplete plan for source_plan_id ${sourceId}: Day ${firstIncompleteDayForSource} (plan_id: ${plan.id})`);
            break;
          } else {
            console.log(`⏭️ Skipping completed plan ${plan.id} (Day ${plan.day_number}) - is_completed=${plan.is_completed}, completed_at=${plan.completed_at} - looking for next incomplete plan`);
          }
        }
        
        // If all plans for this source are completed, use the earliest day_number
        if (!firstIncompleteDayForSource && sourcePlans.length > 0) {
          firstIncompleteDayForSource = sourcePlans[0].day_number;
          console.log(`📅 All plans completed for source_plan_id ${sourceId}, using earliest day: Day ${firstIncompleteDayForSource}`);
        }
        
        if (firstIncompleteDayForSource) {
          firstIncompleteDaysBySource[sourceId] = firstIncompleteDayForSource;
        }
      });
      
      // Use the earliest firstIncompleteDay across all sources
      const allFirstIncompleteDays = Object.values(firstIncompleteDaysBySource);
      if (allFirstIncompleteDays.length > 0) {
        firstIncompleteDay = Math.min(...allFirstIncompleteDays);
        console.log(`📅 Using earliest first incomplete day across all sources: Day ${firstIncompleteDay}`);
      } else {
        console.log(`📅 No incomplete plans found, using Day 1 as fallback: Day ${firstIncompleteDay}`);
      }
      
      // CRITICAL: Calculate the most recent completed day_number for each source_plan_id
      // This is needed for resume calculation - frontend needs to know the last completed day
      // to resume at the next day (lastCompletedDay + 1)
      const mostRecentCompletedBySource = {};
      for (const plan of plans) {
        const sourceId = plan.source_plan_id?.toString();
        if (!sourceId || plan.day_number == null) continue;
        
        // Check if completed
        const isCompleted = plan.is_completed === true || plan.is_completed === 't' || plan.is_completed === 1;
        const hasCompletedAt = plan.completed_at != null && plan.completed_at !== 'null' && plan.completed_at !== '';
        const isActuallyCompleted = isCompleted && hasCompletedAt;
        
        if (isActuallyCompleted) {
          // Track the most recent completed day_number for this source
          if (!mostRecentCompletedBySource[sourceId] || plan.day_number > mostRecentCompletedBySource[sourceId]) {
            mostRecentCompletedBySource[sourceId] = plan.day_number;
          }
        }
      }
      
      console.log(`📅 Most recent completed days by source:`, mostRecentCompletedBySource);
      
      plans = plans.filter(plan => {
        // CRITICAL: Skip stats records (double-check even though SQL should filter them)
        if (plan.is_stats_record) {
          console.log(`  ⏭️ Skipping stats record: plan_id=${plan.id}, plan_type=${plan.plan_type}`);
          return false;
        }
        
        // CRITICAL: Skip plans with null day_number
        if (plan.day_number == null) {
          console.log(`  ⏭️ Skipping plan with null day_number: plan_id=${plan.id}, plan_type=${plan.plan_type}, is_stats_record=${plan.is_stats_record}`);
          return false;
        }
        
        // CRITICAL: Ensure plan_type matches (prevent manual plan interference with assigned plans)
        // If we defaulted to web_assigned above, only return web_assigned plans
        if (!plan_type && plan.plan_type !== 'web_assigned' && plan.plan_type !== 'web_assigne') {
          console.log(`  ⏭️ Skipping non-assigned plan (defaulting to web_assigned): plan_id=${plan.id}, plan_type=${plan.plan_type}`);
          return false;
        }
        
        // CRITICAL: Handle is_completed properly (boolean true, string 't', or number 1)
        const isCompleted = plan.is_completed === true || plan.is_completed === 't' || plan.is_completed === 1;
        const hasCompletedAt = plan.completed_at != null && plan.completed_at !== 'null';
        const isActuallyCompleted = isCompleted && hasCompletedAt;
        
        // CRITICAL LOGIC: What plans should we show?
        // If include_completed=true: Show ALL plans (completed and incomplete)
        // If include_completed=false: 
        //   1. First incomplete plan and all future plans (incomplete or completed) - user needs to see what's next
        //   2. The MOST RECENT completed plan (for resume calculation - frontend needs to know last completed day)
        //   3. DO NOT show other completed past plans - these are done and shouldn't clutter the list
        
        // Check if this plan is on or after the first incomplete day
        const isOnOrAfterFirstIncomplete = plan.day_number >= firstIncompleteDay;
        
        const sourceId = plan.source_plan_id?.toString();
        const mostRecentCompletedDay = mostRecentCompletedBySource[sourceId];
        const isMostRecentCompleted = isActuallyCompleted && sourceId && mostRecentCompletedDay === plan.day_number;
        
        // If include_completed=true, keep ALL plans
        if (shouldIncludeCompleted) {
            const completionStatus = isActuallyCompleted ? 'COMPLETED' : 'INCOMPLETE';
          console.log(`✅ Keeping plan (include_completed=true): plan_id=${plan.id}, day_number=${plan.day_number}, status=${completionStatus}, is_completed=${plan.is_completed}, completed_at=${plan.completed_at ? 'has_value' : 'null'}`);
          return true;
        }
        
        // Otherwise, use the filtering logic for include_completed=false
        // Keep plan if:
        // 1. It's on/after the first incomplete day (shows the next incomplete day and all future days)
        // 2. OR it's the most recent completed plan (for resume calculation)
        const shouldKeep = isOnOrAfterFirstIncomplete || isMostRecentCompleted;
        
        if (!shouldKeep) {
          if (isActuallyCompleted && !isMostRecentCompleted) {
            console.log(`🚫 CRITICAL: Filtering out completed plan ${plan.id} (Day ${plan.day_number}) - is_completed=${plan.is_completed}, completed_at=${plan.completed_at ? 'has_value' : 'null'}`);
          } else if (!isOnOrAfterFirstIncomplete) {
            console.log(`⏭️ Filtering out plan ${plan.id} (Day ${plan.day_number}) - before firstIncompleteDay (Day ${firstIncompleteDay})`);
          }
        } else {
          if (isActuallyCompleted) {
            console.log(`✅ Keeping completed plan: plan_id=${plan.id}, day_number=${plan.day_number}, isMostRecent=${isMostRecentCompleted}`);
          } else {
            console.log(`✅ Keeping incomplete plan: plan_id=${plan.id}, day_number=${plan.day_number}, is_completed=${plan.is_completed}`);
          }
        }
        
        return shouldKeep;
      });
      
      console.log(`📊 getDailyPlans - After filtering: ${plans.length} plans remaining`);
      plans.forEach(plan => {
        console.log(`  ✅ Final plan: plan_id=${plan.id}, day_number=${plan.day_number}, is_completed=${plan.is_completed}`);
      });
      
      // CRITICAL: Sort plans based on include_completed parameter
      // If include_completed=true: Sort by day_number only (chronological order)
      // If include_completed=false or not provided: Prioritize incomplete plans first, then by day_number ASC
      // This ensures the mobile app gets the correct order based on what it requests
      plans.sort((a, b) => {
        // If include_completed=true, sort by day_number only (chronological order)
        if (shouldIncludeCompleted) {
          return (a.day_number || 0) - (b.day_number || 0);
        }
        
        // Otherwise, prioritize incomplete plans over completed plans
        const aIsCompleted = a.is_completed === true || a.is_completed === 't' || a.is_completed === 1;
        const aHasCompletedAt = a.completed_at != null && a.completed_at !== 'null' && a.completed_at !== '';
        const aIsActuallyCompleted = aIsCompleted && aHasCompletedAt;
        
        const bIsCompleted = b.is_completed === true || b.is_completed === 't' || b.is_completed === 1;
        const bHasCompletedAt = b.completed_at != null && b.completed_at !== 'null' && b.completed_at !== '';
        const bIsActuallyCompleted = bIsCompleted && bHasCompletedAt;
        
        // If one is incomplete and the other is completed, incomplete comes first
        if (aIsActuallyCompleted && !bIsActuallyCompleted) {
          return 1; // a (completed) comes after b (incomplete)
        }
        if (!aIsActuallyCompleted && bIsActuallyCompleted) {
          return -1; // a (incomplete) comes before b (completed)
        }
        
        // Both are same completion status, sort by day_number ASC
        return (a.day_number || 0) - (b.day_number || 0);
      });
      
      console.log(`📊 getDailyPlans - After sorting: First plan is ${plans[0]?.id} (day_number: ${plans[0]?.day_number}, completed: ${plans[0]?.is_completed})`);
      
      // FINAL SAFETY CHECK: Remove ALL completed plans except the most recent one (unless include_completed=true)
      // This is a critical safeguard to ensure we NEVER return a completed plan as the first result
      // (unless it's the most recent completed plan for resume calculation, or include_completed=true)
      
      const plansBeforeFilter = plans.length;
      
      if (!shouldIncludeCompleted) {
        // Filter out completed plans (keep most recent completed for resume)
        plans = plans.filter(plan => {
          if (plan.day_number == null) return false;
          
          // CRITICAL: Use the same robust completion check as above
          const isCompleted = plan.is_completed === true || 
                              plan.is_completed === 't' || 
                              plan.is_completed === 1 || 
                              plan.is_completed === 'true' ||
                              String(plan.is_completed).toLowerCase() === 'true';
          const hasCompletedAt = plan.completed_at != null && 
                                 plan.completed_at !== 'null' && 
                                 plan.completed_at !== '' &&
                                 String(plan.completed_at).trim() !== '';
          const isActuallyCompleted = isCompleted && hasCompletedAt;
          
          const sourceId = plan.source_plan_id?.toString();
          const mostRecentCompletedDay = mostRecentCompletedBySource[sourceId];
          const isMostRecentCompleted = isActuallyCompleted && sourceId && mostRecentCompletedDay === plan.day_number;
          
          // Keep plan if:
          // 1. It's not completed, OR
          // 2. It's the most recent completed plan (for resume calculation)
          const shouldKeep = !isActuallyCompleted || isMostRecentCompleted;
          
          // Enhanced logging for debugging
          if (isActuallyCompleted && !isMostRecentCompleted) {
            console.log(`🚫 FINAL FILTER: Plan ${plan.id} (Day ${plan.day_number}) is completed (is_completed=${plan.is_completed}, completed_at=${plan.completed_at}) and not most recent - REMOVING`);
          } else if (isMostRecentCompleted) {
            console.log(`✅ FINAL FILTER: Keeping most recent completed plan ${plan.id} (Day ${plan.day_number}) for resume calculation`);
          }
          
          return shouldKeep;
        });
        
        console.log(`📊 getDailyPlans - After final filter: ${plans.length} plans remaining (removed ${plansBeforeFilter - plans.length} completed plans)`);
      } else {
        console.log(`📊 getDailyPlans - include_completed=true, keeping all plans including completed ones`);
      }
      
      // CRITICAL: Aggressively remove ALL completed plans from the beginning (except most recent, unless include_completed=true)
      // This is a double-check to ensure we NEVER return a completed plan as the first result
      // Keep removing completed plans until we find the first incomplete plan (or most recent completed)
      // BUT: Skip this if include_completed=true (frontend wants to see all plans including completed ones)
      if (!shouldIncludeCompleted) {
        let removedCount = 0;
        while (plans.length > 0) {
        const firstPlan = plans[0];
          if (firstPlan.day_number == null) {
            plans.shift();
            continue;
        }
        
        const isFirstCompleted = firstPlan.is_completed === true || firstPlan.is_completed === 't' || firstPlan.is_completed === 1;
        const hasFirstCompletedAt = firstPlan.completed_at != null && firstPlan.completed_at !== 'null' && firstPlan.completed_at !== '';
        const isFirstActuallyCompleted = isFirstCompleted && hasFirstCompletedAt;
        
        const firstSourceId = firstPlan.source_plan_id?.toString();
          const firstMostRecentCompletedDay = mostRecentCompletedBySource[firstSourceId];
          const isFirstMostRecentCompleted = isFirstActuallyCompleted && firstSourceId && firstMostRecentCompletedDay === firstPlan.day_number;
          
          // Remove if it's completed AND not the most recent completed (for resume)
          if (isFirstActuallyCompleted && !isFirstMostRecentCompleted) {
            console.log(`🚫 AGGRESSIVE REMOVAL: Removing completed plan ${firstPlan.id} (Day ${firstPlan.day_number}) from beginning - is_completed=${firstPlan.is_completed}, completed_at=${firstPlan.completed_at}`);
          plans.shift();
          removedCount++;
        } else {
            // Found an incomplete plan or most recent completed plan, stop removing
          break;
        }
      }
      
        if (removedCount > 0) {
          console.log(`📊 Removed ${removedCount} additional completed plan(s) from the beginning. Remaining plans: ${plans.length}`);
          if (plans.length > 0) {
            console.log(`  ✅ New first plan: plan_id=${plans[0].id}, day_number=${plans[0].day_number}, is_completed=${plans[0].is_completed}`);
          } else {
            console.warn(`⚠️ WARNING: All plans were completed and removed! This should not happen.`);
          }
        }
      }
      
      // Final verification: Ensure first plan is incomplete (unless it's the most recent completed)
      if (plans.length > 0) {
        const finalFirstPlan = plans[0];
        const isFinalCompleted = finalFirstPlan.is_completed === true || finalFirstPlan.is_completed === 't' || finalFirstPlan.is_completed === 1;
        const hasFinalCompletedAt = finalFirstPlan.completed_at != null && finalFirstPlan.completed_at !== 'null' && finalFirstPlan.completed_at !== '';
        const isFinalActuallyCompleted = isFinalCompleted && hasFinalCompletedAt;
        
        const finalSourceId = finalFirstPlan.source_plan_id?.toString();
        const finalMostRecentCompletedDay = mostRecentCompletedBySource[finalSourceId];
        const isFinalMostRecentCompleted = isFinalActuallyCompleted && finalSourceId && finalMostRecentCompletedDay === finalFirstPlan.day_number;
        
        if (isFinalActuallyCompleted && !isFinalMostRecentCompleted) {
          console.error(`❌ CRITICAL BUG: First plan ${finalFirstPlan.id} (Day ${finalFirstPlan.day_number}) is STILL completed after all filtering! This should never happen.`);
          // Last resort: Remove it
          plans.shift();
          console.log(`🚫 Removed the completed first plan as last resort. Remaining: ${plans.length} plans`);
        }
      }
      
      console.log(`✅ FINAL RESULT: First plan is ${plans[0] ? (plans[0].is_completed === true || plans[0].is_completed === 't' ? 'completed' : 'incomplete') : 'NONE'} (correct): plan_id=${plans[0]?.id}, day_number=${plans[0]?.day_number}, is_completed=${plans[0]?.is_completed}`);
      
      // Log the first plan that will be returned
      if (plans.length > 0) {
        const finalFirstPlan = plans[0];
        const isFirstCompleted = finalFirstPlan.is_completed === true || finalFirstPlan.is_completed === 't' || finalFirstPlan.is_completed === 1;
        const hasFirstCompletedAt = finalFirstPlan.completed_at != null && finalFirstPlan.completed_at !== 'null';
        const isFirstActuallyCompleted = isFirstCompleted && hasFirstCompletedAt;
        
        if (isFirstActuallyCompleted) {
          const finalSourceId = finalFirstPlan.source_plan_id?.toString();
          const finalMostRecentCompletedDay = mostRecentCompletedBySource[finalSourceId];
          const isFirstMostRecentCompleted = isFirstActuallyCompleted && finalSourceId && finalMostRecentCompletedDay === finalFirstPlan.day_number;
          
          if (isFirstMostRecentCompleted) {
            console.log(`✅ FINAL RESULT: First plan is most recent completed plan (valid for resume): plan_id=${finalFirstPlan.id}, day_number=${finalFirstPlan.day_number}`);
          } else {
            console.error(`❌ CRITICAL: First plan is completed but not most recent! This should never happen after filtering. plan_id=${finalFirstPlan.id}, day_number=${finalFirstPlan.day_number}`);
          }
        } else {
          console.log(`✅ FINAL RESULT: First plan is incomplete (correct): plan_id=${finalFirstPlan.id}, day_number=${finalFirstPlan.day_number}, is_completed=${finalFirstPlan.is_completed}`);
        }
      } else {
        console.warn(`⚠️ WARNING: No plans remaining after filtering! This might indicate all plans are completed or filtered out.`);
      }
      
      // CRITICAL: Generate next day on-the-fly if previous day is completed but next day doesn't exist
      // This ensures Day 2 appears in frontend after Day 1 is completed, but Day 2 is NOT stored in DB until Day 2 workouts are completed
      if (plans.length === 0) {
        // No plans remaining - check if we need to generate the next day from assignments
        // Find the last completed plan for any assignment
        const lastCompletedPlans = await db('daily_training_plans')
          .where({
            user_id: requestingUserId,
            is_stats_record: false,
            is_completed: true
          })
          .whereNotNull('completed_at')
          .whereNotNull('day_number')
          .whereIn('plan_type', ['web_assigned', 'web_assigne'])
          .modify((qb) => {
            if (gym_id != null) {
              qb.andWhere({ gym_id: gym_id });
            }
          })
          .orderBy('day_number', 'desc')
          .limit(10);
        
        if (lastCompletedPlans.length > 0) {
          // Group by source_plan_id and find the most recent completed plan for each assignment
          const lastCompletedBySource = {};
          for (const plan of lastCompletedPlans) {
            const sourceId = plan.source_plan_id?.toString();
            if (sourceId && !lastCompletedBySource[sourceId]) {
              lastCompletedBySource[sourceId] = plan;
            }
          }
          
          // For each assignment, try to generate the next day
          for (const [sourceId, lastPlan] of Object.entries(lastCompletedBySource)) {
            try {
              const assignment = await db('training_plan_assignments')
                .where({ id: sourceId })
                .orWhere({ id: parseInt(sourceId) || 0 })
                .first();
              
              if (assignment && assignment.daily_plans) {
                // Parse daily_plans
                let dailyPlans = null;
                try {
                  dailyPlans = typeof assignment.daily_plans === 'string'
                    ? JSON.parse(assignment.daily_plans)
                    : assignment.daily_plans;
                } catch (e) {
                  continue;
                }
                
                if (Array.isArray(dailyPlans) && dailyPlans.length > 0) {
                  // Find which day was last completed (use day_number directly)
                  const completedDayNumber = lastPlan.day_number || 0;
                  
                  console.log(`📅 On-the-fly generation (no plans): completedDayNumber=${completedDayNumber}`);
                  
                  // Check if next day exists in daily_plans
                  // dailyPlans array is 0-indexed, day_number is 1-indexed
                  // Day 1 → index 0, Day 2 → index 1, etc.
                  const nextDayIndex = completedDayNumber; // Next day index
                  
                  if (nextDayIndex < dailyPlans.length) {
                    const nextDayPlan = dailyPlans[nextDayIndex];
                    
                    const targetDayNumber = completedDayNumber + 1;
                    
                    console.log(`📅 On-the-fly generation (no plans): Next day will be Day ${targetDayNumber} at index ${nextDayIndex}`);
                    
                    const existingNextDay = await db('daily_training_plans')
                      .where({
                        user_id: requestingUserId,
                        source_plan_id: assignment.id.toString(),
                        is_stats_record: false,
                        day_number: targetDayNumber
                      })
                      .modify((qb) => {
                        if (gym_id != null) {
                          qb.andWhere({ gym_id: gym_id });
                        }
                      })
                      .first();
                    
                    if (!existingNextDay) {
                      // Generate next day on-the-fly (but don't store it yet)
                      const nextDayWorkouts = nextDayPlan.workouts || nextDayPlan.exercises || [];
                      
                      const generatedPlan = {
                        id: null, // Not stored in DB yet
                        user_id: requestingUserId,
                        gym_id: gym_id,
                        day_number: targetDayNumber,
                        plan_type: 'web_assigned',
                        source_plan_id: assignment.id.toString(),
                        plan_category: assignment.category || 'General',
                        user_level: assignment.user_level || 'Beginner',
                        exercises_details: JSON.stringify(nextDayWorkouts),
                        is_completed: false,
                        completed_at: null,
                        is_stats_record: false,
                        created_at: new Date(),
                        updated_at: new Date(),
                        // Mark as generated (not stored)
                        _is_generated: true,
                        _day_number: completedDayNumber + 1
                      };
                      
                      plans.push(generatedPlan);
                      console.log(`✅ Generated next day (Day ${targetDayNumber}) on-the-fly for assignment ${assignment.id} (NOT stored in DB yet)`);
                      break; // Only generate for the first assignment that needs it
                    }
                  }
                }
              }
            } catch (err) {
              console.error(`⚠️ Error generating next day for assignment ${sourceId}:`, err);
            }
          }
        }
      } else {
        // CRITICAL: Check if ANY completed plan in the list needs the next day generated
        // This handles cases where Day 1 is completed today (kept in list) or completed in the past
        // Find the most recent completed plan for each source_plan_id
        const completedPlansBySource = {};
        for (const plan of plans) {
          const isCompleted = plan.is_completed === true || plan.is_completed === 't' || plan.is_completed === 1;
          const hasCompletedAt = plan.completed_at != null && plan.completed_at !== 'null' && plan.completed_at !== '';
          const isActuallyCompleted = isCompleted && hasCompletedAt;
          
          if (isActuallyCompleted && plan.source_plan_id) {
            const sourceId = plan.source_plan_id.toString();
            // Keep the most recent completed plan for each source (by day_number)
            if (!completedPlansBySource[sourceId]) {
              completedPlansBySource[sourceId] = plan;
            } else {
              const existingDay = Number(completedPlansBySource[sourceId].day_number || 0);
              const currentDay = Number(plan.day_number || 0);
              if (currentDay > existingDay) {
                completedPlansBySource[sourceId] = plan;
              }
            }
          }
        }
        
        // For each completed plan, generate next day if it doesn't exist
        for (const [sourceId, completedPlan] of Object.entries(completedPlansBySource)) {
          try {
            const assignment = await db('training_plan_assignments')
              .where({ id: sourceId })
              .orWhere({ id: parseInt(sourceId) || 0 })
              .first();
            
            if (assignment && assignment.daily_plans) {
              // Parse daily_plans
              let dailyPlans = null;
              try {
                dailyPlans = typeof assignment.daily_plans === 'string'
                  ? JSON.parse(assignment.daily_plans)
                  : assignment.daily_plans;
              } catch (e) {
                // Skip if parse fails
                continue;
              }
              
              if (Array.isArray(dailyPlans) && dailyPlans.length > 0) {
                // Use day_number directly from completed plan (no date calculation needed)
                const completedDayNumber = completedPlan.day_number != null ? Number(completedPlan.day_number) : null;
                
                if (completedDayNumber == null || completedDayNumber < 1) {
                  console.warn(`⚠️ On-the-fly generation: completedPlan has invalid day_number (${completedPlan.day_number}), skipping`);
                  continue;
                }
                
                console.log(`📅 On-the-fly generation: completedDayNumber=${completedDayNumber}`);
                
                // Check if next day exists in daily_plans
                // day_number is 1-indexed (Day 1, Day 2, etc.), array index is 0-indexed
                const nextDayIndex = completedDayNumber; // Day 1 → index 0, Day 2 → index 1, etc.
                
                // day_number is 1-indexed, so next day is completedDayNumber + 1
                const targetDayNumber = completedDayNumber + 1;
                
                if (nextDayIndex < dailyPlans.length) {
                  const nextDayPlan = dailyPlans[nextDayIndex];
                  
                  console.log(`📅 On-the-fly generation: Next day will be Day ${targetDayNumber} at index ${nextDayIndex}`);
                  
                  const existingNextDay = await db('daily_training_plans')
                    .where({
                      user_id: requestingUserId,
                      source_plan_id: assignment.id.toString(),
                      is_stats_record: false,
                      day_number: targetDayNumber
                    })
                    .modify((qb) => {
                      if (gym_id != null) {
                        qb.andWhere({ gym_id: gym_id });
                      }
                    })
                    .first();
                  
                  if (!existingNextDay) {
                    // Generate next day on-the-fly (but don't store it yet)
                    const nextDayWorkouts = nextDayPlan.workouts || nextDayPlan.exercises || [];
                    
                    const generatedPlan = {
                      id: null, // Not stored in DB yet
                      user_id: requestingUserId,
                      gym_id: gym_id,
                      day_number: targetDayNumber,
                      plan_type: 'web_assigned',
                      source_plan_id: assignment.id.toString(),
                      plan_category: assignment.category || 'General',
                      user_level: assignment.user_level || 'Beginner',
                      exercises_details: JSON.stringify(nextDayWorkouts),
                      is_completed: false,
                      completed_at: null,
                      is_stats_record: false,
                      created_at: new Date(),
                      updated_at: new Date(),
                      // Mark as generated (not stored)
                      _is_generated: true,
                      _day_number: targetDayNumber
                    };
                    
                    // Insert the generated plan
                    plans.push(generatedPlan);
                    
                    // Re-sort plans to ensure correct order (by day_number; incomplete first when include_completed=false)
                    plans.sort((a, b) => {
                      const aCompleted = a.is_completed === true || a.is_completed === 't' || a.is_completed === 1;
                      const bCompleted = b.is_completed === true || b.is_completed === 't' || b.is_completed === 1;
                      
                      if (!shouldIncludeCompleted && aCompleted !== bCompleted) {
                        return aCompleted ? 1 : -1; // Incomplete first
                      }
                      
                      return (Number(a.day_number) || 0) - (Number(b.day_number) || 0);
                    });
                    
                    console.log(`✅ Generated next day (Day ${targetDayNumber}) on-the-fly for assignment ${assignment.id} (NOT stored in DB yet)`);
                    break; // Only generate for the first assignment that needs it
                  }
                }
              }
            }
          } catch (err) {
            console.error(`⚠️ Error generating next day for completed plan (source: ${sourceId}):`, err);
          }
        }
      }
    }

    // Get plan items from exercises_details JSON for each plan
    for (let plan of plans) {
      // Parse items from exercises_details JSON
      let items = [];
      try {
        const details = plan.exercises_details;
        if (details) {
          const parsed = typeof details === 'string' ? JSON.parse(details) : details;
          if (Array.isArray(parsed)) {
            items = parsed;
          } else if (parsed && typeof parsed === 'object') {
            // Handle different object structures
            if (Array.isArray(parsed.workouts)) {
              items = parsed.workouts;
            } else if (Array.isArray(parsed.exercises)) {
              items = parsed.exercises;
            } else if (Array.isArray(parsed.items)) {
              items = parsed.items;
            }
          }
        }
      } catch (e) {
        console.error('Error parsing exercises_details for items:', e);
        items = [];
      }
      plan.items = items;

      try {
        const raw = plan.exercises_details;
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed)) {
            plan.exercises_details = parsed; // keep as-is
          } else if (parsed && typeof parsed === 'object') {
            // Handle different object structures
            if (Array.isArray(parsed.workouts)) {
              plan.exercises_details = parsed.workouts; // return workouts as the details
              if (Array.isArray(parsed.snapshots)) {
                plan.completion_snapshots = parsed.snapshots;
              }
            } else if (Array.isArray(parsed.exercises)) {
              plan.exercises_details = parsed.exercises;
            } else if (Array.isArray(parsed.items)) {
              plan.exercises_details = parsed.items;
            }
          }
        }
      } catch (e) {
        console.error('Error parsing exercises_details for response:', e);
      }
      
      // Explicitly include daily_plan_id for mobile app compatibility
      plan.daily_plan_id = plan.id;
    }

    res.json({ success: true, data: plans });
  } catch (err) {
    console.error('Error getting daily training plans:', err);
    next(err);
  }
};

// Get single daily training plan with items
exports.getDailyPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    const gym_id = req.user.gym_id;

    let query = db('daily_training_plans').where({ id });

    // SECURITY: Ensure proper user isolation
    if (requestingUserRole !== 'gym_admin' && requestingUserRole !== 'trainer') {
      query = query.andWhere({ user_id: requestingUserId });
      if (gym_id != null) {
        query = query.andWhere({ gym_id: gym_id });
      } else {
        query = query.whereNull('gym_id');
      }
    } else {
      if (gym_id != null) {
        query = query.andWhere({ gym_id: gym_id });
      }
    }

    const plan = await query.first();
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Daily training plan not found' });
    }

    // Get plan items from exercises_details JSON
    let items = [];
    try {
      const details = plan.exercises_details;
      if (details) {
        const parsed = typeof details === 'string' ? JSON.parse(details) : details;
        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.workouts)) {
          items = parsed.workouts;
        }
      }
    } catch (e) {
      items = [];
    }

    res.json({ 
      success: true, 
      data: { 
        ...plan, 
        items,
        // Explicitly include daily_plan_id for mobile app compatibility
        daily_plan_id: plan.id,
        id: plan.id
      } 
    });
  } catch (err) {
    console.error('Error getting daily training plan:', err);
    next(err);
  }
};

// Submit daily training completion from mobile app
exports.submitDailyCompletion = async (req, res, next) => {
  // CRITICAL: Log immediately at function start to catch any issues
  console.log(`🔴 [submitDailyCompletion] START - Request received at ${new Date().toISOString()}`);
  console.log(`🔴 [submitDailyCompletion] Request body:`, JSON.stringify(req.body, null, 2));
  console.log(`🔴 [submitDailyCompletion] daily_plan_id: ${req.body.daily_plan_id}`);
  console.log(`📥 submitDailyCompletion - FUNCTION CALLED at ${new Date().toISOString()}`);
  
  try {
    // CRITICAL: Log request details immediately to debug if request is reaching the function
    console.log(`📥 submitDailyCompletion - Request received:`, {
      method: req.method,
      url: req.url,
      has_body: !!req.body,
      body_keys: req.body ? Object.keys(req.body) : [],
      has_user: !!req.user,
      user_id: req.user?.id,
      user_role: req.user?.role
    });
    
    const { daily_plan_id, completion_data } = req.body;
    const user_id = req.user?.id;
    const gym_id = req.user?.gym_id;

    // CRITICAL: Log the incoming request to track if multiple requests are being sent
    const requestTimestamp = new Date();

    // Helper: normalize any date-like value to LOCAL YYYY-MM-DD (avoid UTC shift)
    const normalizeLocalDate = (value) => {
      try {
        const d = value instanceof Date ? value : new Date(value);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } catch (e) {
        return '';
      }
    };
    console.log(`📥 submitDailyCompletion - Incoming request:`, {
      daily_plan_id: daily_plan_id,
      user_id: user_id,
      gym_id: gym_id,
      completion_data_count: Array.isArray(completion_data) ? completion_data.length : 0,
      completion_data_type: typeof completion_data,
      has_user: !!req.user,
      timestamp: requestTimestamp.toISOString()
    });
    
    // Validate user is authenticated
    if (!user_id) {
      console.error('❌ submitDailyCompletion - No user_id found in req.user');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    // CRITICAL: Check if there are any other recent completion requests for this user
    // This helps detect if the mobile app is sending multiple requests
    const recentCompletions = await db('daily_training_plans')
      .where({ user_id: user_id, is_stats_record: false })
      .whereNotNull('completed_at')
      .where('completed_at', '>', new Date(Date.now() - 10000).toISOString()) // Last 10 seconds
      .select('id', 'day_number', 'completed_at', 'source_plan_id')
      .orderBy('completed_at', 'desc')
      .limit(10);
    
    if (recentCompletions.length > 0) {
      console.log(`⚠️ WARNING: Found ${recentCompletions.length} recent completion(s) in the last 10 seconds for user ${user_id}:`, 
        recentCompletions.map(p => ({
          id: p.id,
          day_number: p.day_number,
          source_plan_id: p.source_plan_id,
          completed_at: p.completed_at
        }))
      );
    }
    
    // Validate required fields
    if (!daily_plan_id || !completion_data) {
      return res.status(400).json({
        success: false,
        message: 'daily_plan_id and completion_data are required'
      });
    }

    // Validate completion_data structure
    if (!Array.isArray(completion_data)) {
      return res.status(400).json({
        success: false,
        message: 'completion_data must be an array of exercise completions'
      });
    }

    // Find the daily training plan
    // For mobile users, we only check user_id match (not gym_id)
    // This allows users to complete their plans regardless of gym assignment
    let dailyPlan = await db('daily_training_plans')
      .where({
        id: daily_plan_id,
        user_id: user_id,
        is_stats_record: false // Exclude stats records
      })
      .first();

    // CRITICAL: If plan doesn't exist, it might be a generated plan (on-the-fly) that needs to be created
    // This happens when Day 2 appears in frontend but hasn't been stored in DB yet
    // We need to create it from the assignment's daily_plans data
    // IMPORTANT: Only create the plan if the user is actually completing it (has completion_data)
    // Do NOT create the next day plan when completing the previous day
    if (!dailyPlan) {
      console.log(`⚠️ Daily plan ${daily_plan_id} not found. Checking if it's a generated plan that needs to be created...`);
      
      // CRITICAL: Only create the plan if we have completion_data (user is actually completing workouts)
      // This prevents creating Day 2 when Day 1 is completed
      if (!completion_data || !Array.isArray(completion_data) || completion_data.length === 0) {
        console.error('❌ Cannot create plan: No completion_data provided. Plan should only be created when user completes workouts.');
        return res.status(400).json({
          success: false,
          message: 'Daily training plan not found. Cannot create plan without completion data. Please complete the workouts first.'
        });
      }
      
      // Try to find the plan without user_id filter to see if it exists
      const planExists = await db('daily_training_plans')
        .where({ id: daily_plan_id })
        .first();
      
      if (planExists) {
        console.error('Plan exists but filters failed:', {
          plan_user_id: planExists.user_id,
          plan_gym_id: planExists.gym_id,
          plan_is_stats_record: planExists.is_stats_record,
          request_user_id: user_id,
          request_gym_id: gym_id
        });
        return res.status(404).json({
          success: false,
          message: 'Daily training plan not found'
        });
      }
      
      // Plan doesn't exist - try to create it from assignment if we have source_plan_id and day_number
      // The frontend should send these in the request body for generated plans
      const { source_plan_id, day_number } = req.body;
      
      if (source_plan_id && day_number) {
        console.log(`🔄 Attempting to create missing plan from assignment ${source_plan_id} for day_number ${day_number} (user is completing workouts)`);
        
        try {
          // Find the assignment
          const assignment = await db('training_plan_assignments')
            .where({ id: source_plan_id })
            .orWhere({ id: source_plan_id.toString() })
            .first();
          
          if (assignment && assignment.daily_plans) {
            // Parse daily_plans
            let dailyPlans = null;
            try {
              dailyPlans = typeof assignment.daily_plans === 'string'
                ? JSON.parse(assignment.daily_plans)
                : assignment.daily_plans;
            } catch (e) {
              console.error('❌ Error parsing assignment daily_plans:', e);
            }
            
            if (Array.isArray(dailyPlans) && dailyPlans.length > 0) {
              const targetDayNumber = Number(day_number);
              if (!Number.isInteger(targetDayNumber) || targetDayNumber < 1) {
                return res.status(400).json({
                  success: false,
                  message: 'Invalid day_number provided'
                });
              }
              
              // CRITICAL: Verify this is the next sequential day after the last completed day
              // This prevents creating Day 3 when Day 1 is completed (should only create Day 2)
              const lastCompletedPlan = await db('daily_training_plans')
                .where({
                  user_id: user_id,
                  source_plan_id: assignment.id.toString(),
                  is_stats_record: false
                })
                .where(function() {
                  this.where('is_completed', true)
                    .orWhere('is_completed', 't')
                    .orWhere('is_completed', 1);
                })
                .whereNotNull('completed_at')
                .orderBy('day_number', 'desc')
                .first();
              
              if (lastCompletedPlan) {
                const lastCompletedDay = Number(lastCompletedPlan.day_number || 0);
                if (targetDayNumber !== lastCompletedDay + 1) {
                  console.error(`❌ Cannot create plan: Requested day ${targetDayNumber} is not the next sequential day after last completed day ${lastCompletedDay}.`);
                  return res.status(400).json({
                    success: false,
                    message: `Cannot create plan: You must complete days in order. The last completed day is ${lastCompletedDay}, but you're trying to complete Day ${targetDayNumber}.`
                  });
                }
              } else {
                // No completed plans yet - this should be Day 1
                if (targetDayNumber !== 1) {
                  console.error(`❌ Cannot create plan: No completed plans found, but requested day is ${targetDayNumber} (should be Day 1)`);
                  return res.status(400).json({
                    success: false,
                    message: `Cannot create plan: This should be Day 1, but requested day is ${targetDayNumber}.`
                  });
                }
              }
              
              if (targetDayNumber > 0 && targetDayNumber <= dailyPlans.length) {
                const dayPlan = dailyPlans[targetDayNumber - 1]; // 0-indexed
                const dayWorkouts = dayPlan.workouts || dayPlan.exercises || [];
                
                // Create the plan in the database
                const [createdPlan] = await db('daily_training_plans')
                  .insert({
                    user_id: user_id,
                    gym_id: gym_id,
                    day_number: targetDayNumber,
                    plan_type: 'web_assigned',
                    source_plan_id: assignment.id.toString(),
                    plan_category: assignment.category || 'General',
                    user_level: assignment.user_level || 'Beginner',
                    exercises_details: JSON.stringify(dayWorkouts),
                    is_completed: false,
                    completed_at: null,
                    is_stats_record: false
                  })
                  .returning('*');
                
                dailyPlan = createdPlan;
                console.log(`✅ Created missing plan ${createdPlan.id} from assignment ${assignment.id} for day_number ${targetDayNumber} - user is completing workouts`);
              } else {
                console.error(`❌ Invalid day number ${targetDayNumber} for assignment ${assignment.id} (has ${dailyPlans.length} days)`);
                return res.status(404).json({
                  success: false,
                  message: `Daily training plan not found and could not be created (invalid day number)`
                });
              }
            } else {
              console.error(`❌ Assignment ${assignment.id} has no daily_plans data`);
              return res.status(404).json({
                success: false,
                message: 'Daily training plan not found and could not be created (assignment has no daily plans)'
              });
            }
          } else {
            console.error(`❌ Assignment ${source_plan_id} not found or has no daily_plans`);
            return res.status(404).json({
              success: false,
              message: 'Daily training plan not found and could not be created (assignment not found)'
            });
          }
        } catch (createErr) {
          console.error('❌ Error creating missing plan:', createErr);
          return res.status(500).json({
            success: false,
            message: 'Daily training plan not found and could not be created',
            error: createErr.message
          });
        }
      } else {
        // No source_plan_id or day_number provided - cannot create the plan
        console.error('❌ Daily plan not found and cannot create (missing source_plan_id or day_number):', {
          daily_plan_id,
          source_plan_id: req.body.source_plan_id,
          day_number: req.body.day_number,
          user_id,
          gym_id
        });
        return res.status(404).json({
          success: false,
          message: 'Daily training plan not found. Please provide source_plan_id and day_number to create it.'
        });
      }
    }
    
    // CRITICAL: Log the plan details to verify we have the correct plan
    console.log(`📋 Found daily plan to complete:`, {
      id: dailyPlan.id,
      day_number: dailyPlan.day_number,
      source_plan_id: dailyPlan.source_plan_id,
      plan_type: dailyPlan.plan_type,
      user_id: dailyPlan.user_id,
      is_completed: dailyPlan.is_completed,
      completed_at: dailyPlan.completed_at
    });
    
    // CRITICAL: Check if there are multiple plans with the same ID (should never happen, but check for data corruption)
    const duplicateIdCheck = await db('daily_training_plans')
      .where({ id: daily_plan_id })
      .count('* as count')
      .first();
    
    if (duplicateIdCheck && parseInt(duplicateIdCheck.count) > 1) {
      console.error(`❌ CRITICAL DATA CORRUPTION: Found ${duplicateIdCheck.count} plans with the same ID (${daily_plan_id})! This should never happen.`);
      return res.status(500).json({
        success: false,
        message: 'Data corruption detected: Multiple plans with same ID'
      });
    }
    
    // CRITICAL: Check if plan is already completed BEFORE processing
    // This prevents duplicate completions and helps identify if mobile app is sending multiple requests
    const isAlreadyCompleted = dailyPlan.is_completed === true || dailyPlan.is_completed === 't' || dailyPlan.is_completed === 1;
    const hasPlanCompletedAt = dailyPlan.completed_at != null && dailyPlan.completed_at !== 'null';
    
    if (isAlreadyCompleted && hasPlanCompletedAt) {
      const completedAtTime = new Date(dailyPlan.completed_at);
      const now = new Date();
      const secondsSinceCompletion = (now - completedAtTime) / 1000;
      
      if (secondsSinceCompletion > 2) {
        // Completed more than 2 seconds ago - this is a duplicate request
        console.warn(`⚠️ Plan ${daily_plan_id} (Day ${dailyPlan.day_number || 'N/A'}) was already completed ${secondsSinceCompletion.toFixed(1)} seconds ago. Rejecting duplicate request.`);
        return res.status(200).json({
          success: true,
          message: 'Plan was already completed',
          data: {
            daily_plan_id: daily_plan_id,
            day_number: dailyPlan.day_number,
            is_completed: true,
            completed_at: dailyPlan.completed_at,
            already_completed: true
          }
        });
      }
    }
    
    // CRITICAL: Rate limiting - prevent completing multiple days from the same source_plan_id within 3 seconds
    // This prevents the mobile app from accidentally sending multiple completion requests
    // Check AFTER fetching the plan to get source_plan_id
    if (dailyPlan.source_plan_id) {
      const veryRecentCompletionsForSource = await db('daily_training_plans')
        .where({ 
          user_id: user_id, 
          source_plan_id: dailyPlan.source_plan_id,
          is_stats_record: false
        })
        .where(function() {
          // Handle both boolean true and string 't' for is_completed
          this.where('is_completed', true)
              .orWhere('is_completed', 't')
              .orWhere('is_completed', 1);
        })
        .whereNotNull('completed_at')
        .where('completed_at', '>', new Date(Date.now() - 3000).toISOString()) // Last 3 seconds
        .whereNot({ id: daily_plan_id }) // Exclude the current plan
        .select('id', 'day_number', 'completed_at', 'is_completed')
        .orderBy('completed_at', 'desc');
      
      if (veryRecentCompletionsForSource.length > 0) {
        console.error(`❌ CRITICAL: Found ${veryRecentCompletionsForSource.length} other plan(s) from the same source_plan_id (${dailyPlan.source_plan_id}) completed in the last 3 seconds!`, {
          current_plan_id: daily_plan_id,
          current_plan_day: dailyPlan.day_number,
          recent_completions: veryRecentCompletionsForSource.map(p => ({
            id: p.id,
            day_number: p.day_number,
            completed_at: p.completed_at,
            is_completed: p.is_completed
          }))
        });
        
        // Reject this request to prevent multiple days from being completed
        return res.status(429).json({
          success: false,
          message: 'Too many completion requests. Please wait a few seconds before completing another day.',
          error: 'RATE_LIMIT_EXCEEDED',
          recent_completions: veryRecentCompletionsForSource.length
        });
      }
    }

    // Update each exercise item with completion data
    for (const exerciseCompletion of completion_data) {
      const { item_id, sets_completed, reps_completed, weight_used, minutes_spent, notes } = exerciseCompletion;

      console.log('📝 Processing exercise completion:', {
        item_id,
        item_id_type: typeof item_id,
        sets_completed,
        reps_completed,
        weight_used,
        minutes_spent
      });

      // Items are now stored in exercises_details JSON column
      // Update the item in exercises_details array
      // Use the dailyPlan we already fetched to avoid duplicate query

      // Parse exercises_details JSON
      let exercisesDetails = [];
      try {
        if (dailyPlan.exercises_details) {
          // Check if it's already parsed (object) or needs parsing (string)
          const parsed = typeof dailyPlan.exercises_details === 'string' 
            ? JSON.parse(dailyPlan.exercises_details) 
            : dailyPlan.exercises_details;
          
          // Handle different structures: array, { workouts: [...], snapshots: [...] }, or other objects
          if (Array.isArray(parsed)) {
            exercisesDetails = parsed;
          } else if (parsed && typeof parsed === 'object') {
            // If it's an object with workouts array (from previous completion), use that
            if (Array.isArray(parsed.workouts)) {
              exercisesDetails = parsed.workouts;
            } else if (Array.isArray(parsed.exercises)) {
              exercisesDetails = parsed.exercises;
            } else if (Array.isArray(parsed.items)) {
              exercisesDetails = parsed.items;
            } else {
              // If it's an object but not in expected format, log warning
              console.warn('⚠️ exercises_details is an object but not in expected format:', Object.keys(parsed));
              exercisesDetails = [];
            }
          } else {
            exercisesDetails = [];
          }
        } else {
          exercisesDetails = [];
        }
      } catch (e) {
        console.error('❌ Error parsing exercises_details:', e);
        exercisesDetails = [];
      }

      // Ensure exercisesDetails is an array before proceeding
      if (!Array.isArray(exercisesDetails)) {
        console.error('❌ exercises_details is not an array:', typeof exercisesDetails, exercisesDetails);
        return res.status(400).json({
          success: false,
          message: `Invalid exercises_details format. Expected array, got ${typeof exercisesDetails}`
        });
      }

      // Handle item_id - can be index (0-based) or actual id
      let itemIndex = -1;
      
      if (item_id === undefined || item_id === null) {
        console.error('❌ Missing item_id in completion data:', exerciseCompletion);
        return res.status(400).json({
          success: false,
          message: 'item_id is required for each exercise completion. Use array index (0, 1, 2...) or item id.'
        });
      }

      // Try to find by actual id first
      if (item_id !== 0 || exercisesDetails.length > 0) {
        itemIndex = exercisesDetails.findIndex(item => 
          item && (
            item.id === item_id || 
            item.item_id === item_id ||
            item.id === exerciseCompletion['id'] ||
            item.item_id === exerciseCompletion['id']
          )
        );
      }
      
      // If not found by id, try using item_id as array index (0-based)
      if (itemIndex === -1 && typeof item_id === 'number' && item_id >= 0 && item_id < exercisesDetails.length) {
        itemIndex = item_id;
        console.log('📝 Using item_id as array index:', item_id);
      }
      
      // If still not found, try finding by exercise name or other fields
      if (itemIndex === -1 && exerciseCompletion['exercise_name']) {
        itemIndex = exercisesDetails.findIndex(item => 
          item && (
            item.exercise_name === exerciseCompletion['exercise_name'] ||
            item.name === exerciseCompletion['exercise_name'] ||
            item.workout_name === exerciseCompletion['exercise_name']
          )
        );
      }

      if (itemIndex === -1) {
        console.error('❌ Exercise item not found in exercises_details:', { 
          item_id, 
          daily_plan_id,
          exercises_details_count: exercisesDetails.length,
          available_ids: exercisesDetails.map((item, idx) => ({
            index: idx,
            id: item.id,
            item_id: item.item_id,
            exercise_name: item.exercise_name || item.name
          }))
        });
        return res.status(404).json({
          success: false,
          message: `Exercise item with id/index ${item_id} not found in daily plan ${daily_plan_id}. Available items: ${exercisesDetails.length}`
        });
      }

      // Update the item
      exercisesDetails[itemIndex] = {
        ...exercisesDetails[itemIndex],
        sets: sets_completed || exercisesDetails[itemIndex].sets || 0,
        reps: reps_completed || exercisesDetails[itemIndex].reps || 0,
        weight_kg: weight_used || exercisesDetails[itemIndex].weight_kg || 0,
        minutes: minutes_spent || exercisesDetails[itemIndex].minutes || 0,
        notes: notes || exercisesDetails[itemIndex].notes || null,
        is_completed: true,
        completed_at: new Date().toISOString()
      };

      // Update the plan's exercises_details
      await db('daily_training_plans')
        .where({ id: daily_plan_id })
        .update({
          exercises_details: JSON.stringify(exercisesDetails),
          updated_at: new Date()
        });

      console.log('✅ Updated exercise item in exercises_details');
    }

    // Mark the daily plan as completed
    // IMPORTANT: Log the plan details before update to verify plan_type
    console.log(`📝 Marking daily plan ${daily_plan_id} as completed:`, {
      plan_id: daily_plan_id,
      plan_type: dailyPlan.plan_type,
      day_number: dailyPlan.day_number,
      user_id: user_id,
      current_is_completed: dailyPlan.is_completed,
      current_completed_at: dailyPlan.completed_at
    });

    // CRITICAL: Verify that ONLY the requested plan will be updated
    // Check if there are any other plans that might accidentally be updated
    const otherPlansCheck = await db('daily_training_plans')
      .where({ 
        user_id: user_id,
        source_plan_id: dailyPlan.source_plan_id,
        plan_type: dailyPlan.plan_type,
        is_stats_record: false
      })
      .whereNot({ id: daily_plan_id })
      .where({ is_completed: false })
      .select('id', 'day_number', 'is_completed');
    
    console.log(`📊 Completion check: Found ${otherPlansCheck.length} other incomplete plans for same source_plan_id (${dailyPlan.source_plan_id})`);
    if (otherPlansCheck.length > 0) {
      console.log(`📊 Other incomplete plans:`, otherPlansCheck.map(p => ({ id: p.id, day_number: p.day_number, is_completed: p.is_completed })));
    }

    // Simple validation: Just ensure the plan exists before starting transaction
    const planInfo = await db('daily_training_plans')
      .where({ id: daily_plan_id })
      .select('id', 'day_number', 'source_plan_id', 'user_id')
      .first();
    
    if (!planInfo) {
      return res.status(404).json({
        success: false,
        message: `Daily plan ${daily_plan_id} not found`
      });
    }

    // CRITICAL: Use a transaction to ensure atomic update
    let trx = null;
    let postCommitVerification = null; // Declare outside try block so it's accessible later
    let commitSuccessful = false; // Declare outside try block so it's accessible later
    try {
      trx = await db.transaction();
      // IMPORTANT: Double-check the plan exists and get its current state before update
      const planBeforeUpdate = await trx('daily_training_plans')
        .where({ id: daily_plan_id })
        .select('id', 'day_number', 'source_plan_id', 'plan_type', 'is_completed', 'completed_at', 'user_id')
        .first();
      
      if (!planBeforeUpdate) {
        console.error(`❌ CRITICAL: Plan ${daily_plan_id} not found in transaction!`);
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: `Daily plan ${daily_plan_id} not found`
        });
      }
      
      // CRITICAL: Verify this is the correct plan (safety check)
      if (planBeforeUpdate.user_id !== user_id) {
        console.error(`❌ CRITICAL: Plan ${daily_plan_id} belongs to different user!`, {
          plan_user_id: planBeforeUpdate.user_id,
          request_user_id: user_id
        });
        await trx.rollback();
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: This plan belongs to a different user'
        });
      }
      
      // CRITICAL: Verify plan is not already completed (prevent duplicate completions)
      if (planBeforeUpdate.is_completed && planBeforeUpdate.completed_at) {
        const completedAtTime = new Date(planBeforeUpdate.completed_at);
        const now = new Date();
        const secondsSinceCompletion = (now - completedAtTime) / 1000;
        
        // If completed more than 5 seconds ago, this is likely a duplicate/retry request
        if (secondsSinceCompletion > 5) {
          console.warn(`⚠️ WARNING: Plan ${daily_plan_id} (Day ${planBeforeUpdate.day_number || 'N/A'}) was already completed ${secondsSinceCompletion.toFixed(1)} seconds ago!`, {
            completed_at: planBeforeUpdate.completed_at,
            current_is_completed: planBeforeUpdate.is_completed
          });
          // Return success but don't update again (idempotent)
          await trx.rollback();
          return res.status(200).json({
            success: true,
            message: 'Plan was already completed',
            data: {
              daily_plan_id: daily_plan_id,
              day_number: planBeforeUpdate.day_number,
              is_completed: true,
              completed_at: planBeforeUpdate.completed_at,
              already_completed: true
            }
          });
        } else {
          // Completed very recently (within 5 seconds) - might be a race condition or duplicate request
          console.warn(`⚠️ WARNING: Plan ${daily_plan_id} (Day ${planBeforeUpdate.day_number || 'N/A'}) was completed just ${secondsSinceCompletion.toFixed(1)} seconds ago! This might be a duplicate request.`);
        }
      }
      
      // CRITICAL: FIRST - Check if this is a valid sequential completion (exactly 1 day after last completed)
      // If so, allow it immediately and skip all other validations
      // This is the PRIMARY validation rule - sequential completions are always allowed
      let isSequentialCompletion = false;
      if (planBeforeUpdate.source_plan_id) {
        // Get assignment start_date to filter out completed plans before start_date
        let assignmentStartDateStr = null;
        const assignment = await trx('training_plan_assignments')
          .where({ id: planBeforeUpdate.source_plan_id })
          .first();
        
        if (assignment && assignment.start_date) {
          if (assignment.start_date instanceof Date) {
            const d = assignment.start_date;
            assignmentStartDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (typeof assignment.start_date === 'string') {
            assignmentStartDateStr = assignment.start_date.split('T')[0];
          }
        }
        
        // Get the LAST completed plan for this assignment (only on/after start_date)
        let lastCompletedPlanQuery = trx('daily_training_plans')
          .where({
            user_id: user_id,
            source_plan_id: planBeforeUpdate.source_plan_id,
            is_stats_record: false
          })
          .where(function() {
            this.where('is_completed', true)
              .orWhere('is_completed', 't')
              .orWhere('is_completed', 1);
          })
          .whereNotNull('completed_at')
          .whereNot({ id: daily_plan_id });
        
        // CRITICAL: For assigned plans, handle both 'web_assigned' and 'web_assigne' plan_type variations
        // This ensures we find the last completed plan even if plan_type has slight variations
        if (planBeforeUpdate.plan_type === 'web_assigned' || planBeforeUpdate.plan_type === 'web_assigne') {
          lastCompletedPlanQuery = lastCompletedPlanQuery.whereIn('plan_type', ['web_assigned', 'web_assigne']);
        } else {
          lastCompletedPlanQuery = lastCompletedPlanQuery.where('plan_type', planBeforeUpdate.plan_type);
        }
        
        if (assignmentStartDateStr) {
          // Ensure day_number is on/after start
          const startDayNumber = Number(planBeforeUpdate.day_number) ? 1 : null; // fallback; cannot derive start day reliably, so do not filter by date
          if (startDayNumber) {
            lastCompletedPlanQuery = lastCompletedPlanQuery.where('day_number', '>=', startDayNumber);
          }
        }
        
        const lastCompletedPlan = await lastCompletedPlanQuery
          .select('id', 'day_number', 'completed_at')
          .orderBy('day_number', 'desc')
          .first();
        
        if (lastCompletedPlan) {
          const lastCompletedDay = Number(lastCompletedPlan.day_number || 0);
          const requestedDay = Number(planBeforeUpdate.day_number || 0);
          
          if (requestedDay === lastCompletedDay + 1) {
            isSequentialCompletion = true;
            console.log(`✅ PRIMARY VALIDATION: Requested plan ${daily_plan_id} (Day ${requestedDay}) is exactly next after last completed day (${lastCompletedDay}).`);
          }
        } else {
          // CRITICAL: No completed plans yet - this is Day 1, explicitly allow it
          console.log(`✅ PRIMARY VALIDATION: No completed plans found for assignment ${planBeforeUpdate.source_plan_id}. This is Day 1 - ALLOWING completion of plan ${daily_plan_id} (day_number=${planBeforeUpdate.day_number}).`);
          isSequentialCompletion = true; // Treat Day 1 as valid sequential completion
        }
        
        // Also delete any duplicate completed plans before start_date
        if (assignment && assignment.start_date && assignmentStartDateStr) {
          const duplicateCompletedPlans = await trx('daily_training_plans')
            .where({
              user_id: user_id,
              source_plan_id: planBeforeUpdate.source_plan_id,
              is_stats_record: false
            })
            .where('day_number', '<', 1) // day_number before start is invalid; using 1 as minimum day
            .where(function() {
              this.where('is_completed', true)
                .orWhere('is_completed', 't')
                .orWhere('is_completed', 1);
            })
            .whereNotNull('completed_at')
            .select('id', 'day_number', 'is_completed', 'completed_at');
          
          if (duplicateCompletedPlans.length > 0) {
            console.warn(`⚠️ CRITICAL BUG DETECTED: Found ${duplicateCompletedPlans.length} COMPLETED plan(s) before start_date (${assignmentStartDateStr})!`);
            console.warn(`⚠️ These are duplicate Day 1 plans that cause completion bugs. Deleting them now.`);
            
            for (const duplicatePlan of duplicateCompletedPlans) {
              console.warn(`⚠️ Deleting duplicate completed plan: id=${duplicatePlan.id}, day_number=${duplicatePlan.day_number}, is_completed=${duplicatePlan.is_completed}, completed_at=${duplicatePlan.completed_at}`);
              await trx('daily_training_plans')
                .where({ id: duplicatePlan.id })
                .del();
            }
            
            console.log(`🗑️ Deleted ${duplicateCompletedPlans.length} duplicate completed plan(s) before start_date to fix completion bugs`);
          }
        }
      }
      
      // Simple validation: Just log if it's a sequential completion
      if (isSequentialCompletion) {
        console.log(`✅ VALIDATION PASSED: Requested plan is the next sequential day. Proceeding with completion.`);
      }
      
      console.log(`📝 About to update plan ${daily_plan_id}:`, {
        day_number: planBeforeUpdate.day_number,
        source_plan_id: planBeforeUpdate.source_plan_id,
        plan_type: planBeforeUpdate.plan_type,
        current_is_completed: planBeforeUpdate.is_completed,
        current_completed_at: planBeforeUpdate.completed_at,
        is_sequential_completion: isSequentialCompletion,
        user_id: user_id
      });
      
      // CRITICAL: Log plan_type handling for assigned plans
      if (planBeforeUpdate.plan_type === 'web_assigned' || planBeforeUpdate.plan_type === 'web_assigne') {
        console.log(`📋 ASSIGNED PLAN: Handling plan_type variations (web_assigned/web_assigne) for plan ${daily_plan_id}`);
      }
      
      // CRITICAL: Use id AND user_id in WHERE clause for safety
      // We use id (primary key) + user_id to ensure we're updating the correct user's plan
      // NOTE: We use day_number for sequencing to avoid timezone/format mismatch issues
      // The id is already a unique primary key, so adding user_id provides sufficient safety
      const completionTimestamp = new Date();
      
      console.log(`📝 About to execute UPDATE query:`, {
        daily_plan_id: daily_plan_id,
        user_id: user_id,
        day_number: planBeforeUpdate.day_number,
        source_plan_id: planBeforeUpdate.source_plan_id,
        current_is_completed: planBeforeUpdate.is_completed,
        current_completed_at: planBeforeUpdate.completed_at
      });

      // HARD GUARD: Prevent completing multiple NON-SEQUENTIAL days on the same calendar day.
      // This prevents a Flutter bug from accidentally completing Day 3 immediately after Day 1
      // with an extra /complete call on the same day. 
      // BUT: Allow completing the NEXT sequential day (Day 2 after Day 1) on the same calendar day.
      // Users should be able to complete Day 1, then Day 2, then Day 3 sequentially if they want.
      // CRITICAL: Skip this guard if it's already validated as a sequential completion above
      if (isSequentialCompletion) {
        console.log(`✅ SKIPPING HARD GUARD: This is a valid sequential completion (already validated above). Proceeding with update.`);
      } else if (planBeforeUpdate.source_plan_id) {
        // Get assignment start_date to filter out completed plans before start_date
        let assignmentStartDateStr = null;
        const assignment = await trx('training_plan_assignments')
          .where({ id: planBeforeUpdate.source_plan_id })
          .first();
        
        if (assignment && assignment.start_date) {
          if (assignment.start_date instanceof Date) {
            const d = assignment.start_date;
            assignmentStartDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (typeof assignment.start_date === 'string') {
            assignmentStartDateStr = assignment.start_date.split('T')[0];
          }
        }
        
        // Get the LAST completed plan for this assignment (regardless of when it was completed)
        // CRITICAL: Only consider plans on/after assignment start_date to avoid duplicate Day 1 bugs
        let lastCompletedPlanQuery = trx('daily_training_plans')
          .where({
            user_id: user_id,
            source_plan_id: planBeforeUpdate.source_plan_id,
            is_stats_record: false
          })
          .where(function() {
            this.where('is_completed', true)
              .orWhere('is_completed', 't')
              .orWhere('is_completed', 1);
          })
          .whereNotNull('completed_at')
          .whereNot({ id: daily_plan_id });
        
        // CRITICAL: For assigned plans, handle both 'web_assigned' and 'web_assigne' plan_type variations
        // This ensures we find the last completed plan even if plan_type has slight variations
        if (planBeforeUpdate.plan_type === 'web_assigned' || planBeforeUpdate.plan_type === 'web_assigne') {
          lastCompletedPlanQuery = lastCompletedPlanQuery.whereIn('plan_type', ['web_assigned', 'web_assigne']);
        } else {
          lastCompletedPlanQuery = lastCompletedPlanQuery.where('plan_type', planBeforeUpdate.plan_type);
        }
        
        const lastCompletedPlan = await lastCompletedPlanQuery
          .select('id', 'day_number', 'completed_at')
          .orderBy('day_number', 'desc')
          .first();

        if (lastCompletedPlan) {
          // Get day numbers for comparison
          const lastCompletedDay = lastCompletedPlan.day_number || 0;
          const requestedDay = planBeforeUpdate.day_number || 0;
          
          // Fetch earliest day_number for this assignment to allow Day 1 start
          let earliestDayNumber = null;
          try {
            const earliestPlan = await trx('daily_training_plans')
              .where({
                user_id,
                source_plan_id: planBeforeUpdate.source_plan_id,
                is_stats_record: false
              })
              .min('day_number as min_day')
              .first();
            if (earliestPlan && earliestPlan.min_day !== null) {
              earliestDayNumber = earliestPlan.min_day;
            }
          } catch (e) {
            console.warn('⚠️ Unable to fetch earliest day_number for hard guard check', e);
          }
          
          // If this is Day 1 (earliest day_number), allow it
          if (earliestDayNumber !== null && requestedDay === earliestDayNumber) {
            console.log(`✅ HARD GUARD: Requested plan ${daily_plan_id} is Day ${requestedDay} (earliest day) for source_plan_id ${planBeforeUpdate.source_plan_id}. Allowing to start the plan.`);
          }
          
          // Calculate day difference (requestedDay - lastCompletedDay)
          const dayDifference = requestedDay - lastCompletedDay;
          
          // Allow if it's the next sequential day (exactly 1 day after)
          // This is the PRIMARY validation - if it's sequential, allow it regardless of other checks
          if (dayDifference === 1) {
            console.log(`✅ HARD GUARD: Requested plan ${daily_plan_id} (Day ${requestedDay}) is the next sequential day after last completed plan (Day ${lastCompletedDay}). ALLOWING completion - bypassing other validations.`);
            // Skip the rest of the HARD GUARD validation - this is valid sequential completion
          } else if (dayDifference === 0) {
            // Same day - check if it's the same plan (shouldn't happen, but handle gracefully)
            if (lastCompletedPlan.id === daily_plan_id) {
              console.log(`⚠️ WARNING: Attempting to complete the same plan that's already completed. This is likely a duplicate request.`);
              await trx.rollback();
              return res.status(200).json({
                success: true,
                message: 'Plan was already completed',
                data: {
                  daily_plan_id: daily_plan_id,
                  day_number: requestedDay,
                  is_completed: true,
                  completed_at: lastCompletedPlan.completed_at,
                  already_completed: true
                }
              });
            } else {
              // Different plan on same day_number - reject
              console.error(`❌ HARD GUARD: Requested plan ${daily_plan_id} (Day ${requestedDay}) is on the same day as last completed plan ${lastCompletedPlan.id} (Day ${lastCompletedDay}). Rejecting.`);
              await trx.rollback();
              return res.status(400).json({
                success: false,
                message: `You cannot complete multiple plans on Day ${requestedDay}. The last completed plan is on the same day.`,
                error: 'SAME_DAY_COMPLETION',
                last_completed_day: lastCompletedDay,
                requested_day: requestedDay
              });
            }
          } else if (dayDifference < 0) {
            // Reject if it's before the last completed day
            console.error(`❌ HARD GUARD: Requested plan ${daily_plan_id} (Day ${requestedDay}) is before the last completed plan (Day ${lastCompletedDay}). Rejecting.`, {
              current_plan_id: daily_plan_id,
              current_day_number: planBeforeUpdate.day_number,
              requested_day: requestedDay,
              source_plan_id: planBeforeUpdate.source_plan_id,
              last_completed: {
                id: lastCompletedPlan.id,
                day_number: lastCompletedPlan.day_number,
                completed_at: lastCompletedPlan.completed_at
              },
              day_difference: dayDifference
            });

            await trx.rollback();
            return res.status(400).json({
              success: false,
              message: `You must complete days in order. The last completed day is Day ${lastCompletedDay}, but you're trying to complete Day ${requestedDay}.`,
              error: 'INVALID_COMPLETION_ORDER',
              last_completed_day: lastCompletedDay,
              requested_day: requestedDay
            });
          } else {
            // Reject if it's skipping days (more than 1 day after)
            console.error(`❌ HARD GUARD: Requested plan ${daily_plan_id} (Day ${requestedDay}) is skipping days. Last completed was Day ${lastCompletedDay}, but requested is ${dayDifference} day(s) later. Rejecting.`, {
              current_plan_id: daily_plan_id,
              current_day_number: planBeforeUpdate.day_number,
              requested_day: requestedDay,
              source_plan_id: planBeforeUpdate.source_plan_id,
              last_completed: {
                id: lastCompletedPlan.id,
                day_number: lastCompletedPlan.day_number,
                completed_at: lastCompletedPlan.completed_at
              },
              day_difference: dayDifference
            });

            await trx.rollback();
            return res.status(400).json({
              success: false,
              message: `You must complete days in order. The last completed day is Day ${lastCompletedDay}, but you're trying to complete Day ${requestedDay} (skipping ${dayDifference - 1} day(s)).`,
              error: 'SKIPPED_DAYS_COMPLETION',
              last_completed_day: lastCompletedDay,
              requested_day: requestedDay,
              days_skipped: dayDifference - 1
            });
          }
        } else {
          // No completed plans yet - allow any completion (user can start from any day)
          console.log(`✅ ALLOWING: No completed plans yet for this assignment. Allowing completion of plan ${daily_plan_id} (Day ${planBeforeUpdate.day_number || 'N/A'}).`);
        }
      }


      // CRITICAL: Double-check that we're about to update ONLY the correct plan
      // Verify the plan exists and matches exactly what we expect before updating
      const preUpdateCheck = await trx('daily_training_plans')
        .where({ 
          id: daily_plan_id,
          user_id: user_id,
          is_stats_record: false
        })
        .select('id', 'day_number', 'source_plan_id', 'plan_type', 'is_completed', 'completed_at')
        .first();
      
      if (!preUpdateCheck) {
        console.error(`❌ CRITICAL: Plan ${daily_plan_id} not found in pre-update check!`);
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: `Daily plan ${daily_plan_id} not found`
        });
      }
      
      // CRITICAL: Verify this is the exact plan we expect (safety check)
      // Normalize values for comparison to handle type differences (Date vs string, number vs string)
      const normalizeDate = (date) => {
        if (!date) return null;
        if (date instanceof Date) {
          return date.toISOString().split('T')[0];
        }
        if (typeof date === 'string') {
          return date.split('T')[0];
        }
        return new Date(date).toISOString().split('T')[0];
      };
      
      const normalizeId = (id) => {
        if (id == null) return null;
        return String(id);
      };
      
      const preUpdateDayNumber = preUpdateCheck.day_number != null ? Number(preUpdateCheck.day_number) : null;
      const expectedDayNumber = planBeforeUpdate.day_number != null ? Number(planBeforeUpdate.day_number) : null;
      const preUpdateSourceId = normalizeId(preUpdateCheck.source_plan_id);
      const expectedSourceId = normalizeId(planBeforeUpdate.source_plan_id);
      const preUpdateType = String(preUpdateCheck.plan_type || '');
      const expectedType = String(planBeforeUpdate.plan_type || '');
      
      if (preUpdateDayNumber !== expectedDayNumber || 
          preUpdateSourceId !== expectedSourceId ||
          preUpdateType !== expectedType) {
        console.error(`❌ CRITICAL: Plan ${daily_plan_id} details don't match!`, {
          pre_update: {
            day_number: preUpdateCheck.day_number,
            day_number_normalized: preUpdateDayNumber,
            source_plan_id: preUpdateCheck.source_plan_id,
            source_plan_id_normalized: preUpdateSourceId,
            plan_type: preUpdateCheck.plan_type,
            plan_type_normalized: preUpdateType
          },
          expected: {
            day_number: planBeforeUpdate.day_number,
            day_number_normalized: expectedDayNumber,
            source_plan_id: planBeforeUpdate.source_plan_id,
            source_plan_id_normalized: expectedSourceId,
            plan_type: planBeforeUpdate.plan_type,
            plan_type_normalized: expectedType
          }
        });
        await trx.rollback();
        return res.status(500).json({
          success: false,
          message: 'Plan details mismatch - cannot safely update'
        });
      }
      
      console.log(`✅ Pre-update verification passed: Plan ${daily_plan_id} details match`, {
        day_number: preUpdateDayNumber,
        source_plan_id: preUpdateSourceId,
        plan_type: preUpdateType
      });
      
      // CRITICAL: Check if there are any OTHER plans that might accidentally match this WHERE clause
      // This should never happen since we're using primary key (id), but double-check for safety
      const otherPlansCheck = await trx('daily_training_plans')
        .where({ 
          user_id: user_id,
          source_plan_id: planBeforeUpdate.source_plan_id,
          plan_type: planBeforeUpdate.plan_type,
          is_stats_record: false
        })
        .whereNot({ id: daily_plan_id })
        .where({ day_number: planBeforeUpdate.day_number }) // Same day_number
        .select('id', 'day_number', 'is_completed');
      
      if (otherPlansCheck.length > 0) {
        console.error(`❌ CRITICAL: Found ${otherPlansCheck.length} other plan(s) with same day_number (Day ${planBeforeUpdate.day_number}) for same user/assignment!`, {
          current_plan_id: daily_plan_id,
          other_plans: otherPlansCheck.map(p => ({
            id: p.id,
            day_number: p.day_number,
            is_completed: p.is_completed
          }))
        });
        // Don't block - just log warning, since we're using primary key which should be unique
      }

      // CRITICAL: Final safety check - verify NO OTHER plans will be affected by this update
      // This is a last-ditch check to prevent Day 3 from being completed when Day 2 is completed
      const finalSafetyCheck = await trx('daily_training_plans')
        .where({ 
          id: daily_plan_id,
          user_id: user_id
        })
        .select('id', 'day_number', 'source_plan_id', 'is_completed', 'completed_at')
        .first();
      
      if (!finalSafetyCheck) {
        console.error(`❌ CRITICAL: Plan ${daily_plan_id} not found in final safety check!`);
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: `Daily plan ${daily_plan_id} not found`
        });
      }
      
      console.log(`🔴 [FINAL SAFETY CHECK] About to complete plan:`, {
        id: finalSafetyCheck.id,
        day_number: finalSafetyCheck.day_number,
        source_plan_id: finalSafetyCheck.source_plan_id,
        current_is_completed: finalSafetyCheck.is_completed,
        current_completed_at: finalSafetyCheck.completed_at,
        requested_daily_plan_id: daily_plan_id,
        user_id: user_id
      });
      
      // CRITICAL IMMEDIATE HOTFIX: Check if ANY other plans from same assignment were completed in last 10 seconds
      // This prevents Day 2 from being completed when Day 1 was just completed
      if (planBeforeUpdate.source_plan_id) {
        const recentOtherCompletions = await trx('daily_training_plans')
          .where({
            user_id: user_id,
            source_plan_id: planBeforeUpdate.source_plan_id,
            is_stats_record: false
          })
          .whereNot({ id: daily_plan_id })
          .where(function() {
            this.where('is_completed', true)
              .orWhere('is_completed', 't')
              .orWhere('is_completed', 1);
          })
          .whereNotNull('completed_at')
          .where('completed_at', '>', new Date(Date.now() - 10000).toISOString())
          .count('* as count')
          .first();
        
        if (recentOtherCompletions && parseInt(recentOtherCompletions.count) > 0) {
          console.error(`❌ CRITICAL: Found ${recentOtherCompletions.count} other plan(s) from same assignment completed in last 10 seconds!`);
          console.error(`❌ This prevents completing multiple days simultaneously. Rejecting completion of plan ${daily_plan_id}.`);
          await trx.rollback();
          return res.status(400).json({
            success: false,
            message: 'Multiple days cannot be completed simultaneously. Please wait a few seconds before completing another day.',
            error: 'SIMULTANEOUS_COMPLETION_DETECTED',
            recent_completions: parseInt(recentOtherCompletions.count)
          });
        }
      }
      
      // CRITICAL: Add row-level locking to prevent concurrent modifications
      // Lock the row before updating to ensure no other transaction can modify it
      const planToUpdate = await trx('daily_training_plans')
        .where({ id: daily_plan_id })
        .forUpdate()
        .first();
      
      if (!planToUpdate) {
        console.error(`❌ CRITICAL: Plan ${daily_plan_id} not found after locking!`);
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: 'Daily plan not found'
        });
      }
      
      // CRITICAL: Verify the locked plan is still in the expected state
      if (planToUpdate.is_completed && planToUpdate.completed_at) {
        console.warn(`⚠️ Plan ${daily_plan_id} was already completed while we were locking it.`);
        await trx.rollback();
        return res.status(200).json({
          success: true,
          message: 'Plan was already completed',
          data: {
            daily_plan_id: daily_plan_id,
            day_number: planToUpdate.day_number,
            is_completed: true,
            completed_at: planToUpdate.completed_at,
            already_completed: true
          }
        });
      }
      
      // CRITICAL: Use strict WHERE clause with explicit checks to prevent affecting other days
      // Only update if the plan is NOT already completed and has NO completion timestamp
      const updateResult = await trx('daily_training_plans')
        .where({ 
          id: daily_plan_id,
          user_id: user_id,
          is_stats_record: false,
          is_completed: false,  // CRITICAL: Ensure it's not already completed
          completed_at: null    // CRITICAL: Ensure completion timestamp is not set
        })
        .update({
          is_completed: true,
          completed_at: completionTimestamp,
          updated_at: completionTimestamp
        });
      
      console.log(`📝 Update query executed - Rows affected: ${updateResult}`);
      console.log(`✅ Updated ${updateResult} row(s) - Set is_completed=true and completed_at for plan ${daily_plan_id} (Day ${planBeforeUpdate.day_number || 'N/A'})`);
      
      // CRITICAL: Verify that ONLY the intended plan was updated
      // Check if any OTHER plans were accidentally marked as completed
      const postUpdateSafetyCheck = await trx('daily_training_plans')
        .where({
          user_id: user_id,
          source_plan_id: planBeforeUpdate.source_plan_id,
          is_stats_record: false
        })
        .whereNot({ id: daily_plan_id })
        .where(function() {
          this.where('is_completed', true)
            .orWhere('is_completed', 't')
            .orWhere('is_completed', 1);
        })
        .whereNotNull('completed_at')
        .whereRaw('completed_at > NOW() - INTERVAL \'5 seconds\'') // Check for plans completed in last 5 seconds
        .select('id', 'day_number', 'is_completed', 'completed_at');
      
      if (postUpdateSafetyCheck.length > 0) {
        console.error(`❌ CRITICAL BUG DETECTED: Found ${postUpdateSafetyCheck.length} OTHER plan(s) that were completed in the last 5 seconds! This suggests Day 3 was automatically completed when Day 2 was completed.`, {
          intended_plan: {
            id: daily_plan_id,
            day_number: planBeforeUpdate.day_number
          },
          other_completed_plans: postUpdateSafetyCheck.map(p => ({
            id: p.id,
            day_number: p.day_number,
            completed_at: p.completed_at
          }))
        });
        
        // Rollback the transaction to prevent the bug
        await trx.rollback();
        return res.status(500).json({
          success: false,
          message: 'CRITICAL BUG: Multiple plans were completed simultaneously. This should not happen. Please contact support.',
          error: 'MULTIPLE_PLANS_COMPLETED',
          intended_plan: {
            id: daily_plan_id,
            day_number: planBeforeUpdate.day_number
          },
          other_completed_plans: postUpdateSafetyCheck.map(p => ({
            id: p.id,
            day_number: p.day_number
          }))
        });
      }

      // CRITICAL: Verify exactly ONE row was updated
      if (updateResult === 0) {
        console.error(`❌ CRITICAL: No rows updated for plan ${daily_plan_id}! Plan may not exist or query failed.`);
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: `Daily plan ${daily_plan_id} not found or could not be updated`
        });
      }
      
      if (updateResult > 1) {
        console.error(`❌ CRITICAL: Multiple rows (${updateResult}) updated for plan ${daily_plan_id}! This should NEVER happen. Rolling back.`);
        await trx.rollback();
        return res.status(500).json({
          success: false,
          message: `Database error: Multiple plans were updated. This is a critical bug.`
        });
      }
      
      // CRITICAL: After update, verify NO OTHER plans were accidentally updated
      // This check is now DISABLED because it was causing false positives and blocking legitimate completions
      // The original bug (Day 2 being completed when Day 1 is completed) should be prevented by:
      // 1. Using primary key (id) in WHERE clause (ensures only one plan is updated)
      // 2. Pre-update validation (verifies plan details match)
      // 3. Transaction isolation (ensures atomic updates)
      // 
      // If the bug still occurs, it's likely due to:
      // - Frontend sending wrong daily_plan_id
      // - Database trigger or constraint issue
      // - Race condition from multiple simultaneous requests
      //
      // We'll log a warning instead of blocking, to help diagnose if the bug occurs
      try {
        const postUpdateCheck = await trx('daily_training_plans')
          .where({ 
            user_id: user_id,
            source_plan_id: planBeforeUpdate.source_plan_id,
            plan_type: planBeforeUpdate.plan_type,
            is_stats_record: false
          })
          .whereNot({ id: daily_plan_id })
          .where({ is_completed: true })
          .whereNotNull('completed_at')
          .where('completed_at', '>=', new Date(completionTimestamp.getTime() - 5000).toISOString()) // Within 5 seconds
          .where('completed_at', '<=', new Date(completionTimestamp.getTime() + 5000).toISOString())
          .select('id', 'day_number', 'completed_at', 'is_completed');
        
        if (postUpdateCheck.length > 0) {
          // Log warning but don't block - this helps diagnose if the bug occurs
          console.warn(`⚠️ WARNING: Found ${postUpdateCheck.length} other plan(s) completed around the same time as plan ${daily_plan_id}. This might indicate the Day 2 bug, but we're not blocking to avoid false positives.`, {
            updated_plan_id: daily_plan_id,
            updated_day_number: planBeforeUpdate.day_number,
            other_plans: postUpdateCheck.map(p => ({
              id: p.id,
              day_number: p.day_number,
              completed_at: p.completed_at,
              is_completed: p.is_completed
            }))
          });
        }
      } catch (checkErr) {
        // Don't fail the request if this check fails
        console.error('⚠️ Error checking for other completed plans (non-critical):', checkErr);
      }

      // Verify the update immediately within the transaction
      const verifyInTransaction = await trx('daily_training_plans')
        .select('id', 'is_completed', 'completed_at', 'plan_type', 'day_number', 'source_plan_id')
        .where({ id: daily_plan_id })
        .first();

      // CRITICAL: Handle both boolean true and string 't' for is_completed (PostgreSQL can return either)
      const isVerifyCompleted = verifyInTransaction?.is_completed === true || verifyInTransaction?.is_completed === 't' || verifyInTransaction?.is_completed === 1;
      const hasVerifyCompletedAt = verifyInTransaction?.completed_at != null && verifyInTransaction?.completed_at !== 'null';

      if (!verifyInTransaction || !isVerifyCompleted || !hasVerifyCompletedAt) {
        console.error(`❌ CRITICAL: Update verification failed within transaction!`, {
          found: !!verifyInTransaction,
          is_completed: verifyInTransaction?.is_completed,
          is_completed_type: typeof verifyInTransaction?.is_completed,
          is_completed_value: verifyInTransaction?.is_completed,
          completed_at: verifyInTransaction?.completed_at,
          completed_at_type: typeof verifyInTransaction?.completed_at,
          computed_is_completed: isVerifyCompleted,
          computed_has_completed_at: hasVerifyCompletedAt
        });
        await trx.rollback();
        return res.status(500).json({
          success: false,
          message: 'Failed to verify completion status update',
          debug: {
            found: !!verifyInTransaction,
            is_completed: verifyInTransaction?.is_completed,
            completed_at: verifyInTransaction?.completed_at
          }
        });
      }

      console.log(`✅ Verified update within transaction:`, {
        id: verifyInTransaction.id,
        day_number: verifyInTransaction.day_number,
        source_plan_id: verifyInTransaction.source_plan_id,
        is_completed: verifyInTransaction.is_completed,
        completed_at: verifyInTransaction.completed_at,
        plan_type: verifyInTransaction.plan_type
      });
      
      // CRITICAL: Check if any OTHER plans were accidentally updated
      // This should never happen, but we check to catch bugs
      const otherPlansAfterUpdate = await trx('daily_training_plans')
        .where({ 
          user_id: user_id,
          source_plan_id: planBeforeUpdate.source_plan_id,
          plan_type: planBeforeUpdate.plan_type,
          is_stats_record: false
        })
        .whereNot({ id: daily_plan_id })
        .where({ is_completed: true })
        .whereNotNull('completed_at')
        .select('id', 'day_number', 'is_completed', 'completed_at')
        .orderBy('completed_at', 'desc')
        .limit(5); // Check last 5 completed plans
      
      // Check if any of these other plans were completed in the last few seconds (suspicious)
      const now = new Date();
      const suspiciousPlans = otherPlansAfterUpdate.filter(p => {
        if (!p.completed_at) return false;
        const completedAt = new Date(p.completed_at);
        const secondsDiff = (now - completedAt) / 1000;
        return secondsDiff < 5; // Completed within last 5 seconds
      });
      
      if (suspiciousPlans.length > 0) {
        console.error(`❌ CRITICAL WARNING: Found ${suspiciousPlans.length} other plan(s) completed at nearly the same time!`, {
          updated_plan_id: daily_plan_id,
          updated_day_number: verifyInTransaction.day_number,
          suspicious_plans: suspiciousPlans.map(p => ({
            id: p.id,
            day_number: p.day_number,
            completed_at: p.completed_at
          }))
        });
        // Don't rollback - the update was correct, but log the warning
        // This helps identify if the mobile app is sending multiple requests
      }

      // CRITICAL: Commit the transaction
      try {
        await trx.commit();
        commitSuccessful = true;
        
        // CRITICAL: After successful completion, create the next day if it doesn't exist
        // This ensures Day 2 appears immediately after Day 1 is completed (matching manual plan behavior)
        if (planBeforeUpdate.source_plan_id && planBeforeUpdate.day_number != null) {
          try {
            // Get the assignment to find the next day
            const assignment = await db('training_plan_assignments')
              .where({ id: planBeforeUpdate.source_plan_id })
              .orWhere({ id: planBeforeUpdate.source_plan_id.toString() })
              .first();
            
            if (assignment && assignment.daily_plans) {
              // Parse daily_plans
              let dailyPlans = null;
              try {
                dailyPlans = typeof assignment.daily_plans === 'string'
                  ? JSON.parse(assignment.daily_plans)
                  : assignment.daily_plans;
              } catch (e) {
                console.error('❌ Error parsing assignment daily_plans for next day creation:', e);
              }
              
              if (Array.isArray(dailyPlans) && dailyPlans.length > 0) {
                // Use day_number directly (no date calculation needed)
                const completedDayNumber = Number(planBeforeUpdate.day_number);
                // day_number is 1-indexed, so next day is completedDayNumber + 1
                const targetDayNumber = completedDayNumber + 1;
                // Array index is 0-indexed, so Day 1 → index 0, Day 2 → index 1, etc.
                const nextDayIndex = completedDayNumber; // Day 1 → index 0, Day 2 → index 1
                
                console.log(`📅 Auto-creating next day: completedDayNumber=${completedDayNumber}, targetDayNumber=${targetDayNumber}, nextDayIndex=${nextDayIndex}, dailyPlans.length=${dailyPlans.length}`);
                
                // Check if next day exists in daily_plans and doesn't exist in database
                if (nextDayIndex < dailyPlans.length) {
                  const nextDayPlan = dailyPlans[nextDayIndex];
                  
                  console.log(`🔍 Checking if next day exists: day_number=${targetDayNumber}, source_plan_id=${assignment.id}, user_id=${user_id}`);
                  
                  // Check if next day already exists
                  const existingNextDay = await db('daily_training_plans')
                    .where({
                      user_id: user_id,
                      source_plan_id: assignment.id.toString(),
                      day_number: targetDayNumber,
                      is_stats_record: false
                    })
                    .modify((qb) => {
                      if (assignment.gym_id != null) {
                        qb.andWhere({ gym_id: assignment.gym_id });
                      }
                    })
                    .first();
                  
                  if (existingNextDay) {
                    console.log(`✅ Next day already exists in database - plan_id: ${existingNextDay.id}, day_number: ${targetDayNumber}, is_completed: ${existingNextDay.is_completed}`);
                  } else {
                    console.log(`📝 Next day does NOT exist, creating it now - day_number: ${targetDayNumber}`);
                  }
                  
                  if (!existingNextDay) {
                    // Create the next day in the database
                    const nextDayWorkouts = nextDayPlan.workouts || nextDayPlan.exercises || [];
                    
                    try {
                      const [createdNextDay] = await db('daily_training_plans')
                        .insert({
                          user_id: user_id,
                          gym_id: assignment.gym_id,
                          day_number: targetDayNumber,
                          plan_type: 'web_assigned',
                          source_plan_id: assignment.id.toString(),
                          plan_category: assignment.category || 'General',
                          user_level: assignment.user_level || 'Beginner',
                          exercises_details: JSON.stringify(nextDayWorkouts),
                          is_completed: false,
                          completed_at: null,
                          is_stats_record: false
                        })
                        .returning('*');
                      
                      console.log(`✅ Auto-created next day (Day ${targetDayNumber}) in database after Day ${completedDayNumber} completion - plan_id: ${createdNextDay.id}`);
                    } catch (createErr) {
                      // Handle duplicate key errors gracefully
                      if (createErr.code === '23505') {
                        console.log(`⚠️ Next day already exists (duplicate key), skipping creation`);
                      } else {
                        console.error(`❌ Error auto-creating next day:`, createErr);
                      }
                    }
                  } else {
                    console.log(`✅ Next day already exists in database - plan_id: ${existingNextDay.id}, day_number: ${targetDayNumber}`);
                  }
                }
              }
            }
          } catch (nextDayErr) {
            // Don't fail the completion if next day creation fails
            console.error(`⚠️ Error creating next day after completion:`, nextDayErr);
          }
        }
        console.log(`✅ Transaction committed successfully for plan ${daily_plan_id}`);
      } catch (commitErr) {
        console.error(`❌ CRITICAL: Error committing transaction:`, commitErr);
        // Transaction is already rolled back by the database
        await trx.rollback().catch(() => {}); // Ensure rollback
        return res.status(500).json({
          success: false,
          message: 'Failed to commit completion status to database',
          error: commitErr.message
        });
      }
      
      // CRITICAL: If commit succeeded, verify the data was saved
      // IMPORTANT: Even if verification fails, if commit succeeded, the data IS in the database
      // So we should check the database one more time before returning an error
      // Note: postCommitVerification is already declared outside try block
      let verificationAttempts = 0;
      const maxVerificationAttempts = 3;
      
      while (verificationAttempts < maxVerificationAttempts && !postCommitVerification) {
        try {
          postCommitVerification = await db('daily_training_plans')
            .where({ id: daily_plan_id })
            .select('id', 'is_completed', 'completed_at', 'day_number', 'source_plan_id')
            .first();
          
          if (postCommitVerification) break;
        } catch (verifyErr) {
          console.warn(`⚠️ Verification attempt ${verificationAttempts + 1} failed:`, verifyErr.message);
        }
        
        verificationAttempts++;
        if (verificationAttempts < maxVerificationAttempts) {
          // Wait a bit before retrying (database might need a moment to commit)
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (!postCommitVerification) {
        console.error(`❌ CRITICAL: Plan ${daily_plan_id} not found after commit after ${maxVerificationAttempts} attempts!`);
        // Even though verification failed, if commit succeeded, the data might still be there
        // Return success with a warning instead of error, since commit succeeded
        console.warn(`⚠️ WARNING: Verification failed but commit succeeded. Data may still be saved.`);
        // Continue processing - don't return error if commit succeeded
      } else {
        // CRITICAL: Handle both boolean true and string 't' for is_completed (PostgreSQL can return either)
        const isPostCommitCompleted = postCommitVerification.is_completed === true || 
                                       postCommitVerification.is_completed === 't' || 
                                       postCommitVerification.is_completed === 1 ||
                                       postCommitVerification.is_completed === 'true';
        const hasPostCommitCompletedAt = postCommitVerification.completed_at != null && 
                                         postCommitVerification.completed_at !== 'null' &&
                                         postCommitVerification.completed_at !== '';
        
        if (!isPostCommitCompleted || !hasPostCommitCompletedAt) {
          console.warn(`⚠️ WARNING: Plan ${daily_plan_id} completion status may not be correctly set after commit. Attempting fix...`, {
            id: postCommitVerification.id,
            is_completed: postCommitVerification.is_completed,
            is_completed_type: typeof postCommitVerification.is_completed,
            completed_at: postCommitVerification.completed_at,
            completed_at_type: typeof postCommitVerification.completed_at,
            day_number: postCommitVerification.day_number
          });
          
          // Try to fix it one more time (outside transaction)
          try {
            const fixResult = await db('daily_training_plans')
              .where({ id: daily_plan_id, user_id: user_id })
              .update({
                is_completed: true,
                completed_at: new Date(),
                updated_at: new Date()
              });
            
            console.log(`✅ Emergency fix: Re-set completion status for plan ${daily_plan_id} (rows affected: ${fixResult})`);
            
            // Re-verify after fix
            const afterFix = await db('daily_training_plans')
              .where({ id: daily_plan_id })
              .select('is_completed', 'completed_at')
              .first();
            
            const isAfterFixCompleted = afterFix?.is_completed === true || afterFix?.is_completed === 't' || afterFix?.is_completed === 1;
            const hasAfterFixCompletedAt = afterFix?.completed_at != null && afterFix?.completed_at !== 'null';
            
            if (isAfterFixCompleted && hasAfterFixCompletedAt) {
              console.log(`✅ Emergency fix verified: Plan ${daily_plan_id} is now correctly marked as completed`);
              // Update postCommitVerification with fixed data
              postCommitVerification = afterFix;
            } else {
              console.warn(`⚠️ Emergency fix may have failed, but commit succeeded. Data may still be in database.`, {
                is_completed: afterFix?.is_completed,
                completed_at: afterFix?.completed_at
              });
              // Don't return error - commit succeeded, so data is likely saved
            }
          } catch (fixErr) {
            console.warn(`⚠️ Emergency fix failed, but commit succeeded:`, fixErr.message);
            // Don't return error - commit succeeded, so data is likely saved
          }
        } else {
          console.log(`✅ Post-commit verification passed for plan ${daily_plan_id}:`, {
            is_completed: postCommitVerification.is_completed,
            completed_at: postCommitVerification.completed_at,
            day_number: postCommitVerification.day_number
          });
        }
      }
      
      // CRITICAL: If commit succeeded, we should NOT return a 500 error
      // Even if verification fails, the data is likely in the database
      // The Flutter app should check the database if it gets a 500, but we should return success if commit succeeded
      
    } catch (updateErr) {
      console.error(`❌ CRITICAL: Error updating completion status:`, updateErr);
      // Try to rollback if transaction exists
      if (trx) {
        try {
          await trx.rollback();
          console.log(`✅ Transaction rolled back due to error`);
        } catch (rollbackErr) {
          console.error(`❌ Error during rollback:`, rollbackErr);
        }
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to update completion status',
        error: updateErr.message
      });
    }

    // Get updated plan with items
    // CRITICAL: If commit succeeded, use postCommitVerification if available, otherwise query again
    let updatedPlan = postCommitVerification || await db('daily_training_plans')
      .where({ id: daily_plan_id })
      .first();

    // IMPORTANT: Verify the update was successful
    // CRITICAL: If commit succeeded but plan not found, try one more time before returning error
    if (!updatedPlan && commitSuccessful) {
      console.warn(`⚠️ Plan ${daily_plan_id} not found immediately after commit, retrying...`);
      // Wait a moment for database consistency
      await new Promise(resolve => setTimeout(resolve, 200));
      updatedPlan = await db('daily_training_plans')
        .where({ id: daily_plan_id })
        .first();
    }

    if (!updatedPlan) {
      // Only return error if commit did NOT succeed
      if (!commitSuccessful) {
        console.error(`❌ CRITICAL: Updated plan ${daily_plan_id} not found after update!`);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve updated plan'
        });
      } else {
        // Commit succeeded but plan not found - this is unusual but data might still be there
        console.warn(`⚠️ WARNING: Plan ${daily_plan_id} not found after commit, but commit succeeded. Data may still be saved.`);
        // Continue with a minimal response
        updatedPlan = { id: daily_plan_id, is_completed: true, completed_at: new Date() };
      }
    }

    // Verify completion status
    // CRITICAL: If commit succeeded, don't return error even if verification fails
    const isCompleted = updatedPlan.is_completed === true || updatedPlan.is_completed === 't' || updatedPlan.is_completed === 1;
    const hasCompletedAt = updatedPlan.completed_at != null && updatedPlan.completed_at !== 'null' && updatedPlan.completed_at !== '';
    
    if (!isCompleted || !hasCompletedAt) {
      if (!commitSuccessful) {
        // Only return error if commit did NOT succeed
        console.error(`❌ CRITICAL: Plan ${daily_plan_id} update failed!`, {
          is_completed: updatedPlan.is_completed,
          completed_at: updatedPlan.completed_at,
          plan_type: updatedPlan.plan_type
        });
        return res.status(500).json({
          success: false,
          message: 'Failed to mark plan as completed'
        });
      } else {
        // Commit succeeded but verification failed - try to fix one more time
        console.warn(`⚠️ WARNING: Completion status verification failed, but commit succeeded. Attempting final fix...`);
        try {
          await db('daily_training_plans')
            .where({ id: daily_plan_id, user_id: user_id })
            .update({
              is_completed: true,
              completed_at: new Date(),
              updated_at: new Date()
            });
          // Re-fetch after fix
          updatedPlan = await db('daily_training_plans')
            .where({ id: daily_plan_id })
            .first() || updatedPlan;
          console.log(`✅ Final fix applied for plan ${daily_plan_id}`);
        } catch (finalFixErr) {
          console.warn(`⚠️ Final fix failed, but commit succeeded:`, finalFixErr.message);
          // Continue anyway - commit succeeded, so data is likely saved
        }
      }
    }

    console.log(`✅ Verified completion status for plan ${daily_plan_id}:`, {
      is_completed: updatedPlan.is_completed,
      completed_at: updatedPlan.completed_at,
      plan_type: updatedPlan.plan_type,
      day_number: updatedPlan.day_number
    });

    // Parse exercises_details as items (handle both array and object formats)
    let updatedItems = [];
    try {
      if (updatedPlan.exercises_details) {
        const parsed = typeof updatedPlan.exercises_details === 'string' 
          ? JSON.parse(updatedPlan.exercises_details) 
          : updatedPlan.exercises_details;
        
        // Handle different structures
        if (Array.isArray(parsed)) {
          updatedItems = parsed;
        } else if (parsed && typeof parsed === 'object') {
          // If it's an object with workouts array, use that
          if (Array.isArray(parsed.workouts)) {
            updatedItems = parsed.workouts;
          } else if (Array.isArray(parsed.exercises)) {
            updatedItems = parsed.exercises;
          } else if (Array.isArray(parsed.items)) {
            updatedItems = parsed.items;
          }
        }
      }
    } catch (e) {
      console.error('❌ Error parsing updated exercises_details:', e);
      updatedItems = [];
    }

    // Snapshot completion without dropping existing exercises_details
    // IMPORTANT: This update should NOT affect is_completed or completed_at
    try {
      const current = await db('daily_training_plans')
        .select('exercises_details', 'is_completed', 'completed_at')
        .where({ id: daily_plan_id })
        .first();
      
      // Verify completion status is still set before snapshot update
      if (!current || !current.is_completed || !current.completed_at) {
        console.error(`❌ CRITICAL: Completion status lost before snapshot update!`, {
          daily_plan_id,
          is_completed: current?.is_completed,
          completed_at: current?.completed_at
        });
      }
      
      let payload;
      try {
        const parsed = current?.exercises_details ? JSON.parse(current.exercises_details) : null;
        if (Array.isArray(parsed)) {
          payload = { workouts: parsed, snapshots: [] };
        } else if (parsed && typeof parsed === 'object') {
          payload = parsed;
          if (!Array.isArray(payload.snapshots)) payload.snapshots = [];
        } else {
          payload = { workouts: [], snapshots: [] };
        }
      } catch (e) {
        payload = { workouts: [], snapshots: [] };
      }
      payload.snapshots.push({ completed_at: new Date(), items: updatedItems });
      
      // IMPORTANT: Only update exercises_details, preserve is_completed and completed_at
      // This ensures the snapshot update doesn't accidentally reset completion status
      await db('daily_training_plans')
        .where({ id: daily_plan_id })
        .update({ 
          exercises_details: JSON.stringify(payload),
          // Explicitly preserve completion status (don't set them, just don't touch them)
        });
      
      // Verify completion status is still set after snapshot update
      const afterSnapshot = await db('daily_training_plans')
        .select('is_completed', 'completed_at', 'plan_type', 'day_number')
        .where({ id: daily_plan_id })
        .first();
      
      if (!afterSnapshot || !afterSnapshot.is_completed || !afterSnapshot.completed_at) {
        console.error(`❌ CRITICAL: Completion status lost after snapshot update!`, {
          daily_plan_id,
          is_completed: afterSnapshot?.is_completed,
          completed_at: afterSnapshot?.completed_at,
          plan_type: afterSnapshot?.plan_type
        });
        // Re-set completion status if it was lost
        await db('daily_training_plans')
          .where({ id: daily_plan_id })
          .update({
            is_completed: true,
            completed_at: new Date()
          });
        console.log(`✅ Re-set completion status for plan ${daily_plan_id} after snapshot update`);
      } else {
        console.log(`✅ Completion status preserved after snapshot update for plan ${daily_plan_id}:`, {
          is_completed: afterSnapshot.is_completed,
          completed_at: afterSnapshot.completed_at,
          plan_type: afterSnapshot.plan_type,
          day_number: afterSnapshot.day_number
        });
      }
    } catch (snapErr) {
      console.error('Failed to snapshot completion details:', snapErr);
    }

    // Emit realtime event for web portal
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`gym:${gym_id}`).emit('dailyTraining:completed', {
          daily_plan_id: daily_plan_id,
          user_id: user_id,
          day_number: updatedPlan.day_number,
          completion_data: completion_data,
          source: 'mobile_app'
        });
      }
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    // Final verification: Query the database one more time to ensure completion status is persisted
    const finalVerification = await db('daily_training_plans')
      .select('id', 'is_completed', 'completed_at', 'plan_type', 'day_number', 'source_plan_id')
      .where({ id: daily_plan_id })
      .first();
    
    if (!finalVerification || !finalVerification.is_completed || !finalVerification.completed_at) {
      console.error(`❌ CRITICAL FINAL CHECK: Plan ${daily_plan_id} completion status NOT persisted!`, {
        id: finalVerification?.id,
        is_completed: finalVerification?.is_completed,
        completed_at: finalVerification?.completed_at,
        plan_type: finalVerification?.plan_type,
        day_number: finalVerification?.day_number
      });
      
      // Try one more time to set it
      await db('daily_training_plans')
        .where({ id: daily_plan_id })
        .update({
          is_completed: true,
          completed_at: new Date()
        });
      
      console.log(`✅ Final attempt to set completion status for plan ${daily_plan_id}`);
    } else {
      console.log(`✅ FINAL VERIFICATION: Plan ${daily_plan_id} completion status confirmed in database:`, {
        is_completed: finalVerification.is_completed,
        completed_at: finalVerification.completed_at,
        plan_type: finalVerification.plan_type,
        day_number: finalVerification.day_number,
        source_plan_id: finalVerification.source_plan_id
      });
      
      // CRITICAL: Final check - verify no other plans were accidentally completed
      // Get all plans for this source_plan_id and check their completion status
      const allPlansForSource = await db('daily_training_plans')
        .where({
          user_id: user_id,
          source_plan_id: finalVerification.source_plan_id,
          plan_type: finalVerification.plan_type,
          is_stats_record: false
        })
        .select('id', 'day_number', 'is_completed', 'completed_at')
        .orderBy('day_number', 'asc');
      
      const completedPlans = allPlansForSource.filter(p => p.is_completed && p.completed_at);
      const incompletePlans = allPlansForSource.filter(p => !p.is_completed || !p.completed_at);
      
      console.log(`📊 Final check - Plans for source_plan_id ${finalVerification.source_plan_id}:`, {
        total: allPlansForSource.length,
        completed: completedPlans.length,
        incomplete: incompletePlans.length,
        completed_plan_days: completedPlans.map(p => p.day_number),
        incomplete_plan_days: incompletePlans.map(p => p.day_number)
      });
      
      // Check if multiple plans were completed at nearly the same time (suspicious)
      if (completedPlans.length > 1) {
        const recentCompletions = completedPlans
          .filter(p => {
            if (!p.completed_at) return false;
            const completedAt = new Date(p.completed_at);
            const now = new Date();
            const secondsDiff = (now - completedAt) / 1000;
            return secondsDiff < 10; // Completed within last 10 seconds
          })
          .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
        
        if (recentCompletions.length > 1) {
          console.error(`❌ CRITICAL: Multiple plans (${recentCompletions.length}) were completed within the last 10 seconds!`, {
            updated_plan_id: daily_plan_id,
            updated_day_number: finalVerification.day_number,
            all_recent_completions: recentCompletions.map(p => ({
              id: p.id,
              day_number: p.day_number,
              completed_at: p.completed_at
            }))
          });
          console.error(`⚠️ This suggests the mobile app may be sending multiple completion requests, or there's a bug causing bulk updates.`);
        }
      }
    }

    // Auto-sync user stats after completion (from daily_training_plans and daily_training_plan_items)
    // IMPORTANT: Sync stats for the specific plan_type to ensure AI plans are included
    try {
      const { updateUserStats } = require('../utils/statsCalculator');
      const planType = finalVerification?.plan_type || updatedPlan.plan_type || 'web_assigned'; // Default to web_assigned if not set
      
      console.log(`📊 Syncing stats for user ${user_id} with plan_type: ${planType}`);
      
      // Update stats for ALL plan types (this ensures all stats records are updated)
      await updateUserStats(user_id);
      
      console.log(`✅ User stats synced automatically after plan completion (plan_type: ${planType})`);
      
      // Log verification: Check if the completed plan will be found in stats
      const { getUserStats } = require('../utils/statsCalculator');
      const statsForPlanType = await getUserStats(user_id, false, planType);
      
      if (statsForPlanType && statsForPlanType.daily_workouts) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayWorkouts = statsForPlanType.daily_workouts[todayStr] || [];
        console.log(`📊 Stats verification: Today's workouts (${todayStr}) for plan_type ${planType}:`, todayWorkouts);
      } else {
        console.warn(`⚠️ Stats verification: No stats found for plan_type ${planType} after completion`);
      }
    } catch (statsErr) {
      console.error('⚠️ Failed to auto-sync user stats:', statsErr);
      // Don't fail the request if stats sync fails
    }

    res.status(200).json({
      success: true,
      message: 'Daily training completion submitted successfully',
      data: {
        daily_plan_id: daily_plan_id,
        day_number: finalVerification?.day_number || updatedPlan.day_number,
        is_completed: finalVerification?.is_completed || true,
        completed_at: finalVerification?.completed_at || updatedPlan.completed_at,
        plan_type: finalVerification?.plan_type || updatedPlan.plan_type,
        items: updatedItems
      }
    });

  } catch (err) {
    // CRITICAL: Log detailed error information to help diagnose why completions aren't being saved
    console.error('❌ CRITICAL ERROR in submitDailyCompletion:', {
      error_message: err.message,
      error_stack: err.stack,
      error_name: err.name,
      request_body: req.body,
      user_id: req.user?.id,
      daily_plan_id: req.body?.daily_plan_id,
      timestamp: new Date().toISOString()
    });
    
    // Return a proper error response instead of just calling next(err)
    // This ensures the mobile app gets a clear error message
    return res.status(500).json({
      success: false,
      message: 'Failed to submit daily training completion',
      error: err.message,
      debug: process.env.NODE_ENV === 'development' ? {
        stack: err.stack,
        name: err.name
      } : undefined
    });
  }
};

// Get user's training stats/summary
exports.getTrainingStats = async (req, res, next) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    const gym_id = req.user.gym_id;

    // Determine which user's stats to get
    let targetUserId = requestingUserId;
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      if (user_id) {
        targetUserId = Number(user_id);
      }
    }

    let query = db('daily_training_plans')
      .where({ user_id: targetUserId, gym_id: gym_id })
      .whereNotNull('day_number'); // Only include plans with day_number

    // NOTE: Date-based filtering removed - day_number is sequential and doesn't map to calendar dates
    // If date range filtering is needed, it should be implemented at the assignment level
    // by filtering assignments by date range, then getting their daily plans

    const plans = await query.orderBy('day_number', 'desc');

    // Calculate stats
    const stats = {
      total_plans: plans.length,
      completed_plans: plans.filter(p => p.is_completed).length,
      total_training_minutes: plans.reduce((sum, p) => sum + (p.training_minutes || 0), 0),
      total_exercises: plans.reduce((sum, p) => sum + (p.total_exercises || 0), 0),
      total_sets: plans.reduce((sum, p) => sum + (p.total_sets || 0), 0),
      total_reps: plans.reduce((sum, p) => sum + (p.total_reps || 0), 0),
      total_weight_kg: plans.reduce((sum, p) => sum + (Number(p.total_weight_kg) || 0), 0),
      completion_rate: plans.length > 0 ? (plans.filter(p => p.is_completed).length / plans.length * 100).toFixed(2) : 0,
      plans_by_category: {},
      plans_by_day: {} // Changed from plans_by_date to plans_by_day (grouped by day_number)
    };

    // Group by category
    plans.forEach(plan => {
      const category = plan.plan_category || 'Unknown';
      if (!stats.plans_by_category[category]) {
        stats.plans_by_category[category] = {
          total: 0,
          completed: 0,
          total_minutes: 0
        };
      }
      stats.plans_by_category[category].total++;
      if (plan.is_completed) {
        stats.plans_by_category[category].completed++;
      }
      stats.plans_by_category[category].total_minutes += plan.training_minutes || 0;
    });

    // Group by day_number
    plans.forEach(plan => {
      const dayNumber = plan.day_number;
      if (dayNumber == null) return; // Skip plans without day_number
      
      const dayKey = `Day ${dayNumber}`;
      if (!stats.plans_by_day[dayKey]) {
        stats.plans_by_day[dayKey] = {
          day_number: dayNumber,
          total: 0,
          completed: 0,
          total_minutes: 0
        };
      }
      stats.plans_by_day[dayKey].total++;
      if (plan.is_completed) {
        stats.plans_by_day[dayKey].completed++;
      }
      stats.plans_by_day[dayKey].total_minutes += plan.training_minutes || 0;
    });

    res.json({
      success: true,
      data: {
        user_id: targetUserId,
        period: {
          start_date: start_date || null,
          end_date: end_date || null
        },
        stats: stats,
        recent_plans: plans.slice(0, 10) // Last 10 plans
      }
    });

  } catch (err) {
    console.error('Error getting training stats:', err);
    next(err);
  }
};

// Create daily training plan (for admin/trainer)
exports.createDailyPlan = async (req, res, next) => {
  try {
    const {
      user_id,
      day_number,
      plan_type,
      source_plan_id,
      plan_category,
      user_level,
      exercises_details,
      items
    } = req.body;

    const gym_id = req.user.gym_id;

    // Validate required fields
    if (!user_id || day_number == null || !plan_type || !plan_category) {
      return res.status(400).json({
        success: false,
        message: 'user_id, day_number, plan_type, and plan_category are required'
      });
    }

    // Validate day_number is a positive integer
    const dayNumber = Number(day_number);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      return res.status(400).json({
        success: false,
        message: 'day_number must be a positive integer (1, 2, 3, etc.)'
      });
    }

    // Create the daily plan
    const [dailyPlan] = await db('daily_training_plans')
      .insert({
        user_id,
        gym_id,
        day_number: dayNumber,
        plan_type,
        source_plan_id,
        plan_category,
        user_level: user_level || 'Beginner',
        exercises_details: exercises_details ? JSON.stringify(exercises_details) : null
      })
      .returning('*');

    // Items are now stored in exercises_details JSON column
    // No need to insert into daily_training_plan_items table
    const planItems = items || [];

    res.status(201).json({
      success: true,
      data: { ...dailyPlan, items: planItems }
    });

  } catch (err) {
    console.error('Error creating daily training plan:', err);
    next(err);
  }
};

// Store multiple daily plans and their items from mobile payload
exports.storeDailyPlansFromMobile = async (req, res, next) => {
  try {
    const {
      plan_type = 'manual',
      user_id,
      source_plan_id,
      daily_plans = []
    } = req.body || {};

    const gym_id = req.user.gym_id ?? null;
    const targetUserId = Number(user_id || req.user.id);

    if (!targetUserId || !Array.isArray(daily_plans) || daily_plans.length === 0) {
      return res.status(400).json({ success: false, message: 'user_id and daily_plans are required' });
    }

    const created = [];
    for (let index = 0; index < daily_plans.length; index++) {
      const day = daily_plans[index];
      const {
        day_number, // Accept day_number from request if provided
        user_level = 'Beginner',
        plan_category = null,
        exercises_details = []
      } = day;

      // Calculate day_number: use provided day_number or calculate from array index (1-indexed)
      const calculatedDayNumber = day_number || (index + 1);

      // Validate exercises_details
      if (!Array.isArray(exercises_details)) {
        return res.status(400).json({ success: false, message: `exercises_details must be an array for day ${calculatedDayNumber}` });
      }

      // Compute derived totals from array to avoid client/server mismatch
      const derived = {
        total_exercises: exercises_details.length,
        training_minutes: exercises_details.reduce((s, it) => s + Number(it.training_minutes || it.minutes || 0), 0),
        total_sets: exercises_details.reduce((s, it) => s + Number(it.sets || 0), 0),
        total_reps: exercises_details.reduce((s, it) => s + Number(it.reps || 0), 0),
        total_weight_kg: exercises_details.reduce((s, it) => s + Number(it.weight_kg || 0), 0)
      };

      // Upsert daily plan by unique keys (user_id, plan_type, source_plan_id, day_number, gym_id)
      const existing = await db('daily_training_plans')
        .where({ user_id: targetUserId, plan_type, source_plan_id: source_plan_id || null, day_number: calculatedDayNumber })
        .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
        .first();

      let dailyPlan;
      if (existing) {
        const [updated] = await db('daily_training_plans')
          .where({ id: existing.id })
          .update({
            gym_id,
            plan_category,
            user_level,
            exercises_details: JSON.stringify(exercises_details),
            updated_at: new Date()
          })
          .returning('*');
        // Replace items
        // Items are now stored in exercises_details JSON column
        // No need to delete from daily_training_plan_items table
        if (exercises_details.length) {
          const itemsRows = exercises_details.map((it) => ({
            daily_plan_id: existing.id,
            exercise_name: it.exercise_name || it.workout_name || it.name || 'Exercise',
            sets: Number(it.sets || 0),
            reps: Number(it.reps || 0),
            weight_kg: Number(it.weight_kg || 0),
            weight_min_kg: it.weight_min_kg ? Number(it.weight_min_kg) : null,
            weight_max_kg: it.weight_max_kg ? Number(it.weight_max_kg) : null,
            minutes: Number(it.minutes || it.training_minutes || 0),
            exercise_type: it.exercise_type || it.exercise_types || null,
            notes: it.notes || null
          }));
          // Items are now stored in exercises_details JSON column
          // No need to insert into daily_training_plan_items table
        }
        dailyPlan = updated;
      } else {
        const [inserted] = await db('daily_training_plans')
          .insert({
            user_id: targetUserId,
            gym_id,
            day_number: calculatedDayNumber,
            plan_type,
            source_plan_id: source_plan_id || null,
          plan_category,
          user_level,
          exercises_details: JSON.stringify(exercises_details)
        })
        .returning('*');
        // Items are now stored in exercises_details JSON column
        // No need to manage daily_training_plan_items table
        dailyPlan = inserted;
      }

      created.push(dailyPlan);
    }

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Error storing daily plans from mobile:', err);
    next(err);
  }
};

// Create daily plans from training approval on-demand (for mobile app)
exports.createDailyPlansFromTrainingApproval = async (req, res, next) => {
  try {
    const { approval_id, day_number, web_plan_id, assignment_id } = req.body;
    const user_id = req.user.id;
    const gym_id = req.user.gym_id;

    // Support approval_id, web_plan_id, or assignment_id (mobile app may send any of these)
    const searchId = approval_id || web_plan_id || assignment_id;
    
    if (!searchId) {
      return res.status(400).json({
        success: false,
        message: 'approval_id, web_plan_id, or assignment_id is required'
      });
    }
    
    // day_number is required
    const targetDayNumber = day_number ? Number(day_number) : null;
    
    if (!targetDayNumber || targetDayNumber < 1) {
      return res.status(400).json({
        success: false,
        message: 'day_number is required and must be a positive integer'
      });
    }
    
    console.log('🔍 Creating daily plan from approval/assignment:', {
      searchId,
      approval_id,
      web_plan_id,
      assignment_id,
      user_id,
      day_number: targetDayNumber
    });

    // Get training approval/assignment - try multiple lookup strategies
    // PRIORITY: Check assignments FIRST since "assigned plans" come from training_plan_assignments
    let approval = null;
    
    // Strategy 1: Try to find from training_plan_assignments FIRST (for assigned plans)
    // Try by id first (assignment.id)
    let assignment = await db('training_plan_assignments')
      .where({ id: searchId, user_id: user_id })
      .first();
    
    // If not found by id, try by web_plan_id (assignment.web_plan_id)
    if (!assignment) {
      assignment = await db('training_plan_assignments')
        .where({ web_plan_id: searchId, user_id: user_id })
        .first();
    }
    
    // If we found an assignment, convert it to approval-like structure
    if (assignment) {
      // Try to find approval by matching dates and user (in case there's a linked approval)
      approval = await db('training_approvals')
        .where({ 
          user_id: user_id,
          start_date: assignment.start_date,
          end_date: assignment.end_date
        })
        .first();
      
      // If still not found, use the assignment data directly
      if (!approval) {
        // Parse exercises_details from assignment
        let items = [];
        try {
          if (assignment.exercises_details) {
            const parsed = typeof assignment.exercises_details === 'string' 
              ? JSON.parse(assignment.exercises_details) 
              : assignment.exercises_details;
            items = Array.isArray(parsed) ? parsed : [];
          }
        } catch (e) {
          console.error('Error parsing assignment exercises_details:', e);
          items = [];
        }
        
        // If no items, try to get from source training_plan
        if (items.length === 0 && assignment.web_plan_id) {
          try {
            const sourcePlan = await db('training_plans')
              .where({ id: assignment.web_plan_id })
              .first();
            
            if (sourcePlan && sourcePlan.exercises_details) {
              try {
                const parsed = typeof sourcePlan.exercises_details === 'string'
                  ? JSON.parse(sourcePlan.exercises_details)
                  : sourcePlan.exercises_details;
                items = Array.isArray(parsed) ? parsed : [];
              } catch (e) {
                console.error('Error parsing source plan exercises_details:', e);
              }
            }
          } catch (e) {
            console.error('Error fetching source plan:', e);
          }
        }
        
        // Parse daily_plans from assignment if available
        let dailyPlans = null;
        if (assignment.daily_plans) {
          try {
            dailyPlans = typeof assignment.daily_plans === 'string'
              ? JSON.parse(assignment.daily_plans)
              : assignment.daily_plans;
          } catch (_) {
            dailyPlans = null;
          }
        }
        
        // Convert assignment to approval-like structure
        approval = {
          id: assignment.id, // Use assignment id
          user_id: assignment.user_id,
          gym_id: assignment.gym_id,
          start_date: assignment.start_date,
          end_date: assignment.end_date,
          category: assignment.category,
          exercise_plan_category: assignment.category,
          user_level: assignment.user_level || 'Beginner',
          items: items,
          exercises_details: items.length > 0 ? JSON.stringify(items) : assignment.exercises_details,
          approval_status: assignment.status || 'APPROVED',
          daily_plans: dailyPlans // Use daily_plans from assignment if available
        };
      }
    }

    // Strategy 2: If not found in assignments, try training_approvals (for AI/Manual plans from mobile)
    if (!approval) {
      // Try by id in training_approvals
      approval = await db('training_approvals')
        .where({ id: searchId, user_id: user_id })
        .first();

      // Try by plan_id (which might be the web_plan_id)
      if (!approval) {
        approval = await db('training_approvals')
          .where({ plan_id: searchId, user_id: user_id })
          .first();
      }
    }

    // Strategy 3: Try without user_id filter (in case of gym assignment)
    if (!approval && !assignment) {
      // Try assignments without user filter
      assignment = await db('training_plan_assignments')
        .where({ web_plan_id: searchId })
        .orWhere({ id: searchId })
        .first();
      
      // If found assignment, convert it (same logic as Strategy 1)
      if (assignment && !approval) {
        // Parse exercises_details from assignment
        let items = [];
        try {
          if (assignment.exercises_details) {
            const parsed = typeof assignment.exercises_details === 'string'
              ? JSON.parse(assignment.exercises_details)
              : assignment.exercises_details;
            items = Array.isArray(parsed) ? parsed : [];
          }
        } catch (e) {
          console.error('Error parsing assignment exercises_details:', e);
          items = [];
        }
        
        // If no items, try to get from source training_plan
        if (items.length === 0 && assignment.web_plan_id) {
          try {
            const sourcePlan = await db('training_plans')
              .where({ id: assignment.web_plan_id })
              .first();
            
            if (sourcePlan && sourcePlan.exercises_details) {
              try {
                const parsed = typeof sourcePlan.exercises_details === 'string'
                  ? JSON.parse(sourcePlan.exercises_details)
                  : sourcePlan.exercises_details;
                items = Array.isArray(parsed) ? parsed : [];
              } catch (e) {
                console.error('Error parsing source plan exercises_details:', e);
              }
            }
          } catch (e) {
            console.error('Error fetching source plan:', e);
          }
        }
        
        // Parse daily_plans from assignment if available
        let dailyPlans = null;
        if (assignment.daily_plans) {
          try {
            dailyPlans = typeof assignment.daily_plans === 'string'
              ? JSON.parse(assignment.daily_plans)
              : assignment.daily_plans;
          } catch (_) {
            dailyPlans = null;
          }
        }
        
        approval = {
          id: assignment.id,
          user_id: assignment.user_id,
          gym_id: assignment.gym_id,
          start_date: assignment.start_date,
          end_date: assignment.end_date,
          category: assignment.category,
          exercise_plan_category: assignment.category,
          user_level: assignment.user_level || 'Beginner',
          items: items,
          exercises_details: items.length > 0 ? JSON.stringify(items) : assignment.exercises_details,
          approval_status: assignment.status || 'APPROVED',
          daily_plans: dailyPlans,
          source: 'web_assigned', // IMPORTANT: Mark as web_assigned for assignments
          plan_type: 'web_assigned' // IMPORTANT: Set plan_type for assignments
        };
      }
      
      // Try approvals without user filter
      if (!approval) {
        approval = await db('training_approvals')
          .where({ id: searchId })
          .orWhere({ plan_id: searchId })
          .first();
      }
    }

    if (!approval) {
      // Try to get available approvals and assignments for debugging
      const availableApprovals = await db('training_approvals')
        .where({ user_id: user_id })
        .select('id', 'plan_id', 'category', 'exercise_plan_category')
        .limit(10);
      
      const availableAssignments = await db('training_plan_assignments')
        .where({ user_id: user_id })
        .select('id', 'web_plan_id', 'category', 'status')
        .limit(10);
      
      console.error('❌ Training approval/assignment not found:', {
        searchId,
        approval_id,
        web_plan_id,
        user_id,
        available_approvals: availableApprovals.map(a => ({ id: a.id, plan_id: a.plan_id })),
        available_assignments: availableAssignments.map(a => ({ id: a.id, web_plan_id: a.web_plan_id }))
      });
      
      const approvalIds = availableApprovals.map(a => a.id).join(', ');
      const assignmentIds = availableAssignments.map(a => `${a.id} (web_plan_id: ${a.web_plan_id})`).join(', ');
      
      return res.status(404).json({
        success: false,
        message: `Training approval/assignment not found with id/web_plan_id: ${searchId}. Available approvals: [${approvalIds}]. Available assignments: [${assignmentIds}]`
      });
    }

    // Parse items from approval/assignment
    let items = [];
    
    // Try multiple sources for exercises
    if (approval.items) {
      try { 
        items = typeof approval.items === 'string' 
          ? JSON.parse(approval.items) 
          : approval.items;
        if (!Array.isArray(items)) items = [];
      } catch (_) { items = []; }
    }
    
    if (items.length === 0 && approval.exercises_details) {
      try { 
        items = typeof approval.exercises_details === 'string' 
          ? JSON.parse(approval.exercises_details) 
          : approval.exercises_details;
        if (!Array.isArray(items)) items = [];
      } catch (_) { items = []; }
    }

    // If still no items, try to get from daily_plans if available
    if (items.length === 0 && approval.daily_plans) {
      try {
        const dailyPlans = typeof approval.daily_plans === 'string'
          ? JSON.parse(approval.daily_plans)
          : approval.daily_plans;
        
        if (Array.isArray(dailyPlans) && dailyPlans.length > 0) {
          // Extract all exercises from all daily plans
          const allExercises = [];
          for (const dailyPlan of dailyPlans) {
            if (dailyPlan.exercises && Array.isArray(dailyPlan.exercises)) {
              allExercises.push(...dailyPlan.exercises);
            } else if (dailyPlan.workouts && Array.isArray(dailyPlan.workouts)) {
              allExercises.push(...dailyPlan.workouts);
            }
          }
          items = allExercises;
        }
      } catch (_) {
        items = [];
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      console.error('❌ No exercises found in approval/assignment:', {
        approval_id: approval.id,
        has_items: !!approval.items,
        has_exercises_details: !!approval.exercises_details,
        has_daily_plans: !!approval.daily_plans,
        approval_keys: Object.keys(approval)
      });
      
      return res.status(400).json({
        success: false,
        message: 'No exercises found in training approval/assignment. Please ensure the approval has exercises_details or items.'
      });
    }

    // Get daily_plans from approval if available
    let dailyPlansSource = null;
    if (approval.daily_plans) {
      try {
        dailyPlansSource = JSON.parse(approval.daily_plans);
      } catch (_) {}
    }

    // Use day_number (required)
    const calculatedDayNumber = targetDayNumber;
    
    // Calculate normalizedTargetDate from day_number and start_date for date range validation
    const approvalStartDate = new Date(approval.start_date);
    const targetDateObj = new Date(approvalStartDate);
    targetDateObj.setDate(approvalStartDate.getDate() + (calculatedDayNumber - 1));
    const normalizedTargetDate = normalizeDate(targetDateObj.toISOString().split('T')[0]);
    
    let exercisesForDate = [];
    
    // Check if target date is within assignment/approval date range
    const endDate = new Date(approval.end_date);
    const targetDateObjForRange = new Date(normalizedTargetDate);
    
    // Check if date is within range
    if (targetDateObjForRange < approvalStartDate || targetDateObjForRange > endDate) {
      console.warn('⚠️ Target date is outside assignment date range:', {
        targetDate: normalizedTargetDate,
        startDate: approval.start_date,
        endDate: approval.end_date
      });
    }
    
    if (Array.isArray(dailyPlansSource) && dailyPlansSource.length > 0) {
      // Find the plan by day_number (array index = day_number - 1, since day_number is 1-indexed)
      // First try to find by day_number property if it exists
      let planForDate = dailyPlansSource.find(p => p.day_number === calculatedDayNumber || p.day === calculatedDayNumber);
      
      // If not found by day_number property, use array index (day_number - 1)
      if (!planForDate) {
        const dayIndex = calculatedDayNumber - 1; // day_number is 1-indexed, arrays are 0-indexed
        if (dayIndex >= 0 && dayIndex < dailyPlansSource.length) {
          planForDate = dailyPlansSource[dayIndex];
        }
      }
      
      // Fallback: try finding by date if day_number/index lookup failed (for backward compatibility)
      if (!planForDate) {
        planForDate = dailyPlansSource.find(p => {
          const planDate = normalizeDate(p.date);
          return planDate === normalizedTargetDate;
        });
      }
      
      if (planForDate) {
        // Try different property names for exercises
        if (Array.isArray(planForDate.exercises)) {
          exercisesForDate = planForDate.exercises;
        } else if (Array.isArray(planForDate.workouts)) {
          exercisesForDate = planForDate.workouts;
        } else if (Array.isArray(planForDate.items)) {
          exercisesForDate = planForDate.items;
        }
      }
    }

    // If no plan found for date, use smart distribution
    if (exercisesForDate.length === 0) {
      const { createDistributedPlan } = require('../utils/exerciseDistribution');
      const distributed = createDistributedPlan({ items }, startDate, endDate);
      
      // Find exercises by day_number (array index = day_number - 1, since day_number is 1-indexed)
      // First try to find by day_number property if it exists
      let planForDate = distributed.daily_plans.find(p => p.day_number === calculatedDayNumber || p.day === calculatedDayNumber);
      
      // If not found by day_number property, use array index (day_number - 1)
      if (!planForDate) {
        const dayIndex = calculatedDayNumber - 1; // day_number is 1-indexed, arrays are 0-indexed
        if (dayIndex >= 0 && dayIndex < distributed.daily_plans.length) {
          planForDate = distributed.daily_plans[dayIndex];
        }
      }
      
      // Fallback: try finding by date if day_number/index lookup failed (for backward compatibility)
      if (!planForDate) {
        planForDate = distributed.daily_plans.find(p => {
          const planDate = normalizeDate(p.date);
          return planDate === normalizedTargetDate;
        });
      }
      
      if (planForDate) {
        // Try different property names for exercises (workouts is the actual property from createDistributedPlan)
        if (Array.isArray(planForDate.workouts)) {
          exercisesForDate = planForDate.workouts;
        } else if (Array.isArray(planForDate.exercises)) {
          exercisesForDate = planForDate.exercises;
        } else if (Array.isArray(planForDate.items)) {
          exercisesForDate = planForDate.items;
        }
      }
      
      // If still not found, use first day's exercises or all exercises
      if (exercisesForDate.length === 0) {
        if (distributed.daily_plans.length > 0) {
          const firstDay = distributed.daily_plans[0];
          // Check workouts first (this is what createDistributedPlan returns)
          if (Array.isArray(firstDay.workouts)) {
            exercisesForDate = firstDay.workouts;
          } else if (Array.isArray(firstDay.exercises)) {
            exercisesForDate = firstDay.exercises;
          } else if (Array.isArray(firstDay.items)) {
            exercisesForDate = firstDay.items;
          }
        }
        
        // Last resort: use all items if no daily distribution worked
        if (exercisesForDate.length === 0 && items.length > 0) {
          exercisesForDate = items;
        }
      }
    }

    if (exercisesForDate.length === 0) {
      console.error('❌ No exercises found for date:', {
        targetDate: normalizedTargetDate,
        startDate: approval.start_date,
        endDate: approval.end_date,
        itemsCount: items.length,
        dailyPlansSourceCount: dailyPlansSource ? dailyPlansSource.length : 0,
        hasDailyPlans: !!dailyPlansSource
      });
      
      return res.status(400).json({
        success: false,
        message: `No exercises found for date ${normalizedTargetDate}. Assignment date range: ${approval.start_date} to ${approval.end_date}. Items available: ${items.length}`
      });
    }

    // Use the actual approval id for source_plan_id
    const actualApprovalId = approval.id || searchId;
    
    // IMPORTANT: Determine plan_type based on the source
    // - If it's from an assignment (training_plan_assignments), use 'web_assigned'
    // - If it's from a manual plan approval (source: 'manual'), use 'manual'
    // - If it's from an AI plan approval (source: 'ai_generated'), use 'ai_generated'
    // - Default to 'web_assigned' for backward compatibility
    let determinedPlanType = 'web_assigned'; // Default
    
    // Check if this is from an assignment (not an approval)
    const isFromAssignment = assignment_id && !approval_id;
    
    if (isFromAssignment) {
      // This is definitely from an assignment, use web_assigned
      determinedPlanType = 'web_assigned';
      console.log(`📊 createDailyPlanFromApproval - Source is assignment, using plan_type: ${determinedPlanType}`);
    } else if (approval.source) {
      // Check the source field in approval
      if (approval.source === 'manual') {
        determinedPlanType = 'manual';
        console.log(`📊 createDailyPlanFromApproval - Source is manual plan, using plan_type: ${determinedPlanType}`);
      } else if (approval.source === 'ai_generated' || approval.source === 'ai') {
        determinedPlanType = 'ai_generated';
        console.log(`📊 createDailyPlanFromApproval - Source is AI plan, using plan_type: ${determinedPlanType}`);
      } else if (approval.source === 'web' || approval.source === 'web_assigned') {
        determinedPlanType = 'web_assigned';
        console.log(`📊 createDailyPlanFromApproval - Source is web assigned, using plan_type: ${determinedPlanType}`);
      }
    } else if (approval.plan_type) {
      // Fallback: check plan_type field if source is not available
      determinedPlanType = approval.plan_type;
      console.log(`📊 createDailyPlanFromApproval - Using plan_type from approval: ${determinedPlanType}`);
    }
    
    console.log(`📊 createDailyPlanFromApproval - Final determined plan_type: ${determinedPlanType} for approval/assignment ${actualApprovalId}`);
    
    // CRITICAL: Use day_number (required parameter)
    // Day 1 = start_date (dayIndex 0), Day 2 = start_date + 1 day (dayIndex 1), etc.
    
    // CRITICAL: Use day_number for query to ensure correct day matching
    // This prevents finding Day 1's plan when looking for Day 2's plan
    // IMPORTANT: Check using the unique constraint fields (user_id, day_number, plan_type, source_plan_id)
    // The unique constraint now includes source_plan_id to allow multiple plans of the same type
    // on the same day_number from different assignments
    const existing = await db('daily_training_plans')
      .where({
        user_id: user_id,
        day_number: calculatedDayNumber,
        plan_type: determinedPlanType, // Check by plan_type (part of unique constraint)
        source_plan_id: actualApprovalId, // CRITICAL: Include source_plan_id to find the correct plan
        is_stats_record: false
      })
      .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
      .first();

    let dailyPlan;
    let shouldCreateNew = false;
    
    if (existing) {
      // CRITICAL: Verify the existing plan's day_number matches the requested day_number
      // This prevents returning Day 1's plan when Day 2 is requested
      if (existing.day_number !== calculatedDayNumber) {
        console.error(`❌ CRITICAL: Existing plan ${existing.id} has day_number ${existing.day_number} but requested day_number is ${calculatedDayNumber}. This is a day mismatch - will create new plan instead.`);
        // Don't use the existing plan if day_numbers don't match - create a new one
        shouldCreateNew = true;
      } else {
        // Update existing plan (also update source_plan_id and exercises if needed)
        const [updated] = await db('daily_training_plans')
          .where({ id: existing.id })
          .update({
            exercises_details: JSON.stringify(exercisesForDate),
            plan_category: approval.exercise_plan_category || approval.category || 'General',
            user_level: approval.user_level || 'Beginner',
            source_plan_id: actualApprovalId, // Update source_plan_id to match current request
            updated_at: new Date()
          })
          .returning('*');
        dailyPlan = updated;
        console.log(`✅ Updated existing daily plan ${updated.id} (day_number: ${calculatedDayNumber}, plan_type: ${determinedPlanType})`);
      }
    }
    
    if (!existing || shouldCreateNew || !dailyPlan) {
      // Create new daily plan with day_number
      // Wrap in try-catch to handle duplicate key errors gracefully
      try {
        const [inserted] = await db('daily_training_plans')
          .insert({
            user_id: user_id,
            gym_id: gym_id,
            day_number: calculatedDayNumber,
            plan_type: determinedPlanType, // Use determined plan_type
            source_plan_id: actualApprovalId,
            plan_category: approval.exercise_plan_category || approval.category || 'General',
            user_level: approval.user_level || 'Beginner',
            exercises_details: JSON.stringify(exercisesForDate),
            is_stats_record: false
          })
          .returning('*');
        dailyPlan = inserted;
        console.log(`✅ Created daily plan ${inserted.id} (day_number: ${inserted.day_number || 'N/A'}) with plan_type: ${determinedPlanType}`);
      } catch (insertErr) {
        // Handle duplicate key constraint violation
        // The unique constraint is now: (user_id, day_number, plan_type, source_plan_id)
        // This allows multiple plans of the same type on the same day_number from different assignments
        if (insertErr.code === '23505' && insertErr.constraint === 'daily_training_plans_user_plan_unique') {
          console.log(`⚠️ Duplicate key detected - plan already exists for (user_id: ${user_id}, day_number: ${calculatedDayNumber}, plan_type: ${determinedPlanType}, source_plan_id: ${actualApprovalId}). Fetching existing plan...`);
          
          // Fetch the existing plan that caused the conflict
          // Must match all unique constraint fields including source_plan_id
          const existingPlan = await db('daily_training_plans')
            .where({
              user_id: user_id,
              day_number: calculatedDayNumber,
              plan_type: determinedPlanType,
              source_plan_id: actualApprovalId, // CRITICAL: Include source_plan_id to find the correct plan
              is_stats_record: false
            })
            .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
            .first();
          
          if (existingPlan) {
            // Update the existing plan with new data
            const [updated] = await db('daily_training_plans')
              .where({ id: existingPlan.id })
              .update({
                exercises_details: JSON.stringify(exercisesForDate),
                plan_category: approval.exercise_plan_category || approval.category || 'General',
                user_level: approval.user_level || 'Beginner',
                source_plan_id: actualApprovalId, // Update source_plan_id
                updated_at: new Date()
              })
              .returning('*');
            dailyPlan = updated;
            console.log(`✅ Updated existing daily plan ${updated.id} after duplicate key conflict (day_number: ${calculatedDayNumber}, plan_type: ${determinedPlanType})`);
          } else {
            // This shouldn't happen, but handle it gracefully
            console.error(`❌ CRITICAL: Duplicate key error but couldn't find existing plan!`, insertErr);
            throw insertErr;
          }
        } else {
          // Re-throw if it's not a duplicate key error
          throw insertErr;
        }
      }
    }
    
    // CRITICAL: Verify the returned plan's day_number matches the requested day_number
    // This is a final safety check to prevent returning the wrong plan
    const returnedDayNumber = dailyPlan.day_number != null ? Number(dailyPlan.day_number) : null;
    
    if (returnedDayNumber !== calculatedDayNumber) {
      console.error(`❌ CRITICAL ERROR: Returned plan ${dailyPlan.id} has day_number ${returnedDayNumber} but requested day_number is ${calculatedDayNumber}! This is a serious bug.`);
      return res.status(500).json({
        success: false,
        message: `Day number mismatch error: Created plan has day_number ${returnedDayNumber} but requested day_number is ${calculatedDayNumber}. Please try again.`,
        error: 'DAY_NUMBER_MISMATCH',
        requested_day_number: calculatedDayNumber,
        returned_day_number: returnedDayNumber
      });
    }
    
    console.log(`✅ Verified returned plan ${dailyPlan.id} has correct day_number: ${returnedDayNumber} (matches requested: ${calculatedDayNumber})`);

    // Parse exercises_details for response
    let exercises = [];
    try {
      exercises = dailyPlan.exercises_details ? JSON.parse(dailyPlan.exercises_details) : [];
    } catch (e) {
      exercises = [];
    }

    // Return response with explicit daily_plan_id for mobile app
    res.json({
      success: true,
      message: 'Daily plan created/retrieved successfully',
      data: {
        ...dailyPlan,
        exercises_details: exercises,
        items: exercises,
        // Explicitly include daily_plan_id for mobile app compatibility
        daily_plan_id: dailyPlan.id,
        id: dailyPlan.id,
        // Include source info for reference
        source_assignment_id: actualApprovalId,
        source_web_plan_id: approval.web_plan_id || null
      }
    });

  } catch (err) {
    console.error('Error creating daily plans from training approval:', err);
    next(err);
  }
};

// Find daily plan by source (assignment/approval) and day_number (for mobile app)
exports.findDailyPlanBySource = async (req, res, next) => {
  try {
    const { assignment_id, approval_id, web_plan_id, day_number, source_plan_id } = req.query;
    const user_id = req.user.id;
    const gym_id = req.user.gym_id;

    // Support multiple ways to find the source
    const searchId = assignment_id || approval_id || web_plan_id || source_plan_id;

    // Validate that searchId is provided
    if (!searchId) {
      return res.status(400).json({
        success: false,
        message: 'assignment_id, approval_id, web_plan_id, or source_plan_id is required'
      });
    }

    // day_number is required
    const targetDayNumber = day_number ? Number(day_number) : null;
    
    if (!targetDayNumber || targetDayNumber < 1) {
      return res.status(400).json({
        success: false,
        message: 'day_number is required and must be a positive integer'
      });
    }

    // Find daily plan by source_plan_id and day_number
    let dailyPlan = await db('daily_training_plans')
      .where({
        user_id: user_id,
        day_number: targetDayNumber,
        source_plan_id: searchId,
        is_stats_record: false
      })
      .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
      .first();

    // If not found, try to sync daily plans from manual plan (for manual plans only)
      if (!dailyPlan) {
        const manualPlan = await db('app_manual_training_plans')
          .where({ id: searchId, user_id: user_id })
          .first();

      if (manualPlan && manualPlan.daily_plans) {
            console.log(`🔄 Daily plan not found for manual plan ${searchId}, attempting to sync...`);
            try {
              const { syncDailyPlansFromManualPlanHelper } = require('./DailyTrainingController');
              await syncDailyPlansFromManualPlanHelper(manualPlan.id);
              
              // Try to find again after sync
              dailyPlan = await db('daily_training_plans')
                .where({
                  user_id: user_id,
              day_number: targetDayNumber,
                  source_plan_id: manualPlan.id.toString(),
                  plan_type: 'manual',
                  is_stats_record: false
                })
                .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
                .first();
            } catch (syncError) {
              console.error('❌ Error syncing daily plans from manual plan:', syncError);
        }
      }
    }

    if (!dailyPlan) {
      return res.status(404).json({
        success: false,
        message: `Daily plan not found for source ${searchId} on Day ${targetDayNumber}. Use /mobile/plans/create-from-approval to create it.`
      });
    }

    // If the requested day is already completed, automatically advance to the
    // next incomplete day for the same source plan. This prevents the mobile
    // app from "going back" to a previous day when it reuses an old date.
    // CRITICAL: Also respect assignment start_date - don't return plans before start_date
    if (dailyPlan.is_completed) {
      try {
        // Get assignment start_date to ensure we don't return plans before it
        let assignmentStartDate = null;
        if (dailyPlan.source_plan_id) {
          try {
            const assignment = await db('training_plan_assignments')
              .where({ id: dailyPlan.source_plan_id })
              .orWhere({ id: dailyPlan.source_plan_id.toString() })
              .first();
            
            if (assignment && assignment.start_date) {
              if (assignment.start_date instanceof Date) {
                const d = assignment.start_date;
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                assignmentStartDate = `${year}-${month}-${day}`;
              } else if (typeof assignment.start_date === 'string') {
                assignmentStartDate = assignment.start_date.split('T')[0];
              }
              console.log(`📅 Assignment ${dailyPlan.source_plan_id} start_date: ${assignmentStartDate}`);
            }
          } catch (assignmentErr) {
            console.error('⚠️ Error fetching assignment start_date:', assignmentErr);
          }
        }
        
        // CRITICAL: Find the FIRST incomplete day (not just any incomplete day after the requested date)
        // This ensures we don't "go back" to a previous day when stopping and restarting
        // We want the NEXT incomplete day after the LAST completed day, not after the requested date
        // First, find the last completed day for this assignment
        const lastCompletedPlan = await db('daily_training_plans')
          .where({
            user_id: user_id,
            is_stats_record: false,
            plan_type: dailyPlan.plan_type,
            source_plan_id: dailyPlan.source_plan_id
          })
          .where(function() {
            this.where('is_completed', true)
              .orWhere('is_completed', 't')
              .orWhere('is_completed', 1);
          })
          .whereNotNull('completed_at')
          .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
          .orderBy('day_number', 'desc')
          .first();
        
        let searchDayNumber = targetDayNumber;
        if (lastCompletedPlan && lastCompletedPlan.day_number != null) {
          // Use the last completed day's day_number as the starting point
          searchDayNumber = lastCompletedPlan.day_number;
          console.log(`📅 Found last completed day: Day ${searchDayNumber}, searching for next incomplete day after this day`);
        }
        
        let nextIncompleteQuery = db('daily_training_plans')
          .where({
            user_id: user_id,
            is_stats_record: false,
            plan_type: dailyPlan.plan_type
          })
          .andWhere('source_plan_id', dailyPlan.source_plan_id)
          .andWhere('is_completed', false)
          .andWhere('day_number', '>', searchDayNumber || 0); // Use searchDayNumber (last completed day) instead of targetDayNumber
        
        nextIncompleteQuery = nextIncompleteQuery
          .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
          .orderBy('day_number', 'asc')
          .first();
        
        const nextIncomplete = await nextIncompleteQuery;

        if (nextIncomplete) {
          console.log(`📅 Requested completed day for source ${searchId}; returning next incomplete day (Day ${nextIncomplete.day_number || 'N/A'}) instead (last completed: Day ${searchDayNumber || 'N/A'}).`);
          dailyPlan = nextIncomplete;
        } else {
          console.log(`📅 No next incomplete day found for source ${searchId} after Day ${searchDayNumber || 'N/A'}`);
        }
      } catch (advanceErr) {
        console.error('⚠️ Error finding next incomplete daily plan, falling back to requested completed day:', advanceErr);
      }
    }

    // Parse exercises_details for response
    let exercises = [];
    try {
      exercises = dailyPlan.exercises_details ? JSON.parse(dailyPlan.exercises_details) : [];
    } catch (e) {
      exercises = [];
    }

    res.json({
      success: true,
      data: {
        ...dailyPlan,
        exercises_details: exercises,
        items: exercises,
        // Explicitly include daily_plan_id for mobile app
        daily_plan_id: dailyPlan.id,
        id: dailyPlan.id
      }
    });

  } catch (err) {
    console.error('Error finding daily plan by source:', err);
    next(err);
  }
};

/**
 * Sync daily plans from training_plan_assignments to daily_training_plans
 * This function reads the daily_plans column from an assignment and creates
 * corresponding records in daily_training_plans table for assigned plans only
 * @param {number} assignmentId - Assignment ID from training_plan_assignments
 * @returns {Promise<Array>} Array of created/updated daily plans
 */
async function syncDailyPlansFromAssignmentHelper(assignmentId) {
  try {
    console.log(`🔄 Syncing daily plans from assignment ${assignmentId} at ${new Date().toISOString()}`);
    
    // Get the assignment
    const assignment = await db('training_plan_assignments')
      .where({ id: assignmentId })
      .first();
    
    if (!assignment) {
      console.error(`❌ Assignment ${assignmentId} not found`);
      return [];
    }
    
    console.log(`📋 Assignment details:`, {
      id: assignment.id,
      user_id: assignment.user_id,
      gym_id: assignment.gym_id,
      start_date: assignment.start_date,
      end_date: assignment.end_date,
      has_daily_plans: !!assignment.daily_plans,
      daily_plans_type: typeof assignment.daily_plans,
      daily_plans_length: Array.isArray(assignment.daily_plans) ? assignment.daily_plans.length : (typeof assignment.daily_plans === 'string' ? 'string' : 'null/undefined')
    });
    
    // CRITICAL: Validate and fix ALL existing plans for this assignment to ensure correct plan_type
    // This is a safety check to fix any plans that were created with wrong plan_type
    // This should not be necessary if all code paths are correct, but provides defense in depth
    const allPlansForAssignment = await db('daily_training_plans')
      .where({
        user_id: assignment.user_id,
        source_plan_id: assignment.id.toString(),
        is_stats_record: false
      })
      .select('id', 'plan_type');
    
    const plansWithWrongType = allPlansForAssignment.filter(
      p => p.plan_type !== 'web_assigned' && p.plan_type !== 'web_assigne'
    );
    
    if (plansWithWrongType.length > 0) {
      console.warn(`⚠️ Found ${plansWithWrongType.length} plan(s) with incorrect plan_type for assignment ${assignmentId}. Fixing...`);
      const fixedCount = await db('daily_training_plans')
        .whereIn('id', plansWithWrongType.map(p => p.id))
        .update({
          plan_type: 'web_assigned',
          updated_at: new Date()
        });
      console.log(`✅ Fixed ${fixedCount} plan(s) with incorrect plan_type to 'web_assigned'`);
    }
    
    // Check if assignment has daily_plans
    if (!assignment.daily_plans) {
      console.log(`⚠️ Assignment ${assignmentId} has no daily_plans data`);
      return [];
    }
    
    // Parse daily_plans
    let dailyPlans = null;
    try {
      dailyPlans = typeof assignment.daily_plans === 'string'
        ? JSON.parse(assignment.daily_plans)
        : assignment.daily_plans;
    } catch (e) {
      console.error(`❌ Error parsing daily_plans for assignment ${assignmentId}:`, e);
      return [];
    }
    
    if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) {
      console.log(`⚠️ Assignment ${assignmentId} has empty or invalid daily_plans`);
      return [];
    }
    
    console.log(`📊 Found ${dailyPlans.length} daily plans in assignment ${assignmentId}`);
    
    // IMPORTANT: Validate that we have the correct number of days
    // If a plan is for 83 days, dailyPlans array should have exactly 83 items
    // Day numbering: Day 1, Day 2, ..., Day 83 (NOT Day 0, Day 1, ..., Day 82)
    const expectedDays = dailyPlans.length;
    console.log(`📊 Expected days in plan: ${expectedDays} (Day 1 to Day ${expectedDays})`);
    
    // CRITICAL: Check if this is first creation or a sync (matching manual plan behavior)
    // Manual plans: create ALL days upfront initially, then skip completed days on sync
    // Assigned plans should do the same: create ALL days on first creation, skip completed days on sync
    // IMPORTANT: Check for ANY existing plans (completed or not) to determine if this is first creation
    const existingPlansCount = await db('daily_training_plans')
      .where({
        user_id: assignment.user_id,
        source_plan_id: assignment.id.toString(),
        is_stats_record: false
      })
      .modify((qb) => { 
        if (assignment.gym_id != null) {
          qb.andWhere({ gym_id: assignment.gym_id });
        }
      })
      .count('* as count')
      .first();
    
    const isFirstCreation = !existingPlansCount || parseInt(existingPlansCount.count) === 0;
    
    if (isFirstCreation) {
      console.log(`📅 First creation for assignment ${assignmentId} - will create ALL days (matching manual plan behavior)`);
    } else {
      console.log(`📅 Sync for assignment ${assignmentId} - found ${existingPlansCount.count} existing plan(s), will skip completed days`);
    }
    
    // IMPORTANT: Recalculate dates based on assignment's start_date FIRST
    // The daily_plans from the plan may have dates relative to the plan's start_date,
    // but we need dates relative to the assignment's start_date (which should be the same, but recalculate to be safe)
    // Parse start_date and normalize to LOCAL date-only (YYYY-MM-DD) to avoid timezone shifting backwards
   
    let startDateStr;
    if (assignment.start_date instanceof Date) {
      const d = assignment.start_date;
      const year = d.getFullYear();              // LOCAL year
      const month = String(d.getMonth() + 1).padStart(2, '0'); // LOCAL month
      const day = String(d.getDate()).padStart(2, '0');        // LOCAL day
      startDateStr = `${year}-${month}-${day}`;
    } else {
      // If it's a string from DB, it should already be in YYYY-MM-DD or ISO format
      startDateStr = assignment.start_date.split('T')[0];
    }
    
    // IMPORTANT: Check last completed day_number and start from next day (only on sync, not first creation)
    // Find the last completed daily plan for this assignment (by day_number)
    // This ensures we skip days that are already completed and start from the next day
    let lastCompletedDayNumber = null;
    if (!isFirstCreation) {
      // Only check for completed plans on sync (not first creation)
      const lastCompletedPlan = await db('daily_training_plans')
        .where({
          user_id: assignment.user_id,
          is_stats_record: false,
          is_completed: true
        })
        .whereNotNull('completed_at')
        .whereNotNull('day_number')
        .whereIn('plan_type', ['web_assigned', 'web_assigne'])
        .where(function() {
          // Match both string and integer versions of source_plan_id
          this.where('source_plan_id', assignment.id)
              .orWhere('source_plan_id', assignment.id.toString());
        })
        .modify((qb) => { 
          if (assignment.gym_id != null) {
            qb.andWhere({ gym_id: assignment.gym_id });
          }
        })
        .orderBy('day_number', 'desc')
        .first();
      
      if (lastCompletedPlan && lastCompletedPlan.day_number != null) {
        // Use day_number to determine which day was last completed
        lastCompletedDayNumber = lastCompletedPlan.day_number;
        console.log(`📅 Last completed day for assignment ${assignmentId}: Day ${lastCompletedDayNumber} (from plan ${lastCompletedPlan.id})`);
        } else {
        console.log(`📅 No completed plans found for assignment ${assignmentId}, will start from first day`);
      }
    }
    
    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
    const assignmentStartDate = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));
    
    // Parse end_date similarly (LOCAL date)
    let endDateStr;
    if (assignment.end_date instanceof Date) {
      const dEnd = assignment.end_date;
      const endYearLocal = dEnd.getFullYear();
      const endMonthLocal = String(dEnd.getMonth() + 1).padStart(2, '0');
      const endDayLocal = String(dEnd.getDate()).padStart(2, '0');
      endDateStr = `${endYearLocal}-${endMonthLocal}-${endDayLocal}`;
    } else {
      endDateStr = assignment.end_date.split('T')[0];
    }
    
    const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
    const assignmentEndDate = new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999));
    
    console.log(`📅 Assignment start_date: ${assignment.start_date}, normalized: ${assignmentStartDate.toISOString().split('T')[0]}`);
    console.log(`📅 Assignment end_date: ${assignment.end_date}, normalized: ${assignmentEndDate.toISOString().split('T')[0]}`);
    
    // CRITICAL: Fix any existing plans with wrong plan_type for this assignment
    // This ensures that plans created from assignments always have plan_type='web_assigned'
    // Fix plans that have wrong plan_type (e.g., 'manual' instead of 'web_assigned')
    const fixedPlanTypes = await db('daily_training_plans')
      .where({
        user_id: assignment.user_id,
        source_plan_id: assignment.id.toString(),
        is_stats_record: false
      })
      .whereIn('plan_type', ['manual', 'ai_generated', 'web_assigne']) // Plans with wrong plan_type
      .update({
        plan_type: 'web_assigned',
        updated_at: new Date()
      });
    
    if (fixedPlanTypes > 0) {
      console.log(`✅ Fixed ${fixedPlanTypes} daily plan(s) with wrong plan_type to 'web_assigned' for assignment ${assignmentId}`);
    }
    
    // Note: With day_number, we don't need to delete plans "before start_date" since day_number
    // is sequential and doesn't depend on dates. We only need to ensure day_number is correct.
    
    // CRITICAL: Also check if there's a plan with wrong day_number that has the wrong workout (Day 2 workout instead of Day 1)
    // This can happen if plans were created with incorrect day_number sequencing
    // We need to ensure each day_number has the correct workout from the assignment's daily_plans array
    // NOTE: This check will be done after sortedDailyPlans is defined below
    
    // IMPORTANT: We NO LONGER delete ALL existing daily plans for this assignment.
    // Deleting and recreating all days caused completed days (Day 1, Day 2, ...)
    // to be reset back to incomplete whenever the mobile app re-synced the plan.
    // 
    // Instead, we:
    // - Keep all existing daily_training_plans rows (day_number-based, no date dependencies)
    // - Skip any day whose day_number is <= lastCompletedDayNumber (already completed)
    // - Only create NEW rows for future days that don't exist yet
    // - If we update an existing future day, we preserve its completion status
    
    const createdOrUpdated = [];
    
    // CRITICAL: Use the daily_plans array AS-IS in order (index 0 = Day 1, index 1 = Day 2, etc.)
    // DO NOT sort by 'day' property - the array order IS the day order
    // This ensures Day 1 always gets the first workout set (Biceps/Chest), Day 2 gets the second (Triceps/Legs), etc.
    // Sorting by 'day' property can cause workout order to be wrong if the property doesn't match array index
    const sortedDailyPlans = [...dailyPlans]; // Use array as-is, no sorting
    
    console.log(`📊 Using ${sortedDailyPlans.length} daily plans in original array order (no sorting)`);
    console.log(`📊 First few daily plans:`, sortedDailyPlans.slice(0, 3).map((dp, idx) => ({
      array_index: idx,
      day_property: dp.day,
      date: dp.date,
      workouts: Array.isArray(dp.workouts) ? dp.workouts.length : 0,
      workout_names: Array.isArray(dp.workouts) ? dp.workouts.map(w => w.name || w.workout_name || 'Unknown').join(', ') : 'none'
    })));
    
    // IMPORTANT: Validate array length matches expected days
    if (sortedDailyPlans.length !== expectedDays) {
      console.warn(`⚠️ WARNING: sortedDailyPlans.length (${sortedDailyPlans.length}) does not match expectedDays (${expectedDays})`);
    }
    
    // Note: With day_number, we don't need to check for plans on start_date since day_number
    // is sequential and doesn't depend on dates. We just check by day_number.
    
    // Process each daily plan - recalculate dates based on assignment start_date
    // IMPORTANT: We IGNORE the dates in daily_plans and always recalculate from start_date
    // IMPORTANT: Day numbering starts from 1, not 0
    // For a plan with 83 days: Day 1, Day 2, ..., Day 83 (NOT Day 0, Day 1, ..., Day 82)
    // Loop: index 0 → Day 1, index 1 → Day 2, ..., index 82 → Day 83 (for 83-day plan)
    for (let index = 0; index < sortedDailyPlans.length; index++) {
      const dayPlan = sortedDailyPlans[index];
      try {
        // CRITICAL: Day number = array index + 1
        // index 0 = Day 1 (first workout set), index 1 = Day 2 (second workout set), etc.
        // This ensures Day 1 always gets daily_plans[0], Day 2 gets daily_plans[1], etc.
        // DO NOT use dayPlan.day property - use array index to ensure correct workout order
        const dayNumber = index + 1;
        
        // Validate: dayNumber should not exceed expectedDays
        if (dayNumber > expectedDays) {
          console.warn(`⚠️ WARNING: dayNumber ${dayNumber} exceeds expectedDays ${expectedDays}. Skipping.`);
          continue;
        }
        
        console.log(`📅 Day ${dayNumber} calculation: isFirstCreation=${isFirstCreation}, lastCompletedDayNumber=${lastCompletedDayNumber || 'none'}`);
        
        // IMPORTANT: Skip days that are already completed (matching manual plan behavior)
        // Only create/update plans for days AFTER the last completed day_number (on sync, not first creation)
        // This ensures when you stop/start, it only creates the next incomplete day
        // BUT: On first creation, create ALL days (no skip) - matching manual plan behavior
        if (!isFirstCreation && lastCompletedDayNumber != null && dayNumber <= lastCompletedDayNumber) {
          console.log(`⏭️ Skipping Day ${dayNumber} - already completed (last completed: Day ${lastCompletedDayNumber}, isFirstCreation: ${isFirstCreation})`);
          continue;
        }
        
        // CRITICAL DEBUG: Log if we're about to create Day 1, 2, or 3
        if (dayNumber <= 3) {
          console.log(`✅ Processing Day ${dayNumber} - will create/update (isFirstCreation: ${isFirstCreation}, lastCompletedDayNumber: ${lastCompletedDayNumber || 'none'})`);
        }
        
        // Extract exercises/workouts from dayPlan
        let exercises = [];
        if (Array.isArray(dayPlan.workouts)) {
          exercises = dayPlan.workouts;
        } else if (Array.isArray(dayPlan.exercises)) {
          exercises = dayPlan.exercises;
        } else if (Array.isArray(dayPlan.items)) {
          exercises = dayPlan.items;
        } else if (Array.isArray(dayPlan)) {
          // If dayPlan itself is an array, use it directly
          exercises = dayPlan;
        }
        
        // Log workout names for debugging
        const workoutNames = exercises.map(ex => ex.name || ex.workout_name || 'Unknown').join(', ');
        console.log(`📅 Day ${dayNumber} (index ${index}, original day: ${dayPlan.day || 'N/A'}): Workouts: [${workoutNames}]`);
        
        if (exercises.length === 0) {
          console.warn(`⚠️ Daily plan for Day ${dayNumber} has no exercises, skipping`);
          continue;
        }
        
        // Check if a plan already exists for this day_number (shouldn't happen after deletion, but double-check)
        // IMPORTANT: Also check for plans with wrong plan_type (e.g., 'manual' instead of 'web_assigned')
        // This fixes existing plans that were created with incorrect plan_type
        // CRITICAL: Always check for ANY plan with matching user_id, day_number, and source_plan_id
        // regardless of plan_type, to catch plans that were incorrectly created with 'manual' type
        let existingPlan = await db('daily_training_plans')
          .where({
            user_id: assignment.user_id,
            day_number: dayNumber,
            source_plan_id: assignment.id.toString(),
            is_stats_record: false
          })
          .first();
        
        // If found with wrong plan_type, log warning
        if (existingPlan && existingPlan.plan_type !== 'web_assigned' && existingPlan.plan_type !== 'web_assigne') {
          console.warn(`⚠️ Found existing plan ${existingPlan.id} with wrong plan_type '${existingPlan.plan_type}' for Day ${dayNumber} (assignment ${assignmentId}), will fix to 'web_assigned'`);
        }
        
        if (existingPlan) {
          console.warn(`⚠️ Plan already exists for Day ${dayNumber}, updating instead of creating`);
          // Update existing plan details (matching manual plan behavior)
          // Manual plans: Update exercises_details, plan_category, user_level, updated_at
          // Do NOT touch is_completed or completed_at (let them remain as-is, matching manual plan behavior)
          const [updated] = await db('daily_training_plans')
            .where({ id: existingPlan.id })
            .update({
              exercises_details: JSON.stringify(exercises),
              plan_category: assignment.category || dayPlan.category || 'General',
              user_level: assignment.user_level || dayPlan.user_level || 'Beginner',
              plan_type: 'web_assigned', // Ensure plan_type is correct for assignments
              // IMPORTANT: Do NOT update is_completed or completed_at (matching manual plan behavior)
              // These fields remain unchanged, preserving completion status naturally
              updated_at: new Date()
            })
            .returning('*');
          
          if (existingPlan.plan_type !== 'web_assigned' && existingPlan.plan_type !== 'web_assigne') {
            console.log(`✅ Fixed plan_type from '${existingPlan.plan_type}' to 'web_assigned' for plan ${updated.id}`);
          }
          
          const isCompleted = updated.is_completed === true || updated.is_completed === 't' || updated.is_completed === 1;
          console.log(`✅ Updated existing daily plan ${updated.id} for Day ${dayNumber} (workouts: [${workoutNames}], plan_type: web_assigned, is_completed: ${isCompleted})`);
          createdOrUpdated.push(updated);
        } else {
          // Always create a fresh daily plan (we deleted all existing ones above)
          // This ensures the plan starts from day 1 with no completion status
          try {
            const insertData = {
              user_id: assignment.user_id,
              gym_id: assignment.gym_id,
              day_number: dayNumber,
              plan_type: 'web_assigned',
              source_plan_id: assignment.id.toString(),
              plan_category: assignment.category || dayPlan.category || 'General',
              user_level: assignment.user_level || dayPlan.user_level || 'Beginner',
              exercises_details: JSON.stringify(exercises),
              is_completed: false,  // Always start as incomplete
              completed_at: null,   // Reset completion timestamp
              is_stats_record: false
            };
            
            console.log(`📝 Attempting to insert daily plan for Day ${dayNumber}:`, {
              user_id: insertData.user_id,
              gym_id: insertData.gym_id,
              day_number: insertData.day_number,
              plan_type: insertData.plan_type,
              source_plan_id: insertData.source_plan_id,
              exercises_count: exercises.length
            });
            
            const insertResult = await db('daily_training_plans')
              .insert(insertData)
              .returning('*');
            
            const inserted = Array.isArray(insertResult) ? insertResult[0] : insertResult;
            
            if (!inserted || !inserted.id) {
              console.error(`❌ CRITICAL: Insert query did not return a record for Day ${dayNumber}!`, {
                insertResult,
                insertData
              });
              throw new Error(`Failed to create daily plan for Day ${dayNumber} - insert returned no record`);
            }
            
            console.log(`✅ Created fresh daily plan ${inserted.id} for Day ${dayNumber} (workouts: [${workoutNames}], is_completed: false)`);
            
            // CRITICAL: Verify the plan was actually saved to the database
            const verification = await db('daily_training_plans')
              .where({ id: inserted.id })
              .first();
            
            if (!verification) {
              console.error(`❌ CRITICAL: Plan ${inserted.id} was not found in database after insert!`);
              throw new Error(`Plan ${inserted.id} was not persisted to database`);
            }
            
            createdOrUpdated.push(inserted);
          } catch (insertErr) {
            console.error(`❌ CRITICAL ERROR inserting daily plan for Day ${dayNumber}:`, {
              error_message: insertErr.message,
              error_stack: insertErr.stack,
              error_code: insertErr.code,
              error_constraint: insertErr.constraint,
              day_number: dayNumber,
              user_id: assignment.user_id,
              gym_id: assignment.gym_id,
              source_plan_id: assignment.id.toString()
            });
            // Continue with next plan instead of failing entire sync
            throw insertErr; // Re-throw to be caught by outer try-catch
          }
        }
      } catch (e) {
        // CRITICAL: Log detailed error information
        console.error(`❌ CRITICAL ERROR processing daily plan for assignment ${assignmentId}, Day ${dayNumber || 'unknown'}:`, {
          error_message: e.message,
          error_stack: e.stack,
          error_name: e.name,
          error_code: e.code,
          error_constraint: e.constraint,
          error_detail: e.detail,
          day_number: dayNumber,
          assignment_id: assignmentId,
          user_id: assignment?.user_id
        });
        
        // If it's a unique constraint violation, log it but continue
        // This might happen if the plan was already created by another process
        if (e.code === '23505' || e.constraint) {
          console.warn(`⚠️ Unique constraint violation for Day ${dayNumber} - plan may already exist. Continuing...`);
        } else {
          // For other errors, log but continue with next plan
          console.warn(`⚠️ Continuing with next plan despite error`);
        }
      }
    }
    
    console.log(`✅ Synced ${createdOrUpdated.length} daily plans from assignment ${assignmentId}`);
    console.log(`📊 Validation: Expected ${expectedDays} days, created ${createdOrUpdated.length} daily plans`);
    
    // CRITICAL: Log summary of created plans
    console.log(`📊 SYNC SUMMARY for assignment ${assignmentId}:`, {
      expected_days: expectedDays,
      created_count: createdOrUpdated.length,
      created_plan_ids: createdOrUpdated.map(p => p.id),
      created_plan_days: createdOrUpdated.map(p => p.day_number),
      first_plan: createdOrUpdated[0] ? {
        id: createdOrUpdated[0].id,
        day_number: createdOrUpdated[0].day_number,
        plan_type: createdOrUpdated[0].plan_type,
        is_completed: createdOrUpdated[0].is_completed
      } : null,
      last_plan: createdOrUpdated[createdOrUpdated.length - 1] ? {
        id: createdOrUpdated[createdOrUpdated.length - 1].id,
        day_number: createdOrUpdated[createdOrUpdated.length - 1].day_number,
        plan_type: createdOrUpdated[createdOrUpdated.length - 1].plan_type,
        is_completed: createdOrUpdated[createdOrUpdated.length - 1].is_completed
      } : null
    });
    
    // Validate that we didn't create more days than expected
    if (createdOrUpdated.length > expectedDays) {
      console.error(`❌ ERROR: Created ${createdOrUpdated.length} daily plans but expected only ${expectedDays} days!`);
    } else if (createdOrUpdated.length < expectedDays) {
      console.warn(`⚠️ WARNING: Created ${createdOrUpdated.length} daily plans but expected ${expectedDays} days. Some days may have been skipped.`);
    } else {
      console.log(`✅ SUCCESS: Created exactly ${expectedDays} daily plans (Day 1 to Day ${expectedDays})`);
    }
    
    // CRITICAL: Verify plans were actually saved by querying the database
    const verificationQuery = await db('daily_training_plans')
      .where({
        user_id: assignment.user_id,
        source_plan_id: assignment.id.toString(),
        is_stats_record: false
      })
      .select('id', 'day_number', 'plan_type', 'is_completed')
      .orderBy('day_number', 'asc');
    
    console.log(`🔍 VERIFICATION: Found ${verificationQuery.length} plans in database for assignment ${assignmentId} after sync`);
    if (verificationQuery.length !== createdOrUpdated.length) {
      console.error(`❌ CRITICAL MISMATCH: Created ${createdOrUpdated.length} plans but database has ${verificationQuery.length} plans!`);
      console.error(`❌ Database plans:`, verificationQuery.map(p => ({ id: p.id, day_number: p.day_number, plan_type: p.plan_type })));
    } else {
      console.log(`✅ VERIFICATION PASSED: Database has ${verificationQuery.length} plans matching created count`);
    }
    
    // CRITICAL: Update the daily_plans JSON in the assignment with day_number
    // Update the JSON to include day_number
    // The date field is kept for backward compatibility but day_number is the primary identifier
    try {
      const updatedDailyPlans = sortedDailyPlans.map((dayPlan, index) => {
        const dayNumber = index + 1;
        
        // Update the dayPlan object with day_number
        return {
          ...dayPlan,
          day: dayNumber,
          day_number: dayNumber,
          // Keep date for backward compatibility if it exists, but day_number is primary
          date: dayPlan.date || null
        };
      });
      
      // Update the assignment's daily_plans JSON with day_number
      await db('training_plan_assignments')
        .where({ id: assignmentId })
        .update({
          daily_plans: JSON.stringify(updatedDailyPlans),
          updated_at: new Date()
        });
      
      console.log(`✅ Updated assignment ${assignmentId} daily_plans JSON with day_number (Day 1 to Day ${updatedDailyPlans.length})`);
    } catch (updateErr) {
      console.error(`⚠️ Failed to update assignment daily_plans JSON:`, updateErr?.message || updateErr);
      // Don't fail the sync if JSON update fails
    }
    
    return createdOrUpdated;
  } catch (error) {
    console.error(`❌ Error syncing daily plans from assignment ${assignmentId}:`, error);
    throw error;
  }
}

/**
 * Sync daily plans from assignment - API endpoint
 * For assigned plans only (not manual or AI-generated)
 */
exports.syncDailyPlansFromAssignment = async (req, res, next) => {
  try {
    const { assignment_id } = req.body;
    const user_id = req.user.id;
    
    if (!assignment_id) {
      return res.status(400).json({
        success: false,
        message: 'assignment_id is required'
      });
    }
    
    // Verify assignment belongs to user (or user is admin/trainer)
    const assignment = await db('training_plan_assignments')
      .where({ id: assignment_id })
      .first();
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }
    
    // Check permissions (user can only sync their own assignments, unless admin/trainer)
    if (req.user.role !== 'gym_admin' && req.user.role !== 'trainer' && assignment.user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to sync this assignment'
      });
    }
    
    const dailyPlans = await syncDailyPlansFromAssignmentHelper(assignment_id);
    
    res.json({
      success: true,
      message: `Synced ${dailyPlans.length} daily plans from assignment`,
      data: dailyPlans
    });
  } catch (err) {
    console.error('Error syncing daily plans from assignment:', err);
    next(err);
  }
};

/**
 * Sync daily plans from manual training plan
 * Reads daily_plans from app_manual_training_plans and creates/updates entries in daily_training_plans
 * @param {number} manualPlanId - ID of the manual training plan
 * @returns {Promise<Array>} Array of created/updated daily plans
 */
async function syncDailyPlansFromManualPlanHelper(manualPlanId) {
  try {
    console.log(`🔄 Syncing daily plans from manual plan ${manualPlanId}`);
    
    // Get the manual plan
    const manualPlan = await db('app_manual_training_plans')
      .where({ id: manualPlanId })
      .first();
    
    if (!manualPlan) {
      console.error(`❌ Manual plan ${manualPlanId} not found`);
      return [];
    }
    
    // Check if manual plan has daily_plans
    let dailyPlans = null;
    if (manualPlan.daily_plans) {
      try {
        dailyPlans = typeof manualPlan.daily_plans === 'string'
          ? JSON.parse(manualPlan.daily_plans)
          : manualPlan.daily_plans;
      } catch (e) {
        console.error(`❌ Error parsing daily_plans for manual plan ${manualPlanId}:`, e);
      }
    }
    
    // If no daily_plans, try to generate from items using distribution logic
    if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) {
      console.log(`⚠️ Manual plan ${manualPlanId} has no daily_plans, generating from items...`);
      
      // Get plan items
      const planItems = await db('app_manual_training_plan_items')
        .where({ plan_id: manualPlanId })
        .orderBy('id', 'asc');
      
      if (planItems.length === 0) {
        console.log(`⚠️ Manual plan ${manualPlanId} has no items to distribute`);
        return [];
      }
      
      // Convert items to format expected by distribution
      const items = planItems.map(item => ({
        workout_name: item.workout_name,
        sets: item.sets,
        reps: item.reps,
        weight_kg: item.weight_kg,
        weight_min_kg: item.weight_min_kg,
        weight_max_kg: item.weight_max_kg,
        minutes: item.minutes,
        exercise_types: item.exercise_types,
        user_level: item.user_level
      }));
      
      // Generate daily plans using distribution logic
      const { createDistributedPlan } = require('../utils/exerciseDistribution');
      const distributedPlan = createDistributedPlan(
        { items },
        new Date(manualPlan.start_date),
        new Date(manualPlan.end_date)
      );
      dailyPlans = distributedPlan.daily_plans;
      
      // Save generated daily_plans back to manual plan for future use
      if (Array.isArray(dailyPlans) && dailyPlans.length > 0) {
        await db('app_manual_training_plans')
          .where({ id: manualPlanId })
          .update({ daily_plans: JSON.stringify(dailyPlans) });
        console.log(`✅ Generated and saved ${dailyPlans.length} daily plans to manual plan ${manualPlanId}`);
      }
    }
    
    if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) {
      console.log(`⚠️ Manual plan ${manualPlanId} has empty or invalid daily_plans`);
      return [];
    }
    
    console.log(`📊 Found ${dailyPlans.length} daily plans in manual plan ${manualPlanId}`);
    
    // IMPORTANT: Check last completed day_number and start from next day
    // Find the last completed daily plan for this manual plan (by day_number, not completed_at)
    // This ensures we skip days that are already completed and start from the next day
    const lastCompletedPlan = await db('daily_training_plans')
      .where({
        user_id: manualPlan.user_id,
        source_plan_id: manualPlan.id.toString(),
        plan_type: 'manual',
        is_stats_record: false,
        is_completed: true
      })
      .whereNotNull('completed_at')
      .whereNotNull('day_number')
      .modify((qb) => { 
        if (manualPlan.gym_id != null) {
          qb.andWhere({ gym_id: manualPlan.gym_id });
        }
      })
      .orderBy('day_number', 'desc')
      .first();
    
    let lastCompletedDayNumber = null;
    if (lastCompletedPlan && lastCompletedPlan.day_number != null) {
      // Use day_number to determine which day was last completed
      lastCompletedDayNumber = lastCompletedPlan.day_number;
      console.log(`📅 Last completed day for manual plan ${manualPlanId}: Day ${lastCompletedDayNumber} (from plan ${lastCompletedPlan.id}), will start from next day`);
    } else {
      console.log(`📅 No completed plans found for manual plan ${manualPlanId}, will start from first day`);
    }
    
    const createdOrUpdated = [];
    
    // Process each daily plan (day_number is 1-indexed based on array position)
    for (let index = 0; index < dailyPlans.length; index++) {
      const dayPlan = dailyPlans[index];
      const dayNumber = index + 1; // Day 1, Day 2, etc.
      
      try {
        // Extract exercises/workouts from dayPlan
        let exercises = [];
        if (Array.isArray(dayPlan.workouts)) {
          exercises = dayPlan.workouts;
        } else if (Array.isArray(dayPlan.exercises)) {
          exercises = dayPlan.exercises;
        } else if (Array.isArray(dayPlan.items)) {
          exercises = dayPlan.items;
        } else if (Array.isArray(dayPlan)) {
          exercises = dayPlan;
        }
        
        if (exercises.length === 0) {
          console.warn(`⚠️ Daily plan for Day ${dayNumber} has no exercises, skipping`);
          continue;
        }
        
        // IMPORTANT: Skip days that are already completed (before or on lastCompletedDayNumber)
        // Only create/update plans for days AFTER the last completed day_number
        if (lastCompletedDayNumber != null && dayNumber <= lastCompletedDayNumber) {
          console.log(`⏭️ Skipping Day ${dayNumber} - already completed (last completed: Day ${lastCompletedDayNumber})`);
          continue;
        }
        
        // Check if daily plan already exists
        const existing = await db('daily_training_plans')
          .where({
            user_id: manualPlan.user_id,
            day_number: dayNumber,
            source_plan_id: manualPlan.id.toString(),
            plan_type: 'manual',
            is_stats_record: false
          })
          .modify((qb) => { 
            if (manualPlan.gym_id != null) {
              qb.andWhere({ gym_id: manualPlan.gym_id });
            }
          })
          .first();
        
        let dailyPlan;
        if (existing) {
          // Update existing plan with latest data from manual plan
          const [updated] = await db('daily_training_plans')
            .where({ id: existing.id })
            .update({
              exercises_details: JSON.stringify(exercises),
              plan_category: manualPlan.exercise_plan_category || dayPlan.category || 'General',
              user_level: dayPlan.user_level || manualPlan.user_level || 'Beginner',
              updated_at: new Date()
            })
            .returning('*');
          dailyPlan = updated;
          console.log(`✅ Updated daily plan ${existing.id} for Day ${dayNumber}`);
        } else {
          // Create new daily plan
          // Wrap in try-catch to handle duplicate key errors gracefully
          try {
            const [inserted] = await db('daily_training_plans')
              .insert({
                user_id: manualPlan.user_id,
                gym_id: manualPlan.gym_id,
                day_number: dayNumber,
                plan_type: 'manual',
                source_plan_id: manualPlan.id.toString(),
                plan_category: manualPlan.exercise_plan_category || dayPlan.category || 'General',
                user_level: dayPlan.user_level || manualPlan.user_level || 'Beginner',
                exercises_details: JSON.stringify(exercises),
                is_stats_record: false
              })
              .returning('*');
            dailyPlan = inserted;
            console.log(`✅ Created daily plan ${inserted.id} (Day ${inserted.day_number || 'N/A'})`);
          } catch (insertErr) {
            // Handle duplicate key constraint violation
            // The unique constraint is: (user_id, day_number, plan_type, source_plan_id)
            if (insertErr.code === '23505' && insertErr.constraint === 'daily_training_plans_user_plan_unique') {
              console.log(`⚠️ Duplicate key detected - plan already exists for manual plan (user_id: ${manualPlan.user_id}, day_number: ${dayNumber}, plan_type: manual, source_plan_id: ${manualPlan.id}). Fetching existing plan...`);
              
              // Fetch the existing plan that caused the conflict
              const existingPlan = await db('daily_training_plans')
                .where({
                  user_id: manualPlan.user_id,
                  day_number: dayNumber,
                  plan_type: 'manual',
                  source_plan_id: manualPlan.id.toString(),
                  is_stats_record: false
                })
                .modify((qb) => { 
                  if (manualPlan.gym_id != null) {
                    qb.andWhere({ gym_id: manualPlan.gym_id });
                  }
                })
                .first();
              
              if (existingPlan) {
                // Update the existing plan with new data
                const [updated] = await db('daily_training_plans')
                  .where({ id: existingPlan.id })
                  .update({
                    exercises_details: JSON.stringify(exercises),
                    plan_category: manualPlan.exercise_plan_category || dayPlan.category || 'General',
                    user_level: dayPlan.user_level || manualPlan.user_level || 'Beginner',
                    updated_at: new Date()
                  })
                  .returning('*');
                dailyPlan = updated;
                console.log(`✅ Updated existing daily plan ${updated.id} after duplicate key conflict (day_number: ${dayNumber}, plan_type: manual)`);
              } else {
                // This shouldn't happen, but handle it gracefully
                console.error(`❌ CRITICAL: Duplicate key error but couldn't find existing plan!`, insertErr);
                throw insertErr;
              }
            } else {
              // Re-throw if it's not a duplicate key error
              throw insertErr;
            }
          }
        }
        
        createdOrUpdated.push(dailyPlan);
      } catch (e) {
        console.error(`❌ Error processing daily plan for manual plan ${manualPlanId}:`, e);
        // Continue with next plan
      }
    }
    
    console.log(`✅ Synced ${createdOrUpdated.length} daily plans from manual plan ${manualPlanId}`);
    return createdOrUpdated;
  } catch (error) {
    console.error(`❌ Error syncing daily plans from manual plan ${manualPlanId}:`, error);
    throw error;
  }
}

/**
 * Sync daily plans from AI generated plan
 * Reads exercises_details from app_ai_generated_plans, generates daily_plans using distribution, and creates/updates entries in daily_training_plans
 * @param {number} aiPlanId - ID of the AI generated plan
 * @returns {Promise<Array>} Array of created/updated daily plans
 */
async function syncDailyPlansFromAIPlanHelper(aiPlanId) {
  try {
    console.log(`🔄 Syncing daily plans from AI plan ${aiPlanId}`);
    
    // Get the AI plan
    const aiPlan = await db('app_ai_generated_plans')
      .where({ id: aiPlanId })
      .first();
    
    if (!aiPlan) {
      console.error(`❌ AI plan ${aiPlanId} not found`);
      return [];
    }
    
    // Check if AI plan has daily_plans column (preferred source)
    let dailyPlans = null;
    if (aiPlan.daily_plans) {
      try {
        dailyPlans = typeof aiPlan.daily_plans === 'string'
          ? JSON.parse(aiPlan.daily_plans)
          : aiPlan.daily_plans;
      } catch (e) {
        console.error(`❌ Error parsing daily_plans for AI plan ${aiPlanId}:`, e);
      }
    }
    
    // If no daily_plans, try to generate from items using distribution logic
    if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) {
      console.log(`⚠️ AI plan ${aiPlanId} has no daily_plans, generating from items...`);
      
      // Get plan items
      let items = [];
      
      // First, try to get items from exercises_details JSON column
      if (aiPlan.exercises_details) {
        try {
          const exercisesDetails = typeof aiPlan.exercises_details === 'string'
            ? JSON.parse(aiPlan.exercises_details)
            : aiPlan.exercises_details;
          
          if (Array.isArray(exercisesDetails)) {
            items = exercisesDetails;
          }
        } catch (e) {
          console.warn(`⚠️ Error parsing exercises_details for AI plan ${aiPlanId}:`, e);
        }
      }
      
      // If no items from exercises_details, get from plan_items table
      if (items.length === 0) {
        const planItems = await db('app_ai_generated_plan_items')
          .where({ plan_id: aiPlanId })
          .orderBy('id', 'asc');
        
        items = planItems.map(item => ({
          workout_name: item.workout_name,
          sets: item.sets,
          reps: item.reps,
          weight_kg: item.weight_kg,
          weight_min_kg: item.weight_min_kg,
          weight_max_kg: item.weight_max_kg,
          minutes: item.minutes,
          exercise_types: item.exercise_types,
          user_level: item.user_level || aiPlan.user_level
        }));
      }
      
      if (items.length === 0) {
        console.log(`⚠️ AI plan ${aiPlanId} has no items to distribute`);
        return [];
      }
      
      // Generate daily plans using distribution logic
      const { createDistributedPlan } = require('../utils/exerciseDistribution');
      const distributedPlan = createDistributedPlan(
        { items },
        new Date(aiPlan.start_date),
        new Date(aiPlan.end_date)
      );
      dailyPlans = distributedPlan.daily_plans;
      
      // Save generated daily_plans back to AI plan for future use
      if (Array.isArray(dailyPlans) && dailyPlans.length > 0) {
        await db('app_ai_generated_plans')
          .where({ id: aiPlanId })
          .update({ daily_plans: JSON.stringify(dailyPlans) });
        console.log(`✅ Generated and saved ${dailyPlans.length} daily plans to AI plan ${aiPlanId}`);
      }
    }
    
    if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) {
      console.log(`⚠️ AI plan ${aiPlanId} has empty or invalid daily_plans`);
      return [];
    }
    
    console.log(`📊 Found ${dailyPlans.length} daily plans in AI plan ${aiPlanId}`);
    
    const createdOrUpdated = [];
    
    // Process each daily plan (day_number is 1-indexed based on array position)
    for (let index = 0; index < dailyPlans.length; index++) {
      const dayPlan = dailyPlans[index];
      const dayNumber = index + 1; // Day 1, Day 2, etc.
      
      try {
        // Extract exercises/workouts from dayPlan
        let exercises = [];
        if (Array.isArray(dayPlan.workouts)) {
          exercises = dayPlan.workouts;
        } else if (Array.isArray(dayPlan.exercises)) {
          exercises = dayPlan.exercises;
        } else if (Array.isArray(dayPlan.items)) {
          exercises = dayPlan.items;
        } else if (Array.isArray(dayPlan)) {
          exercises = dayPlan;
        }
        
        if (exercises.length === 0) {
          console.warn(`⚠️ Daily plan for Day ${dayNumber} has no exercises, skipping`);
          continue;
        }
        
        // Check if daily plan already exists
        const existing = await db('daily_training_plans')
          .where({
            user_id: aiPlan.user_id,
            day_number: dayNumber,
            source_plan_id: aiPlan.id.toString(),
            plan_type: 'ai_generated',
            is_stats_record: false
          })
          .modify((qb) => { 
            if (aiPlan.gym_id != null) {
              qb.andWhere({ gym_id: aiPlan.gym_id });
            }
          })
          .first();
        
        let dailyPlan;
        if (existing) {
          // Update existing plan with latest data from AI plan
          const [updated] = await db('daily_training_plans')
            .where({ id: existing.id })
            .update({
              exercises_details: JSON.stringify(exercises),
              plan_category: aiPlan.exercise_plan_category || dayPlan.category || 'General',
              user_level: dayPlan.user_level || aiPlan.user_level || 'Beginner',
              updated_at: new Date()
            })
            .returning('*');
          dailyPlan = updated;
          console.log(`✅ Updated daily plan ${existing.id} for Day ${dayNumber}`);
        } else {
          // Create new daily plan
          // Wrap in try-catch to handle duplicate key errors gracefully
          try {
            const [inserted] = await db('daily_training_plans')
              .insert({
                user_id: aiPlan.user_id,
                gym_id: aiPlan.gym_id,
                day_number: dayNumber,
                plan_type: 'ai_generated',
                source_plan_id: aiPlan.id.toString(),
                plan_category: aiPlan.exercise_plan_category || dayPlan.category || 'General',
                user_level: dayPlan.user_level || aiPlan.user_level || 'Beginner',
                exercises_details: JSON.stringify(exercises),
                is_stats_record: false
              })
              .returning('*');
            dailyPlan = inserted;
            console.log(`✅ Created daily plan ${inserted.id} (Day ${inserted.day_number || 'N/A'})`);
          } catch (insertErr) {
            // Handle duplicate key constraint violation
            // The unique constraint is: (user_id, day_number, plan_type, source_plan_id)
            if (insertErr.code === '23505' && insertErr.constraint === 'daily_training_plans_user_plan_unique') {
              console.log(`⚠️ Duplicate key detected - plan already exists for AI plan (user_id: ${aiPlan.user_id}, day_number: ${dayNumber}, plan_type: ai_generated, source_plan_id: ${aiPlan.id}). Fetching existing plan...`);
              
              // Fetch the existing plan that caused the conflict
              const existingPlan = await db('daily_training_plans')
                .where({
                  user_id: aiPlan.user_id,
                  day_number: dayNumber,
                  plan_type: 'ai_generated',
                  source_plan_id: aiPlan.id.toString(),
                  is_stats_record: false
                })
                .modify((qb) => { 
                  if (aiPlan.gym_id != null) {
                    qb.andWhere({ gym_id: aiPlan.gym_id });
                  }
                })
                .first();
              
              if (existingPlan) {
                // Update the existing plan with new data
                const [updated] = await db('daily_training_plans')
                  .where({ id: existingPlan.id })
                  .update({
                    exercises_details: JSON.stringify(exercises),
                    plan_category: aiPlan.exercise_plan_category || dayPlan.category || 'General',
                    user_level: dayPlan.user_level || aiPlan.user_level || 'Beginner',
                    updated_at: new Date()
                  })
                  .returning('*');
                dailyPlan = updated;
                console.log(`✅ Updated existing daily plan ${updated.id} after duplicate key conflict (day_number: ${dayNumber}, plan_type: ai_generated)`);
              } else {
                // This shouldn't happen, but handle it gracefully
                console.error(`❌ CRITICAL: Duplicate key error but couldn't find existing plan!`, insertErr);
                throw insertErr;
              }
            } else {
              // Re-throw if it's not a duplicate key error
              throw insertErr;
            }
          }
        }
        
        createdOrUpdated.push(dailyPlan);
      } catch (e) {
        console.error(`❌ Error processing daily plan for AI plan ${aiPlanId}:`, e);
        // Continue with next plan
      }
    }
    
    console.log(`✅ Synced ${createdOrUpdated.length} daily plans from AI plan ${aiPlanId}`);
    return createdOrUpdated;
  } catch (error) {
    console.error(`❌ Error syncing daily plans from AI plan ${aiPlanId}:`, error);
    throw error;
  }
}

/**
 * Sync daily plans from manual plan - API endpoint
 * For manual plans only
 */
exports.syncDailyPlansFromManualPlan = async (req, res, next) => {
  try {
    const { manual_plan_id } = req.body;
    const user_id = req.user.id;
    
    if (!manual_plan_id) {
      return res.status(400).json({
        success: false,
        message: 'manual_plan_id is required'
      });
    }
    
    // Verify manual plan belongs to user (or user is admin/trainer)
    const manualPlan = await db('app_manual_training_plans')
      .where({ id: manual_plan_id })
      .first();
    
    if (!manualPlan) {
      return res.status(404).json({
        success: false,
        message: 'Manual plan not found'
      });
    }
    
    // Check permissions (user can only sync their own plans, unless admin/trainer)
    if (req.user.role !== 'gym_admin' && req.user.role !== 'trainer' && manualPlan.user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to sync this plan'
      });
    }
    
    const dailyPlans = await syncDailyPlansFromManualPlanHelper(manual_plan_id);
    
    res.json({
      success: true,
      message: `Synced ${dailyPlans.length} daily plans from manual plan`,
      data: dailyPlans
    });
  } catch (err) {
    console.error('Error syncing daily plans from manual plan:', err);
    next(err);
  }
};

/**
 * Sync daily plans from AI plan - API endpoint
 * For AI generated plans only
 */
exports.syncDailyPlansFromAIPlan = async (req, res, next) => {
  try {
    const { ai_plan_id } = req.body;
    const user_id = req.user.id;
    
    if (!ai_plan_id) {
      return res.status(400).json({
        success: false,
        message: 'ai_plan_id is required'
      });
    }
    
    // Verify AI plan belongs to user (or user is admin/trainer)
    const aiPlan = await db('app_ai_generated_plans')
      .where({ id: ai_plan_id })
      .first();
    
    if (!aiPlan) {
      return res.status(404).json({
        success: false,
        message: 'AI plan not found'
      });
    }
    
    // Check permissions (user can only sync their own plans, unless admin/trainer)
    if (req.user.role !== 'gym_admin' && req.user.role !== 'trainer' && aiPlan.user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to sync this plan'
      });
    }
    
    const dailyPlans = await syncDailyPlansFromAIPlanHelper(ai_plan_id);
    
    res.json({
      success: true,
      message: `Synced ${dailyPlans.length} daily plans from AI plan`,
      data: dailyPlans
    });
  } catch (err) {
    console.error('Error syncing daily plans from AI plan:', err);
    next(err);
  }
};

// Export the helper functions for use in other controllers
exports.syncDailyPlansFromAssignmentHelper = syncDailyPlansFromAssignmentHelper;
exports.syncDailyPlansFromManualPlanHelper = syncDailyPlansFromManualPlanHelper;
exports.syncDailyPlansFromAIPlanHelper = syncDailyPlansFromAIPlanHelper;

// Override: day_number-only getDailyPlans (assigned/manual/ai)
exports.getDailyPlans = async (req, res, next) => {
  try {
    const { user_id, day_number, plan_type, include_completed } = req.query;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    const gym_id = req.user.gym_id;
    const isMobileRequest = req.originalUrl?.includes('/mobile/') || requestingUserRole === 'USER';
    const shouldIncludeCompleted = include_completed === 'true' || include_completed === true;

    let query = db('daily_training_plans')
      .select('*')
      .where('is_stats_record', false)
      .orderBy('day_number', 'asc');

    // Role-based scoping
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      if (user_id) query = query.where({ user_id: Number(user_id) });
      if (gym_id != null) query = query.andWhere({ gym_id });
    } else {
      query = query.where({ user_id: requestingUserId, is_stats_record: false });
      if (!plan_type) {
        query = query.whereIn('plan_type', ['web_assigned', 'web_assigne']);
      }
    }

    // Optional day filter for non-mobile contexts
    const targetDayNumber = day_number ? Number(day_number) : null;
    if (targetDayNumber && !isMobileRequest) {
      query = query.andWhere('day_number', targetDayNumber);
    }

    // plan_type filter
    if (plan_type && (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer')) {
      if (plan_type === 'web_assigned') {
        query = query.whereIn('plan_type', ['web_assigned', 'web_assigne']);
      } else {
        query = query.andWhere('plan_type', plan_type);
      }
    } else if (plan_type && requestingUserRole !== 'gym_admin' && requestingUserRole !== 'trainer') {
      if (plan_type === 'web_assigned') {
        query = query.whereIn('plan_type', ['web_assigned', 'web_assigne']);
      } else {
        query = query.andWhere('plan_type', plan_type);
      }
    }

    let plans = await query;

    // Map assignment_id helper
    plans.forEach(plan => {
      if (plan.source_plan_id != null) {
        const asn = Number(plan.source_plan_id);
        plan.assignment_id = Number.isNaN(asn) ? null : asn;
      }
    });

    // Per-source filtering to start at next incomplete day unless include_completed=true
    if (!shouldIncludeCompleted) {
      const bySource = {};
      plans.forEach(p => {
        const key = p.source_plan_id || 'no_source';
        if (!bySource[key]) bySource[key] = [];
        bySource[key].push(p);
      });

      const filtered = [];
      Object.values(bySource).forEach(list => {
        const sourcePlans = list.filter(p => p.day_number != null).sort((a, b) => (a.day_number || 0) - (b.day_number || 0));
        const nextIncomplete = sourcePlans.find(p => {
          const isCompleted = p.is_completed === true ||
                              p.is_completed === 't' ||
                              p.is_completed === 1 ||
                              p.is_completed === 'true' ||
                              String(p.is_completed).toLowerCase() === 'true';
          const hasCompletedAt = p.completed_at != null &&
                                 p.completed_at !== 'null' &&
                                 p.completed_at !== '' &&
                                 String(p.completed_at).trim() !== '';
          return !(isCompleted && hasCompletedAt);
        });

        if (nextIncomplete) {
          const cutoff = nextIncomplete.day_number;
          filtered.push(...sourcePlans.filter(p => (p.day_number || 0) >= cutoff));
        } else if (sourcePlans.length > 0) {
          filtered.push(sourcePlans[sourcePlans.length - 1]);
        }
      });

      plans = filtered;
    }

    // Normalize exercises_details JSON
    for (const plan of plans) {
      try {
        const raw = plan.exercises_details;
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed)) {
            plan.exercises_details = parsed;
          } else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.workouts)) {
              plan.exercises_details = parsed.workouts;
              if (Array.isArray(parsed.snapshots)) plan.completion_snapshots = parsed.snapshots;
            } else if (Array.isArray(parsed.exercises)) {
              plan.exercises_details = parsed.exercises;
            } else if (Array.isArray(parsed.items)) {
              plan.exercises_details = parsed.items;
            }
          }
        }
      } catch (e) {
        console.error('Error parsing exercises_details for response:', e);
      }
      plan.daily_plan_id = plan.id;
    }

    // Stable ordering
    plans.sort((a, b) => {
      const sa = a.source_plan_id || 0;
      const sb = b.source_plan_id || 0;
      if (sa !== sb) return sa - sb;
      return (a.day_number || 0) - (b.day_number || 0);
    });

    res.json({ success: true, data: plans });
  } catch (err) {
    console.error('Error getting daily training plans (day_number override):', err);
    next(err);
  }
};

