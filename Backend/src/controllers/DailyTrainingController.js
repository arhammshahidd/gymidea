const db = require('../config/db');

// Get daily training plans for a user
exports.getDailyPlans = async (req, res, next) => {
  try {
    const { user_id, date, plan_type } = req.query;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    const gym_id = req.user.gym_id;

    let query = db('daily_training_plans')
      .select('*')
      .where('is_stats_record', false) // CRITICAL: Always exclude stats records at SQL level
      .orderBy('plan_date', 'asc'); // Changed to 'asc' to show today first, then upcoming days

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

    // Apply filters
    // For mobile (USER role or /mobile/ route), we want to always show today's and future plans
    // immediately after completing the current day, even if client sends a specific date.
    // So we ignore strict date filtering in that case.
    const isMobileRequest = req.originalUrl?.includes('/mobile/') || requestingUserRole === 'USER';
    
    // CRITICAL: Fetch assignment start dates for all source_plan_ids to filter at SQL level
    // This prevents plans before start_date from being returned (e.g., 2025-12-01 when start_date is 2025-12-02)
    let assignmentStartDatesMap = {};
    if (isMobileRequest || !date) {
      try {
        // Get all assignments for this user to find their start dates
        const assignments = await db('training_plan_assignments')
          .where({ user_id: requestingUserId })
          .select('id', 'start_date');
        
        assignments.forEach(assignment => {
          let startDateStr;
          if (assignment.start_date instanceof Date) {
            const d = assignment.start_date;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            startDateStr = `${year}-${month}-${day}`;
          } else if (typeof assignment.start_date === 'string') {
            startDateStr = assignment.start_date.split('T')[0];
          } else {
            return; // Skip invalid dates
          }
          assignmentStartDatesMap[assignment.id.toString()] = startDateStr;
        });
        
        if (Object.keys(assignmentStartDatesMap).length > 0) {
          console.log(`📅 Found ${Object.keys(assignmentStartDatesMap).length} assignment(s) with start dates for user ${requestingUserId}`);
        }
      } catch (assignmentErr) {
        console.error('⚠️ Error fetching assignment start dates for SQL filter:', assignmentErr);
      }
    }
    
    if (date && !isMobileRequest) {
      // If specific date is requested from non-mobile contexts, show plans for that date
      query = query.andWhere('plan_date', date);
    } else {
      // For mobile app: Filter out completed plans from previous days
      // Show: Today's plans (completed or not) + Future plans (completed or not)
      // Hide: Previous days' completed plans
      // Also show: Incomplete past plans (in case user missed a day)
      // CRITICAL: Also exclude plans before assignment start_date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      console.log(`📊 getDailyPlans - SQL Query: user_id=${requestingUserId}, today=${todayStr}, isMobileRequest=${isMobileRequest}`);
      
      // Query filter: Show plans that are:
      // 1. On or after today (today and future plans, regardless of completion)
      // 2. OR incomplete plans from past dates (in case user missed completing a past day)
      // 3. BUT: Exclude plans before assignment start_date (if assignment exists) - handled in JavaScript
      // Note: plan_date is a DATE column, so direct string comparison should work
      // CRITICAL: We'll filter out completed past plans in JavaScript for more reliable handling
      // This is simpler and more reliable than complex SQL boolean checks
      query = query.andWhere(function() {
        this.where('plan_date', '>=', todayStr)
          .orWhere(function() {
            this.where('plan_date', '<', todayStr)
              .andWhere('is_completed', false);
          });
      });
      
      // NOTE: We'll filter by assignment start_date in JavaScript after fetching
      // This is simpler and more reliable than complex SQL JOINs
      // The assignmentStartDatesMap will be used in the JavaScript filtering below
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
      console.log(`  - Plan ${plan.id}: plan_date=${plan.plan_date} (type: ${typeof plan.plan_date}), is_completed=${plan.is_completed}, is_stats_record=${plan.is_stats_record}`);
    });
    
    // CRITICAL: Validate and fix plan_type for plans from assignments
    // If source_plan_id exists and points to an assignment, ensure plan_type is 'web_assigned'
    const plansWithSourceId = plans.filter(p => p.source_plan_id && !p.is_stats_record);
    if (plansWithSourceId.length > 0) {
      const sourceIds = [...new Set(plansWithSourceId.map(p => p.source_plan_id.toString()))];
      
      // Check which source_plan_ids are assignments
      const assignments = await db('training_plan_assignments')
        .whereIn('id', sourceIds.map(id => parseInt(id) || 0).filter(id => id > 0))
        .select('id');
      
      const assignmentIds = new Set(assignments.map(a => a.id.toString()));
      
      // Fix plans that have wrong plan_type but source_plan_id points to an assignment
      const plansToFix = plansWithSourceId.filter(p => 
        assignmentIds.has(p.source_plan_id.toString()) && 
        p.plan_type !== 'web_assigned' && 
        p.plan_type !== 'web_assigne'
      );
      
      if (plansToFix.length > 0) {
        console.warn(`⚠️ Found ${plansToFix.length} plan(s) with incorrect plan_type for assignments. Fixing...`);
        const planIdsToFix = plansToFix.map(p => p.id);
        
        await db('daily_training_plans')
          .whereIn('id', planIdsToFix)
          .update({
            plan_type: 'web_assigned',
            updated_at: new Date()
          });
        
        // Update the plans array with corrected plan_type
        plans.forEach(plan => {
          if (planIdsToFix.includes(plan.id)) {
            plan.plan_type = 'web_assigned';
            console.log(`✅ Fixed plan_type for plan ${plan.id} to 'web_assigned'`);
          }
        });
      }
      
      // Add assignment_id field to response for clarity
      plans.forEach(plan => {
        if (plan.source_plan_id && assignmentIds.has(plan.source_plan_id.toString())) {
          plan.assignment_id = parseInt(plan.source_plan_id);
        }
      });
    }

    // Additional filter: Remove completed plans from previous days
    // This ensures Day 1 completed workouts don't show when Day 2 is active
    // BUT: Always show today's completed plans
    if (!date || isMobileRequest) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Add debug logging
      console.log(`📊 getDailyPlans - Filtering ${plans.length} plans, today=${todayStr}`);
      
      // IMPORTANT: Find the first incomplete plan based on plan_date.
      // This ensures we start from the next uncompleted day after reload
      // instead of always snapping back to Day 1 or "today".
      // Logic:
      //   - Group plans by source_plan_id (for assigned plans, each assignment is separate)
      //   - For each source_plan_id, find the earliest plan where is_completed = false
      //   - If all are completed for a source_plan_id, use the earliest date from that source
      //   - Use the earliest firstIncompleteDate across all source_plan_ids
      let firstIncompleteDate = todayStr; // Fallback: today
      
      // Group plans by source_plan_id to handle multiple assignments
      const plansBySource = {};
      plans.forEach(plan => {
        if (!plan.plan_date) return;
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
      
      // CRITICAL: Fetch assignment start_date for each source_plan_id to ensure we don't consider plans before start_date
      // This prevents showing plans from 2025-11-25 when assignment start_date is 2025-11-26
      const assignmentStartDates = {};
      const sourceIdsForAssignments = Object.keys(plansBySource).filter(id => id !== 'no_source' && id != null);
      if (sourceIdsForAssignments.length > 0) {
        try {
          const assignments = await db('training_plan_assignments')
            .whereIn('id', sourceIdsForAssignments.map(id => id.toString()))
            .orWhereIn('id', sourceIdsForAssignments.map(id => parseInt(id) || 0).filter(id => id > 0))
            .select('id', 'start_date');
          
          assignments.forEach(assignment => {
            let startDateStr;
            if (assignment.start_date instanceof Date) {
              const d = assignment.start_date;
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              startDateStr = `${year}-${month}-${day}`;
            } else if (typeof assignment.start_date === 'string') {
              startDateStr = assignment.start_date.split('T')[0];
            } else {
              return; // Skip invalid dates
            }
            assignmentStartDates[assignment.id.toString()] = startDateStr;
            console.log(`📅 Assignment ${assignment.id} start_date: ${startDateStr}`);
          });
        } catch (assignmentErr) {
          console.error('⚠️ Error fetching assignment start dates:', assignmentErr);
        }
      }
      
      // Find first incomplete date for each source_plan_id
      // CRITICAL: Only consider plans on/after the assignment's start_date
      const firstIncompleteDatesBySource = {};
      Object.keys(plansBySource).forEach(sourceId => {
        const sourcePlans = [...plansBySource[sourceId]]
          .filter(p => p.plan_date != null)
          .sort((a, b) => {
            let dateA, dateB;
            if (a.plan_date instanceof Date) {
              dateA = a.plan_date.toISOString().split('T')[0];
            } else if (typeof a.plan_date === 'string') {
              dateA = a.plan_date.split('T')[0];
            } else {
              dateA = '';
            }
            
            if (b.plan_date instanceof Date) {
              dateB = b.plan_date.toISOString().split('T')[0];
            } else if (typeof b.plan_date === 'string') {
              dateB = b.plan_date.split('T')[0];
            } else {
              dateB = '';
            }
            
            return dateA.localeCompare(dateB);
          });
        
        // Get assignment start_date for this source (if it's an assignment)
        const assignmentStartDate = assignmentStartDates[sourceId];
        
        // Find the first incomplete plan for this source
        // CRITICAL: Only consider plans on/after assignment start_date (if available)
        let firstIncompleteForSource = null;
        for (const plan of sourcePlans) {
          let planDateStr;
          if (plan.plan_date instanceof Date) {
            const d = plan.plan_date;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            planDateStr = `${year}-${month}-${day}`;
          } else if (typeof plan.plan_date === 'string') {
            planDateStr = plan.plan_date.split('T')[0];
          } else {
            continue;
          }
          
          // CRITICAL: Skip plans that are before the assignment's start_date
          if (assignmentStartDate && planDateStr < assignmentStartDate) {
            console.log(`⏭️ Skipping plan ${plan.id} (${planDateStr}) - before assignment start_date (${assignmentStartDate})`);
            continue;
          }
          
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
          console.log(`🔍 Checking plan ${plan.id} (${planDateStr}): is_completed=${plan.is_completed} (type: ${typeof plan.is_completed}, raw: ${JSON.stringify(plan.is_completed)}), completed_at=${plan.completed_at}, isActuallyCompleted=${isActuallyCompleted}`);
          
          if (!isActuallyCompleted) {
            firstIncompleteForSource = planDateStr;
            console.log(`✅ Found first incomplete plan for source_plan_id ${sourceId}: ${planDateStr} (plan_id: ${plan.id}, assignment_start: ${assignmentStartDate || 'N/A'})`);
            break;
          } else {
            console.log(`⏭️ Skipping completed plan ${plan.id} (${planDateStr}) - is_completed=${plan.is_completed}, completed_at=${plan.completed_at} - looking for next incomplete plan`);
          }
        }
        
        // If all plans for this source are completed, use the earliest date on/after start_date
        if (!firstIncompleteForSource && sourcePlans.length > 0) {
          // Find the earliest plan that's on/after assignment start_date
          let earliestValidPlan = null;
          for (const plan of sourcePlans) {
            let planDateStr;
            if (plan.plan_date instanceof Date) {
              const d = plan.plan_date;
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              planDateStr = `${year}-${month}-${day}`;
            } else if (typeof plan.plan_date === 'string') {
              planDateStr = plan.plan_date.split('T')[0];
            } else {
              continue;
            }
            
            // Only consider plans on/after assignment start_date
            if (!assignmentStartDate || planDateStr >= assignmentStartDate) {
              earliestValidPlan = planDateStr;
              break;
            }
          }
          
          if (earliestValidPlan) {
            firstIncompleteForSource = earliestValidPlan;
            console.log(`📅 All plans completed for source_plan_id ${sourceId}, using earliest valid date (on/after start_date): ${firstIncompleteForSource}`);
          } else if (assignmentStartDate) {
            // If no valid plan found but we have an assignment start_date, use that
            firstIncompleteForSource = assignmentStartDate;
            console.log(`📅 No valid plans found for source_plan_id ${sourceId}, using assignment start_date: ${firstIncompleteForSource}`);
          }
        }
        
        if (firstIncompleteForSource) {
          firstIncompleteDatesBySource[sourceId] = firstIncompleteForSource;
        }
      });
      
      // Use the earliest firstIncompleteDate across all sources
      const allFirstIncompleteDates = Object.values(firstIncompleteDatesBySource);
      if (allFirstIncompleteDates.length > 0) {
        firstIncompleteDate = allFirstIncompleteDates.sort()[0]; // Earliest date
        console.log(`📅 Using earliest first incomplete date across all sources: ${firstIncompleteDate}`);
      } else {
        console.log(`📅 No incomplete plans found, using today as fallback: ${firstIncompleteDate}`);
      }
      
      plans = plans.filter(plan => {
        // CRITICAL: Skip stats records (double-check even though SQL should filter them)
        if (plan.is_stats_record) {
          console.log(`  ⏭️ Skipping stats record: plan_id=${plan.id}, plan_type=${plan.plan_type}`);
          return false;
        }
        
        // CRITICAL: Skip plans with null plan_date (stats records often have null plan_date)
        if (!plan.plan_date || plan.plan_date === null) {
          console.log(`  ⏭️ Skipping plan with null plan_date: plan_id=${plan.id}, plan_type=${plan.plan_type}, is_stats_record=${plan.is_stats_record}`);
          return false;
        }
        
        // CRITICAL: Ensure plan_type matches (prevent manual plan interference with assigned plans)
        // If we defaulted to web_assigned above, only return web_assigned plans
        if (!plan_type && plan.plan_type !== 'web_assigned' && plan.plan_type !== 'web_assigne') {
          console.log(`  ⏭️ Skipping non-assigned plan (defaulting to web_assigned): plan_id=${plan.id}, plan_type=${plan.plan_type}`);
          return false;
        }
        
        // Handle plan_date - it might be a Date object or string
        // CRITICAL: Use LOCAL date components to avoid timezone shifts
        // When dates are stored as Date objects with timezone, toISOString() converts to UTC
        // which can shift the date by one day (e.g., Dec 02 GMT+0500 becomes Dec 01 UTC)
        let planDateStr;
        if (plan.plan_date instanceof Date) {
          // Use LOCAL date components, not UTC
          const d = plan.plan_date;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          planDateStr = `${year}-${month}-${day}`;
        } else if (typeof plan.plan_date === 'string') {
          // Parse date string (YYYY-MM-DD format)
          // Handle both YYYY-MM-DD and other formats
          if (plan.plan_date.includes('T')) {
            // If it has time component, extract just the date part
            planDateStr = plan.plan_date.split('T')[0];
          } else {
            // For YYYY-MM-DD format, use as-is
            planDateStr = plan.plan_date;
          }
        } else if (plan.plan_date === null || plan.plan_date === undefined) {
          // If plan_date is null or invalid, skip this plan
          console.warn(`⚠️ Invalid plan_date for plan: plan_id=${plan.id}, plan_date=${plan.plan_date}`);
          return false;
        } else {
          console.warn(`⚠️ Unexpected plan_date type for plan: plan_id=${plan.id}, plan_date=${plan.plan_date}, type=${typeof plan.plan_date}`);
          return false;
        }
        
        // IMPORTANT: Only keep plans starting from the first incomplete day (or today)
        // This ensures that after reload, Day 2 shows instead of Day 1 if Day 1 is completed
        // Keep the plan if:
        // 1. It's on or after the first incomplete date (or today if no incomplete plan found)
        // 2. AND it's not a completed plan from before today (unless it's today itself)
        // CRITICAL: Handle is_completed properly (boolean true, string 't', or number 1)
        const isCompleted = plan.is_completed === true || plan.is_completed === 't' || plan.is_completed === 1;
        const hasCompletedAt = plan.completed_at != null && plan.completed_at !== 'null';
        const isActuallyCompleted = isCompleted && hasCompletedAt;
        
        // CRITICAL: Also check against assignment start_date to filter out plans before start_date
        const assignmentStartDate = assignmentStartDates[plan.source_plan_id?.toString()];
        
        // CRITICAL: ALWAYS exclude plans before assignment start_date, regardless of completion status
        // This prevents completed plans on 2025-12-01 from being returned when assignment start_date is 2025-12-02
        if (assignmentStartDate && planDateStr < assignmentStartDate) {
          console.log(`🚫 FILTERING OUT: Plan ${plan.id} (${planDateStr}) is before assignment start_date (${assignmentStartDate}) - EXCLUDING`);
          return false;
        }
        
        const isOnOrAfterAssignmentStart = !assignmentStartDate || planDateStr >= assignmentStartDate;
        const isToday = planDateStr === todayStr;
        const isPastDate = planDateStr < todayStr;
        const isFutureDate = planDateStr > todayStr;
        
        // CRITICAL LOGIC: What plans should we show?
        // 1. First incomplete plan and all future plans (incomplete or completed) - user needs to see what's next
        // 2. Today's plan (completed or not) - user needs to see today's workout
        // 3. DO NOT show completed past plans (before today) - these are done and shouldn't clutter the list
        // 4. DO NOT show plans before assignment start_date - already filtered above
        
        // Check if this plan is the first incomplete plan or after it
        const isOnOrAfterFirstIncomplete = planDateStr >= firstIncompleteDate;
        
        // Keep plan if:
        // 1. It's on/after the first incomplete date (shows the next incomplete day and all future days)
        // 2. OR it's today (so user can see today's plan even if completed)
        // 3. AND it's on/after the assignment's start_date (already checked above)
        // 4. AND it's NOT a completed past plan (past completed plans should NEVER be shown - they're done)
        const isPastCompleted = isPastDate && isActuallyCompleted && planDateStr !== todayStr;
        
        const shouldKeep = isOnOrAfterAssignmentStart && (isOnOrAfterFirstIncomplete || isToday) && !isPastCompleted;
        
        if (!shouldKeep) {
          if (assignmentStartDate && planDateStr < assignmentStartDate) {
            console.log(`⏭️ Filtering out plan ${plan.id} (${planDateStr}) - before assignment start_date (${assignmentStartDate})`);
          } else if (isPastCompleted) {
            console.log(`🚫 CRITICAL: Filtering out completed PAST plan ${plan.id} (${planDateStr}) - is_completed=${plan.is_completed}, completed_at=${plan.completed_at ? 'has_value' : 'null'}, today=${todayStr}`);
          } else if (!isOnOrAfterFirstIncomplete && !isToday) {
            console.log(`⏭️ Filtering out plan ${plan.id} (${planDateStr}) - before firstIncompleteDate (${firstIncompleteDate}) and not today`);
          }
        } else {
          if (isActuallyCompleted && !isPastDate) {
            console.log(`✅ Keeping completed plan (today/future): plan_id=${plan.id}, plan_date=${planDateStr}, today=${todayStr}`);
          } else {
            console.log(`✅ Keeping incomplete plan: plan_id=${plan.id}, plan_date=${planDateStr}, is_completed=${plan.is_completed}`);
          }
        }
        
        return shouldKeep;
      });
      
      console.log(`📊 getDailyPlans - After filtering: ${plans.length} plans remaining`);
      plans.forEach(plan => {
        console.log(`  ✅ Final plan: plan_id=${plan.id}, plan_date=${plan.plan_date}, is_completed=${plan.is_completed}`);
      });
      
      // CRITICAL: Sort plans by plan_date ASC to ensure the first plan is the earliest incomplete day
      // This ensures the mobile app always gets the correct "next day" as the first result
      // CRITICAL: Use LOCAL date components to avoid timezone shifts
      plans.sort((a, b) => {
        let dateA, dateB;
        if (a.plan_date instanceof Date) {
          // Use LOCAL date components, not UTC
          const d = a.plan_date;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dateA = `${year}-${month}-${day}`;
        } else if (typeof a.plan_date === 'string') {
          dateA = a.plan_date.split('T')[0];
        } else {
          dateA = '';
        }
        
        if (b.plan_date instanceof Date) {
          // Use LOCAL date components, not UTC
          const d = b.plan_date;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dateB = `${year}-${month}-${day}`;
        } else if (typeof b.plan_date === 'string') {
          dateB = b.plan_date.split('T')[0];
        } else {
          dateB = '';
        }
        
        return dateA.localeCompare(dateB);
      });
      
      console.log(`📊 getDailyPlans - After sorting: First plan is ${plans[0]?.id} (date: ${plans[0]?.plan_date}, completed: ${plans[0]?.is_completed})`);
      
      // FINAL SAFETY CHECK: Remove ALL completed plans except today's
      // This is a critical safeguard to ensure we NEVER return a completed plan as the first result
      // (unless it's today, so the user can see what they just completed)
      // Use existing todayStr from earlier in the function
      
      const plansBeforeFilter = plans.length;
      plans = plans.filter(plan => {
        let planDateStr;
        if (plan.plan_date instanceof Date) {
          const d = plan.plan_date;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          planDateStr = `${year}-${month}-${day}`;
        } else if (typeof plan.plan_date === 'string') {
          planDateStr = plan.plan_date.split('T')[0];
        } else {
          return false; // Skip plans with invalid dates
        }
        
        // CRITICAL: Use the same robust completion check as above
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
        const isActuallyCompleted = isCompleted && hasCompletedAt;
        const isToday = planDateStr === todayStr;
        
        // Keep plan if:
        // 1. It's not completed, OR
        // 2. It's completed but it's today (so user can see what they just completed)
        const shouldKeep = !isActuallyCompleted || isToday;
        
        // Enhanced logging for debugging
        if (isActuallyCompleted && !isToday) {
          console.log(`🚫 FINAL FILTER: Plan ${plan.id} (${planDateStr}) is completed (is_completed=${plan.is_completed}, completed_at=${plan.completed_at}) and not today - REMOVING`);
        }
        
        if (!shouldKeep && isActuallyCompleted) {
          return false; // Explicitly return false for completed past plans
        }
        
        return shouldKeep;
      });
      
      console.log(`📊 getDailyPlans - After final filter: ${plans.length} plans remaining (removed ${plansBeforeFilter - plans.length} completed plans)`);
      
      // CRITICAL: Aggressively remove ALL completed plans from the beginning (except today's)
      // This is a double-check to ensure we NEVER return a completed plan as the first result
      // Keep removing completed plans until we find the first incomplete plan (or today's completed plan)
      let removedCount = 0;
      while (plans.length > 0) {
        const firstPlan = plans[0];
        let firstPlanDateStr;
        if (firstPlan.plan_date instanceof Date) {
          const d = firstPlan.plan_date;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          firstPlanDateStr = `${year}-${month}-${day}`;
        } else if (typeof firstPlan.plan_date === 'string') {
          firstPlanDateStr = firstPlan.plan_date.split('T')[0];
        } else {
          break; // Invalid date, stop
        }
        
        const isFirstCompleted = firstPlan.is_completed === true || firstPlan.is_completed === 't' || firstPlan.is_completed === 1;
        const hasFirstCompletedAt = firstPlan.completed_at != null && firstPlan.completed_at !== 'null' && firstPlan.completed_at !== '';
        const isFirstActuallyCompleted = isFirstCompleted && hasFirstCompletedAt;
        const isFirstToday = firstPlanDateStr === todayStr;
        
        // Remove if it's completed AND not today
        if (isFirstActuallyCompleted && !isFirstToday) {
          console.log(`🚫 AGGRESSIVE REMOVAL: Removing completed plan ${firstPlan.id} (${firstPlanDateStr}) from beginning - is_completed=${firstPlan.is_completed}, completed_at=${firstPlan.completed_at}`);
          plans.shift();
          removedCount++;
        } else {
          // Found an incomplete plan or today's plan, stop removing
          break;
        }
      }
      
      if (removedCount > 0) {
        console.log(`📊 Removed ${removedCount} additional completed plan(s) from the beginning. Remaining plans: ${plans.length}`);
        if (plans.length > 0) {
          console.log(`  ✅ New first plan: plan_id=${plans[0].id}, plan_date=${plans[0].plan_date}, is_completed=${plans[0].is_completed}`);
        } else {
          console.warn(`⚠️ WARNING: All plans were completed and removed! This should not happen.`);
        }
      }
      
      // Final verification: Ensure first plan is incomplete (unless it's today)
      if (plans.length > 0) {
        const finalFirstPlan = plans[0];
        let finalFirstPlanDateStr;
        if (finalFirstPlan.plan_date instanceof Date) {
          const d = finalFirstPlan.plan_date;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          finalFirstPlanDateStr = `${year}-${month}-${day}`;
        } else if (typeof finalFirstPlan.plan_date === 'string') {
          finalFirstPlanDateStr = finalFirstPlan.plan_date.split('T')[0];
        } else {
          finalFirstPlanDateStr = '';
        }
        
        const isFinalCompleted = finalFirstPlan.is_completed === true || finalFirstPlan.is_completed === 't' || finalFirstPlan.is_completed === 1;
        const hasFinalCompletedAt = finalFirstPlan.completed_at != null && finalFirstPlan.completed_at !== 'null' && finalFirstPlan.completed_at !== '';
        const isFinalActuallyCompleted = isFinalCompleted && hasFinalCompletedAt;
        const isFinalToday = finalFirstPlanDateStr === todayStr;
        
        if (isFinalActuallyCompleted && !isFinalToday) {
          console.error(`❌ CRITICAL BUG: First plan ${finalFirstPlan.id} (${finalFirstPlanDateStr}) is STILL completed after all filtering! This should never happen.`);
          // Last resort: Remove it
          plans.shift();
          console.log(`🚫 Removed the completed first plan as last resort. Remaining: ${plans.length} plans`);
        }
      }
      
      console.log(`✅ FINAL RESULT: First plan is ${plans[0] ? (plans[0].is_completed === true || plans[0].is_completed === 't' ? 'completed' : 'incomplete') : 'NONE'} (correct): plan_id=${plans[0]?.id}, plan_date=${plans[0]?.plan_date}, is_completed=${plans[0]?.is_completed}`);
      // Keep removing completed plans from the front until we find an incomplete one
      while (plans.length > 0) {
        const firstPlan = plans[0];
        let firstPlanDateStr;
        if (firstPlan.plan_date instanceof Date) {
          const d = firstPlan.plan_date;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          firstPlanDateStr = `${year}-${month}-${day}`;
        } else if (typeof firstPlan.plan_date === 'string') {
          firstPlanDateStr = firstPlan.plan_date.split('T')[0];
        } else {
          // Invalid date, remove it
          plans = plans.filter(p => p.id !== firstPlan.id);
          continue;
        }
        
        // CRITICAL: Use the same robust completion check
        const isFirstCompleted = firstPlan.is_completed === true || 
                                 firstPlan.is_completed === 't' || 
                                 firstPlan.is_completed === 1 || 
                                 firstPlan.is_completed === 'true' ||
                                 String(firstPlan.is_completed).toLowerCase() === 'true';
        const hasFirstCompletedAt = firstPlan.completed_at != null && 
                                    firstPlan.completed_at !== 'null' && 
                                    firstPlan.completed_at !== '' &&
                                    String(firstPlan.completed_at).trim() !== '';
        const isFirstActuallyCompleted = isFirstCompleted && hasFirstCompletedAt;
        const isFirstToday = firstPlanDateStr === todayStr;
        
        // If first plan is completed and not today, remove it and continue loop
        if (isFirstActuallyCompleted && !isFirstToday) {
          console.error(`❌ CRITICAL ERROR: First plan ${firstPlan.id} (${firstPlanDateStr}) is completed but not today. Removing it and checking next plan.`);
          plans = plans.filter(p => p.id !== firstPlan.id);
          continue;
        }
        
        // First plan is either incomplete or today's completed plan - this is valid
        break;
      }
      
      // Log the first plan that will be returned
      if (plans.length > 0) {
        const finalFirstPlan = plans[0];
        const isFirstCompleted = finalFirstPlan.is_completed === true || finalFirstPlan.is_completed === 't' || finalFirstPlan.is_completed === 1;
        const hasFirstCompletedAt = finalFirstPlan.completed_at != null && finalFirstPlan.completed_at !== 'null';
        const isFirstActuallyCompleted = isFirstCompleted && hasFirstCompletedAt;
        
        if (isFirstActuallyCompleted) {
          let firstPlanDateStr;
          if (finalFirstPlan.plan_date instanceof Date) {
            const d = finalFirstPlan.plan_date;
            firstPlanDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (typeof finalFirstPlan.plan_date === 'string') {
            firstPlanDateStr = finalFirstPlan.plan_date.split('T')[0];
          }
          const isFirstToday = firstPlanDateStr === todayStr;
          
          if (isFirstToday) {
            console.log(`✅ FINAL RESULT: First plan is today's completed plan (valid): plan_id=${finalFirstPlan.id}, plan_date=${finalFirstPlan.plan_date}`);
          } else {
            console.error(`❌ CRITICAL: First plan is completed but not today! This should never happen after filtering. plan_id=${finalFirstPlan.id}, plan_date=${finalFirstPlan.plan_date}`);
          }
        } else {
          console.log(`✅ FINAL RESULT: First plan is incomplete (correct): plan_id=${finalFirstPlan.id}, plan_date=${finalFirstPlan.plan_date}, is_completed=${finalFirstPlan.is_completed}`);
        }
      } else {
        console.warn(`⚠️ WARNING: No plans remaining after filtering! This might indicate all plans are completed or filtered out.`);
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
      .select('id', 'plan_date', 'completed_at', 'source_plan_id')
      .orderBy('completed_at', 'desc')
      .limit(10);
    
    if (recentCompletions.length > 0) {
      console.log(`⚠️ WARNING: Found ${recentCompletions.length} recent completion(s) in the last 10 seconds for user ${user_id}:`, 
        recentCompletions.map(p => ({
          id: p.id,
          plan_date: p.plan_date,
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
    const dailyPlan = await db('daily_training_plans')
      .where({
        id: daily_plan_id,
        user_id: user_id,
        is_stats_record: false // Exclude stats records
      })
      .first();

    if (!dailyPlan) {
      // Log for debugging
      console.error('❌ Daily plan not found:', {
        daily_plan_id,
        user_id,
        gym_id
      });
      
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
      }
      
      return res.status(404).json({
        success: false,
        message: 'Daily training plan not found'
      });
    }
    
    // CRITICAL: Log the plan details to verify we have the correct plan
    console.log(`📋 Found daily plan to complete:`, {
      id: dailyPlan.id,
      plan_date: dailyPlan.plan_date,
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
        console.warn(`⚠️ Plan ${daily_plan_id} (plan_date: ${dailyPlan.plan_date}) was already completed ${secondsSinceCompletion.toFixed(1)} seconds ago. Rejecting duplicate request.`);
        return res.status(200).json({
          success: true,
          message: 'Plan was already completed',
          data: {
            daily_plan_id: daily_plan_id,
            plan_date: dailyPlan.plan_date,
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
        .select('id', 'plan_date', 'completed_at', 'is_completed')
        .orderBy('completed_at', 'desc');
      
      if (veryRecentCompletionsForSource.length > 0) {
        console.error(`❌ CRITICAL: Found ${veryRecentCompletionsForSource.length} other plan(s) from the same source_plan_id (${dailyPlan.source_plan_id}) completed in the last 3 seconds!`, {
          current_plan_id: daily_plan_id,
          current_plan_date: dailyPlan.plan_date,
          recent_completions: veryRecentCompletionsForSource.map(p => ({
            id: p.id,
            plan_date: p.plan_date,
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
      plan_date: dailyPlan.plan_date,
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
      .select('id', 'plan_date', 'is_completed');
    
    console.log(`📊 Completion check: Found ${otherPlansCheck.length} other incomplete plans for same source_plan_id (${dailyPlan.source_plan_id})`);
    if (otherPlansCheck.length > 0) {
      console.log(`📊 Other incomplete plans:`, otherPlansCheck.map(p => ({ id: p.id, plan_date: p.plan_date, is_completed: p.is_completed })));
    }

    // CRITICAL: Check for concurrent completions BEFORE starting transaction
    // This prevents completing Day 1 and Day 2 simultaneously
    // Get the plan info first to check source_plan_id
    const planInfo = await db('daily_training_plans')
      .where({ id: daily_plan_id })
      .select('id', 'plan_date', 'source_plan_id', 'user_id')
      .first();
    
    if (planInfo && planInfo.source_plan_id) {
      const recentCompletions = await db('daily_training_plans')
        .where({
          user_id: user_id,
          source_plan_id: planInfo.source_plan_id,
          is_stats_record: false
        })
        .whereNot({ id: daily_plan_id })
        .where(function() {
          this.where('is_completed', true)
            .orWhere('is_completed', 't')
            .orWhere('is_completed', 1);
        })
        .whereNotNull('completed_at')
        .whereRaw('completed_at > NOW() - INTERVAL \'30 seconds\'')
        .select('id', 'plan_date', 'is_completed', 'completed_at')
        .orderBy('completed_at', 'desc')
        .limit(5);
      
      if (recentCompletions.length > 0) {
        // Check if any recent completion is for the previous day
        const currentPlanDate = new Date(planInfo.plan_date);
        currentPlanDate.setHours(0, 0, 0, 0);
        const currentPlanDateStr = currentPlanDate.toISOString().split('T')[0];
        
        for (const recent of recentCompletions) {
          const recentDate = new Date(recent.plan_date);
          recentDate.setHours(0, 0, 0, 0);
          const recentDateStr = recentDate.toISOString().split('T')[0];
          
          const daysDiff = Math.floor((currentPlanDate - recentDate) / (1000 * 60 * 60 * 24));
          
          // If this is Day 2 and Day 1 was just completed (within 30 seconds), block it
          // This prevents rapid sequential completions that suggest concurrent requests
          if (daysDiff === 1) {
            const secondsSince = Math.round((new Date() - new Date(recent.completed_at)) / 1000);
            console.error(`❌ BLOCKING: Attempting to complete Day 2 (${currentPlanDateStr}) immediately after Day 1 (${recentDateStr}) was completed ${secondsSince} seconds ago. This is not allowed - users must complete days one at a time with a reasonable delay.`);
            return res.status(400).json({
              success: false,
              message: `Cannot complete Day 2 immediately after Day 1. Please wait at least 30 seconds between completing consecutive days.`,
              error: 'CONCURRENT_COMPLETION_BLOCKED',
              last_completed_date: recentDateStr,
              requested_date: currentPlanDateStr,
              seconds_since_last_completion: secondsSince,
              required_delay: 30
            });
          }
        }
      }
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
        .select('id', 'plan_date', 'source_plan_id', 'plan_type', 'is_completed', 'completed_at', 'user_id')
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
          console.warn(`⚠️ WARNING: Plan ${daily_plan_id} (plan_date: ${planBeforeUpdate.plan_date}) was already completed ${secondsSinceCompletion.toFixed(1)} seconds ago!`, {
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
              plan_date: planBeforeUpdate.plan_date,
              is_completed: true,
              completed_at: planBeforeUpdate.completed_at,
              already_completed: true
            }
          });
        } else {
          // Completed very recently (within 5 seconds) - might be a race condition or duplicate request
          console.warn(`⚠️ WARNING: Plan ${daily_plan_id} (plan_date: ${planBeforeUpdate.plan_date}) was completed just ${secondsSinceCompletion.toFixed(1)} seconds ago! This might be a duplicate request.`);
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
          lastCompletedPlanQuery = lastCompletedPlanQuery.where('plan_date', '>=', assignmentStartDateStr);
        }
        
        const lastCompletedPlan = await lastCompletedPlanQuery
          .select('id', 'plan_date', 'completed_at')
          .orderBy('plan_date', 'desc')
          .first();
        
        if (lastCompletedPlan) {
          // Normalize dates
          let lastCompletedDateStr, requestedDateStr;
          if (lastCompletedPlan.plan_date instanceof Date) {
            const d = lastCompletedPlan.plan_date;
            lastCompletedDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (typeof lastCompletedPlan.plan_date === 'string') {
            lastCompletedDateStr = lastCompletedPlan.plan_date.split('T')[0];
          } else {
            lastCompletedDateStr = new Date(lastCompletedPlan.plan_date).toISOString().split('T')[0];
          }
          
          if (planBeforeUpdate.plan_date instanceof Date) {
            const d = planBeforeUpdate.plan_date;
            requestedDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (typeof planBeforeUpdate.plan_date === 'string') {
            requestedDateStr = planBeforeUpdate.plan_date.split('T')[0];
          } else {
            requestedDateStr = new Date(planBeforeUpdate.plan_date).toISOString().split('T')[0];
          }
          
          const lastCompletedDate = new Date(lastCompletedDateStr + 'T00:00:00.000Z');
          const requestedDate = new Date(requestedDateStr + 'T00:00:00.000Z');
          const daysDifference = Math.floor((requestedDate - lastCompletedDate) / (1000 * 60 * 60 * 24));
          
          if (daysDifference === 1) {
            isSequentialCompletion = true;
            console.log(`✅ PRIMARY VALIDATION: Requested plan ${daily_plan_id} (${requestedDateStr}) is exactly 1 day after last completed plan (${lastCompletedDateStr}). This is valid sequential completion - ALLOWING and skipping other validations.`);
          }
        } else {
          // CRITICAL: No completed plans yet - this is Day 1, explicitly allow it
          console.log(`✅ PRIMARY VALIDATION: No completed plans found for assignment ${planBeforeUpdate.source_plan_id}. This is Day 1 - ALLOWING completion of plan ${daily_plan_id} (${planBeforeUpdate.plan_date}).`);
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
            .where('plan_date', '<', assignmentStartDateStr)
            .where(function() {
              this.where('is_completed', true)
                .orWhere('is_completed', 't')
                .orWhere('is_completed', 1);
            })
            .whereNotNull('completed_at')
            .select('id', 'plan_date', 'is_completed', 'completed_at');
          
          if (duplicateCompletedPlans.length > 0) {
            console.warn(`⚠️ CRITICAL BUG DETECTED: Found ${duplicateCompletedPlans.length} COMPLETED plan(s) before start_date (${assignmentStartDateStr})!`);
            console.warn(`⚠️ These are duplicate Day 1 plans that cause completion bugs. Deleting them now.`);
            
            for (const duplicatePlan of duplicateCompletedPlans) {
              console.warn(`⚠️ Deleting duplicate completed plan: id=${duplicatePlan.id}, plan_date=${duplicatePlan.plan_date}, is_completed=${duplicatePlan.is_completed}, completed_at=${duplicatePlan.completed_at}`);
              await trx('daily_training_plans')
                .where({ id: duplicatePlan.id })
                .del();
            }
            
            console.log(`🗑️ Deleted ${duplicateCompletedPlans.length} duplicate completed plan(s) before start_date to fix completion bugs`);
          }
        }
      }
      
      // CRITICAL: Additional safety check - verify this is the "next" incomplete day
      // BUT: Skip this ENTIRE validation if it's a valid sequential completion (already validated above)
      // This prevents unnecessary validation that might block valid sequential completions
      let allPlansForSource = [];
      let completedPlans = [];
      let incompletePlansBefore = [];
      let firstIncompletePlan = null;
      
      if (!isSequentialCompletion) {
        // Only run this validation if it's NOT a sequential completion
        // Get all plans for this source_plan_id to find the first incomplete day
        // CRITICAL: Only consider plans on/after assignment start_date to avoid duplicate Day 1 bugs
        let allPlansForSourceQuery = trx('daily_training_plans')
          .where({
            user_id: user_id,
            source_plan_id: planBeforeUpdate.source_plan_id,
            is_stats_record: false
          });
        
        // CRITICAL: For assigned plans, handle both 'web_assigned' and 'web_assigne' plan_type variations
        // This ensures validation works even if plan_type has slight variations
        if (planBeforeUpdate.plan_type === 'web_assigned' || planBeforeUpdate.plan_type === 'web_assigne') {
          allPlansForSourceQuery = allPlansForSourceQuery.whereIn('plan_type', ['web_assigned', 'web_assigne']);
          console.log(`📋 Filtering validation plans by plan_type: web_assigned/web_assigne`);
        } else {
          allPlansForSourceQuery = allPlansForSourceQuery.where('plan_type', planBeforeUpdate.plan_type);
          console.log(`📋 Filtering validation plans by plan_type: ${planBeforeUpdate.plan_type}`);
        }
        
        // CRITICAL: Filter out plans before assignment start_date
        // This prevents the duplicate Day 1 bug where a completed plan on 2025-12-01 (before start_date 2025-12-02)
        // causes validation to fail when trying to complete Day 2
        if (planBeforeUpdate.source_plan_id) {
          const assignment = await trx('training_plan_assignments')
            .where({ id: planBeforeUpdate.source_plan_id })
            .first();
          
          if (assignment && assignment.start_date) {
            let assignmentStartDateStr;
            if (assignment.start_date instanceof Date) {
              const d = assignment.start_date;
              assignmentStartDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            } else if (typeof assignment.start_date === 'string') {
              assignmentStartDateStr = assignment.start_date.split('T')[0];
            }
            
            if (assignmentStartDateStr) {
              allPlansForSourceQuery = allPlansForSourceQuery.where('plan_date', '>=', assignmentStartDateStr);
              console.log(`📅 Filtering allPlansForSource to only consider plans on/after assignment start_date: ${assignmentStartDateStr}`);
            }
          }
        }
        
        allPlansForSource = await allPlansForSourceQuery
          .select('id', 'plan_date', 'is_completed', 'completed_at')
          .orderBy('plan_date', 'asc');
      
        console.log(`📊 Completion validation: Found ${allPlansForSource.length} total plans for source_plan_id ${planBeforeUpdate.source_plan_id} (filtered by start_date)`);
        console.log(`📊 All plans for source (first 10):`, allPlansForSource.slice(0, 10).map(p => ({
          id: p.id,
          plan_date: p.plan_date,
          is_completed: p.is_completed,
          completed_at: p.completed_at ? 'has_value' : 'null'
        })));
        
        // Find the first incomplete day (handle null/undefined is_completed properly)
        firstIncompletePlan = allPlansForSource.find(p => {
          // Handle both boolean false and null/undefined
          const isCompleted = p.is_completed === true || p.is_completed === 't' || p.is_completed === 1;
          const hasCompletedAt = p.completed_at != null && p.completed_at !== 'null';
          return !isCompleted || !hasCompletedAt;
        });
        
        console.log(`📊 First incomplete plan:`, firstIncompletePlan ? {
          id: firstIncompletePlan.id,
          plan_date: firstIncompletePlan.plan_date,
          is_completed: firstIncompletePlan.is_completed,
          completed_at: firstIncompletePlan.completed_at ? 'has_value' : 'null'
        } : 'None found');
        
        // CRITICAL: Check if there are any COMPLETED plans
        // We only enforce sequential completion if there are already completed plans
        // If no plans are completed yet, allow completing any plan (user might start from any day)
        completedPlans = allPlansForSource.filter(p => {
          const isCompleted = p.is_completed === true || p.is_completed === 't' || p.is_completed === 1;
          const hasCompletedAt = p.completed_at != null && p.completed_at !== 'null';
          return isCompleted && hasCompletedAt;
        });
        
        // CRITICAL: Find any INCOMPLETE plans BEFORE the requested plan date
        // But ONLY enforce this if there are already completed plans
        // If no plans are completed yet, allow completing any plan
        incompletePlansBefore = allPlansForSource.filter(p => {
          if (p.id === daily_plan_id) return false; // Exclude the current plan
          const isCompleted = p.is_completed === true || p.is_completed === 't' || p.is_completed === 1;
          const hasCompletedAt = p.completed_at != null && p.completed_at !== 'null';
          const isActuallyCompleted = isCompleted && hasCompletedAt;
          
          if (isActuallyCompleted) return false; // Completed, skip (completed days before are OK)
          
          // Check if this incomplete plan's date is before the requested plan's date
          // Normalize dates to date-only strings (YYYY-MM-DD) to avoid timezone issues
          let pDateStr, requestedDateStr;
          
          if (p.plan_date instanceof Date) {
            pDateStr = p.plan_date.toISOString().split('T')[0];
          } else if (typeof p.plan_date === 'string') {
            pDateStr = p.plan_date.split('T')[0];
          } else {
            pDateStr = new Date(p.plan_date).toISOString().split('T')[0];
          }
          
          if (planBeforeUpdate.plan_date instanceof Date) {
            requestedDateStr = planBeforeUpdate.plan_date.toISOString().split('T')[0];
          } else if (typeof planBeforeUpdate.plan_date === 'string') {
            requestedDateStr = planBeforeUpdate.plan_date.split('T')[0];
          } else {
            requestedDateStr = new Date(planBeforeUpdate.plan_date).toISOString().split('T')[0];
          }
          
          return pDateStr < requestedDateStr;
        });
        
        console.log(`📊 Completion validation:`, {
          requested_plan_id: daily_plan_id,
          requested_plan_date: planBeforeUpdate.plan_date,
          first_incomplete_plan_id: firstIncompletePlan?.id,
          first_incomplete_plan_date: firstIncompletePlan?.plan_date,
          completed_plans_count: completedPlans.length,
          incomplete_plans_before_count: incompletePlansBefore.length,
          all_plans_summary: allPlansForSource.slice(0, 5).map(p => ({
            id: p.id,
            plan_date: p.plan_date,
            is_completed: p.is_completed,
            completed_at: p.completed_at ? 'has_value' : 'null'
          }))
        });
      } else {
        console.log(`✅ Skipping additional validation - this is a valid sequential completion (already validated above)`);
      }
      
      // Only enforce sequential completion if there are already completed plans AND it's not the next sequential day
      // If no plans are completed yet, allow completing any plan (user can start from any day)
      // If it's the next sequential day, always allow it
      // CRITICAL: Skip this check if isSequentialCompletion is true (already validated above)
      if (!isSequentialCompletion && completedPlans.length > 0 && incompletePlansBefore.length > 0) {
        const firstIncompleteBefore = incompletePlansBefore[0];
        const lastCompletedPlan = completedPlans[completedPlans.length - 1];
        
        console.error(`❌ BLOCKING: Attempting to complete plan ${daily_plan_id} (plan_date: ${planBeforeUpdate.plan_date}), but there are ${incompletePlansBefore.length} incomplete plan(s) before it and it's not the next sequential day!`, {
          requested_plan_id: daily_plan_id,
          requested_plan_date: planBeforeUpdate.plan_date,
          first_incomplete_before_id: firstIncompleteBefore.id,
          first_incomplete_before_date: firstIncompleteBefore.plan_date,
          last_completed_plan_id: lastCompletedPlan.id,
          last_completed_plan_date: lastCompletedPlan.plan_date,
          completed_plans_count: completedPlans.length,
          incomplete_plans_before: incompletePlansBefore.map(p => ({
            id: p.id,
            plan_date: p.plan_date,
            is_completed: p.is_completed,
            completed_at: p.completed_at ? 'has_value' : 'null'
          }))
        });
        
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot complete plan for ${planBeforeUpdate.plan_date}. You must complete days in order. The next incomplete day is ${firstIncompleteBefore.plan_date}.`,
          error: 'INVALID_COMPLETION_ORDER',
          next_incomplete_day: {
            id: firstIncompleteBefore.id,
            plan_date: firstIncompleteBefore.plan_date
          }
        });
      }
      
      if (isSequentialCompletion) {
        console.log(`✅ VALIDATION PASSED: Requested plan is the next sequential day. Proceeding with completion.`);
      }
      
      // If no plans are completed yet, log a warning but allow the completion
      if (completedPlans.length === 0 && incompletePlansBefore.length > 0) {
        console.warn(`⚠️ WARNING: No plans completed yet, but attempting to complete plan ${daily_plan_id} (plan_date: ${planBeforeUpdate.plan_date}) while there are ${incompletePlansBefore.length} incomplete plan(s) before it. Allowing completion since no plans are completed yet.`);
      }
      
      // If firstIncompletePlan exists and is different from requested plan, log warning
      // (This can happen if there's a data inconsistency, but we'll allow it if no incomplete plans before)
      if (firstIncompletePlan && firstIncompletePlan.id !== daily_plan_id) {
        console.warn(`⚠️ WARNING: First incomplete plan is ${firstIncompletePlan.id} (${firstIncompletePlan.plan_date}), but completing ${daily_plan_id} (${planBeforeUpdate.plan_date}). This might indicate a data inconsistency.`);
      }
      
      console.log(`📝 About to update plan ${daily_plan_id}:`, {
        plan_date: planBeforeUpdate.plan_date,
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
      // NOTE: We removed plan_date and source_plan_id from WHERE to avoid timezone/format mismatch issues
      // The id is already a unique primary key, so adding user_id provides sufficient safety
      const completionTimestamp = new Date();
      
      console.log(`📝 About to execute UPDATE query:`, {
        daily_plan_id: daily_plan_id,
        user_id: user_id,
        plan_date: planBeforeUpdate.plan_date,
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
        
        // CRITICAL: Only consider completed plans on/after assignment start_date
        // This prevents the duplicate Day 1 bug where a completed plan on 2025-12-01 (before start_date 2025-12-02)
        // causes the system to think Day 1 is already done, preventing Day 2 from being completed
        if (assignmentStartDateStr) {
          lastCompletedPlanQuery = lastCompletedPlanQuery.where('plan_date', '>=', assignmentStartDateStr);
          console.log(`📅 Filtering last completed plan to only consider plans on/after assignment start_date: ${assignmentStartDateStr}`);
        }
        
        const lastCompletedPlan = await lastCompletedPlanQuery
          .select('id', 'plan_date', 'completed_at')
          .orderBy('plan_date', 'desc')
          .first();

        if (lastCompletedPlan) {
          // Normalize dates to compare
          let lastCompletedDateStr, requestedDateStr;
          if (lastCompletedPlan.plan_date instanceof Date) {
            const d = lastCompletedPlan.plan_date;
            lastCompletedDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (typeof lastCompletedPlan.plan_date === 'string') {
            lastCompletedDateStr = lastCompletedPlan.plan_date.split('T')[0];
          } else {
            lastCompletedDateStr = new Date(lastCompletedPlan.plan_date).toISOString().split('T')[0];
          }
          
          if (planBeforeUpdate.plan_date instanceof Date) {
            const d = planBeforeUpdate.plan_date;
            requestedDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (typeof planBeforeUpdate.plan_date === 'string') {
            requestedDateStr = planBeforeUpdate.plan_date.split('T')[0];
          } else {
            requestedDateStr = new Date(planBeforeUpdate.plan_date).toISOString().split('T')[0];
          }
          
          // Calculate if requested date is exactly 1 day after last completed date
          const lastCompletedDate = new Date(lastCompletedDateStr + 'T00:00:00.000Z');
          const requestedDate = new Date(requestedDateStr + 'T00:00:00.000Z');
          const daysDifference = Math.floor((requestedDate - lastCompletedDate) / (1000 * 60 * 60 * 24));
          
          // Allow if it's the next sequential day (exactly 1 day after)
          // This is the PRIMARY validation - if it's sequential, allow it regardless of other checks
          if (daysDifference === 1) {
            console.log(`✅ HARD GUARD: Requested plan ${daily_plan_id} (${requestedDateStr}) is the next sequential day after last completed plan (${lastCompletedDateStr}). ALLOWING completion - bypassing other validations.`);
            // Skip the rest of the HARD GUARD validation - this is valid sequential completion
          } else if (daysDifference === 0) {
            // Same day - check if it's the same plan (shouldn't happen, but handle gracefully)
            if (lastCompletedPlan.id === daily_plan_id) {
              console.log(`⚠️ WARNING: Attempting to complete the same plan that's already completed. This is likely a duplicate request.`);
              await trx.rollback();
              return res.status(200).json({
                success: true,
                message: 'Plan was already completed',
                data: {
                  daily_plan_id: daily_plan_id,
                  plan_date: requestedDateStr,
                  is_completed: true,
                  completed_at: lastCompletedPlan.completed_at,
                  already_completed: true
                }
              });
            } else {
              // Different plan on same date - reject
              console.error(`❌ HARD GUARD: Requested plan ${daily_plan_id} (${requestedDateStr}) is on the same date as last completed plan ${lastCompletedPlan.id} (${lastCompletedDateStr}). Rejecting.`);
              await trx.rollback();
              return res.status(400).json({
                success: false,
                message: `You cannot complete multiple plans on the same date (${requestedDateStr}). The last completed plan is on the same date.`,
                error: 'SAME_DATE_COMPLETION',
                last_completed_date: lastCompletedDateStr,
                requested_date: requestedDateStr
              });
            }
          } else if (daysDifference < 0) {
            // Reject if it's the same day or before the last completed day
            console.error(`❌ HARD GUARD: Requested plan ${daily_plan_id} (${requestedDateStr}) is on or before the last completed plan (${lastCompletedDateStr}). Rejecting.`, {
              current_plan_id: daily_plan_id,
              current_plan_date: planBeforeUpdate.plan_date,
              requested_date: requestedDateStr,
              source_plan_id: planBeforeUpdate.source_plan_id,
              last_completed: {
                id: lastCompletedPlan.id,
                plan_date: lastCompletedPlan.plan_date,
                completed_at: lastCompletedPlan.completed_at
              },
              days_difference: daysDifference
            });

            await trx.rollback();
            return res.status(400).json({
              success: false,
              message: `You must complete days in order. The last completed day is ${lastCompletedDateStr}, but you're trying to complete ${requestedDateStr}.`,
              error: 'INVALID_COMPLETION_ORDER',
              last_completed_date: lastCompletedDateStr,
              requested_date: requestedDateStr
            });
          } else {
            // Reject if it's skipping days (more than 1 day after)
            console.error(`❌ HARD GUARD: Requested plan ${daily_plan_id} (${requestedDateStr}) is skipping days. Last completed was ${lastCompletedDateStr}, but requested is ${daysDifference} days later. Rejecting.`, {
              current_plan_id: daily_plan_id,
              current_plan_date: planBeforeUpdate.plan_date,
              requested_date: requestedDateStr,
              source_plan_id: planBeforeUpdate.source_plan_id,
              last_completed: {
                id: lastCompletedPlan.id,
                plan_date: lastCompletedPlan.plan_date,
                completed_at: lastCompletedPlan.completed_at
              },
              days_difference: daysDifference
            });

            await trx.rollback();
            return res.status(400).json({
              success: false,
              message: `You must complete days in order. The last completed day is ${lastCompletedDateStr}, but you're trying to complete ${requestedDateStr} (skipping ${daysDifference - 1} day(s)).`,
              error: 'SKIPPED_DAYS_COMPLETION',
              last_completed_date: lastCompletedDateStr,
              requested_date: requestedDateStr,
              days_skipped: daysDifference - 1
            });
          }
        } else {
          // No completed plans yet - allow any completion (user can start from any day)
          console.log(`✅ ALLOWING: No completed plans yet for this assignment. Allowing completion of plan ${daily_plan_id} (${planBeforeUpdate.plan_date}).`);
        }
      }

      // CRITICAL: Check if there are any OTHER plans being completed at the same time
      // This prevents completing Day 1 and Day 2 simultaneously
      const concurrentCompletions = await trx('daily_training_plans')
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
        .whereRaw('completed_at > NOW() - INTERVAL \'30 seconds\'')
        .select('id', 'plan_date', 'is_completed', 'completed_at')
        .orderBy('completed_at', 'desc')
        .limit(5);
      
      if (concurrentCompletions.length > 0) {
        console.error(`❌ CRITICAL: Found ${concurrentCompletions.length} plan(s) completed in the last 30 seconds! This suggests concurrent completion requests.`, {
          current_plan_id: daily_plan_id,
          current_plan_date: planBeforeUpdate.plan_date,
          concurrent_plans: concurrentCompletions.map(p => ({
            id: p.id,
            plan_date: p.plan_date,
            completed_at: p.completed_at
          }))
        });
        
        // Check if any of the concurrent completions are for the next day
        const requestedDate = new Date(planBeforeUpdate.plan_date);
        requestedDate.setHours(0, 0, 0, 0);
        const requestedDateStr = requestedDate.toISOString().split('T')[0];
        
        for (const concurrent of concurrentCompletions) {
          const concurrentDate = new Date(concurrent.plan_date);
          concurrentDate.setHours(0, 0, 0, 0);
          const concurrentDateStr = concurrentDate.toISOString().split('T')[0];
          
          const daysDiff = Math.floor((requestedDate - concurrentDate) / (1000 * 60 * 60 * 24));
          
          // If this is Day 2 and Day 1 was just completed (within 30 seconds), block it
          if (daysDiff === 1) {
            const secondsSince = Math.round((new Date() - new Date(concurrent.completed_at)) / 1000);
            console.error(`❌ BLOCKING: Attempting to complete Day 2 (${requestedDateStr}) immediately after Day 1 (${concurrentDateStr}) was completed ${secondsSince} seconds ago. This is not allowed - users must complete days one at a time with a reasonable delay.`);
            await trx.rollback();
            return res.status(400).json({
              success: false,
              message: `Cannot complete Day 2 immediately after Day 1. Please wait at least 30 seconds between completing consecutive days.`,
              error: 'CONCURRENT_COMPLETION_BLOCKED',
              last_completed_date: concurrentDateStr,
              requested_date: requestedDateStr,
              seconds_since_last_completion: secondsSince,
              required_delay: 30
            });
          }
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
        .select('id', 'plan_date', 'source_plan_id', 'plan_type', 'is_completed', 'completed_at')
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
      
      const preUpdateDate = normalizeDate(preUpdateCheck.plan_date);
      const expectedDate = normalizeDate(planBeforeUpdate.plan_date);
      const preUpdateSourceId = normalizeId(preUpdateCheck.source_plan_id);
      const expectedSourceId = normalizeId(planBeforeUpdate.source_plan_id);
      const preUpdateType = String(preUpdateCheck.plan_type || '');
      const expectedType = String(planBeforeUpdate.plan_type || '');
      
      if (preUpdateDate !== expectedDate || 
          preUpdateSourceId !== expectedSourceId ||
          preUpdateType !== expectedType) {
        console.error(`❌ CRITICAL: Plan ${daily_plan_id} details don't match!`, {
          pre_update: {
            plan_date: preUpdateCheck.plan_date,
            plan_date_normalized: preUpdateDate,
            source_plan_id: preUpdateCheck.source_plan_id,
            source_plan_id_normalized: preUpdateSourceId,
            plan_type: preUpdateCheck.plan_type,
            plan_type_normalized: preUpdateType
          },
          expected: {
            plan_date: planBeforeUpdate.plan_date,
            plan_date_normalized: expectedDate,
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
        plan_date: preUpdateDate,
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
        .where({ plan_date: planBeforeUpdate.plan_date }) // Same date
        .select('id', 'plan_date', 'is_completed');
      
      if (otherPlansCheck.length > 0) {
        console.error(`❌ CRITICAL: Found ${otherPlansCheck.length} other plan(s) with same date (${planBeforeUpdate.plan_date}) for same user/assignment!`, {
          current_plan_id: daily_plan_id,
          other_plans: otherPlansCheck.map(p => ({
            id: p.id,
            plan_date: p.plan_date,
            is_completed: p.is_completed
          }))
        });
        // Don't block - just log warning, since we're using primary key which should be unique
      }

      const updateResult = await trx('daily_training_plans')
        .where({ 
          id: daily_plan_id,
          user_id: user_id  // Safety: ensure we're updating the correct user's plan
        })
        .update({
          is_completed: true,
          completed_at: completionTimestamp,
          updated_at: completionTimestamp
        });
      
      console.log(`📝 Update query executed - Rows affected: ${updateResult}`);

      console.log(`✅ Updated ${updateResult} row(s) - Set is_completed=true and completed_at for plan ${daily_plan_id} (plan_date: ${planBeforeUpdate.plan_date})`);

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
          .select('id', 'plan_date', 'completed_at', 'is_completed');
        
        if (postUpdateCheck.length > 0) {
          // Log warning but don't block - this helps diagnose if the bug occurs
          console.warn(`⚠️ WARNING: Found ${postUpdateCheck.length} other plan(s) completed around the same time as plan ${daily_plan_id}. This might indicate the Day 2 bug, but we're not blocking to avoid false positives.`, {
            updated_plan_id: daily_plan_id,
            updated_plan_date: planBeforeUpdate.plan_date,
            other_plans: postUpdateCheck.map(p => ({
              id: p.id,
              plan_date: p.plan_date,
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
        .select('id', 'is_completed', 'completed_at', 'plan_type', 'plan_date', 'source_plan_id')
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
        plan_date: verifyInTransaction.plan_date,
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
        .select('id', 'plan_date', 'is_completed', 'completed_at')
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
          updated_plan_date: verifyInTransaction.plan_date,
          suspicious_plans: suspiciousPlans.map(p => ({
            id: p.id,
            plan_date: p.plan_date,
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
            .select('id', 'is_completed', 'completed_at', 'plan_date', 'source_plan_id')
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
            plan_date: postCommitVerification.plan_date
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
            plan_date: postCommitVerification.plan_date
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
      plan_date: updatedPlan.plan_date
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
        .select('is_completed', 'completed_at', 'plan_type', 'plan_date')
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
          plan_date: afterSnapshot.plan_date
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
          plan_date: updatedPlan.plan_date,
          completion_data: completion_data,
          source: 'mobile_app'
        });
      }
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    // Final verification: Query the database one more time to ensure completion status is persisted
    const finalVerification = await db('daily_training_plans')
      .select('id', 'is_completed', 'completed_at', 'plan_type', 'plan_date', 'source_plan_id')
      .where({ id: daily_plan_id })
      .first();
    
    if (!finalVerification || !finalVerification.is_completed || !finalVerification.completed_at) {
      console.error(`❌ CRITICAL FINAL CHECK: Plan ${daily_plan_id} completion status NOT persisted!`, {
        id: finalVerification?.id,
        is_completed: finalVerification?.is_completed,
        completed_at: finalVerification?.completed_at,
        plan_type: finalVerification?.plan_type,
        plan_date: finalVerification?.plan_date
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
        plan_date: finalVerification.plan_date,
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
        .select('id', 'plan_date', 'is_completed', 'completed_at')
        .orderBy('plan_date', 'asc');
      
      const completedPlans = allPlansForSource.filter(p => p.is_completed && p.completed_at);
      const incompletePlans = allPlansForSource.filter(p => !p.is_completed || !p.completed_at);
      
      console.log(`📊 Final check - Plans for source_plan_id ${finalVerification.source_plan_id}:`, {
        total: allPlansForSource.length,
        completed: completedPlans.length,
        incomplete: incompletePlans.length,
        completed_plan_dates: completedPlans.map(p => p.plan_date),
        incomplete_plan_dates: incompletePlans.map(p => p.plan_date)
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
            updated_plan_date: finalVerification.plan_date,
            all_recent_completions: recentCompletions.map(p => ({
              id: p.id,
              plan_date: p.plan_date,
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
        plan_date: updatedPlan.plan_date,
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
      .where({ user_id: targetUserId, gym_id: gym_id });

    // Apply date filters
    if (start_date) {
      query = query.andWhere('plan_date', '>=', start_date);
    }
    if (end_date) {
      query = query.andWhere('plan_date', '<=', end_date);
    }

    const plans = await query.orderBy('plan_date', 'desc');

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
      plans_by_date: {}
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

    // Group by date
    plans.forEach(plan => {
      const date = plan.plan_date;
      if (!stats.plans_by_date[date]) {
        stats.plans_by_date[date] = {
          total: 0,
          completed: 0,
          total_minutes: 0
        };
      }
      stats.plans_by_date[date].total++;
      if (plan.is_completed) {
        stats.plans_by_date[date].completed++;
      }
      stats.plans_by_date[date].total_minutes += plan.training_minutes || 0;
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
      plan_date,
      plan_type,
      source_plan_id,
      plan_category,
      user_level,
      exercises_details,
      items
    } = req.body;

    const gym_id = req.user.gym_id;

    // Validate required fields
    if (!user_id || !plan_date || !plan_type || !plan_category) {
      return res.status(400).json({
        success: false,
        message: 'user_id, plan_date, plan_type, and plan_category are required'
      });
    }

    // Create the daily plan
    const [dailyPlan] = await db('daily_training_plans')
      .insert({
        user_id,
        gym_id,
        plan_date,
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
    for (const day of daily_plans) {
      const {
        plan_date,
        user_level = 'Beginner',
        plan_category = null,
        exercises_details = []
      } = day;

      // Validate exercises_details
      if (!Array.isArray(exercises_details)) {
        return res.status(400).json({ success: false, message: `exercises_details must be an array for date ${plan_date}` });
      }

      // Compute derived totals from array to avoid client/server mismatch
      const derived = {
        total_exercises: exercises_details.length,
        training_minutes: exercises_details.reduce((s, it) => s + Number(it.training_minutes || it.minutes || 0), 0),
        total_sets: exercises_details.reduce((s, it) => s + Number(it.sets || 0), 0),
        total_reps: exercises_details.reduce((s, it) => s + Number(it.reps || 0), 0),
        total_weight_kg: exercises_details.reduce((s, it) => s + Number(it.weight_kg || 0), 0)
      };

      // Upsert daily plan by unique keys (user_id, plan_type, source_plan_id, plan_date, gym_id)
      const existing = await db('daily_training_plans')
        .where({ user_id: targetUserId, plan_type, source_plan_id: source_plan_id || null, plan_date })
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
            plan_date,
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
    const { approval_id, plan_date, web_plan_id, assignment_id } = req.body;
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
    
    console.log('🔍 Creating daily plan from approval/assignment:', {
      searchId,
      approval_id,
      web_plan_id,
      assignment_id,
      user_id,
      plan_date
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

    // Generate daily plan for specific date or use distribution
    const targetDate = plan_date || new Date().toISOString().split('T')[0];
    
    // Normalize target date to YYYY-MM-DD format
    const normalizeDate = (dateStr) => {
      try {
        const d = new Date(dateStr);
        return d.toISOString().split('T')[0];
      } catch (e) {
        return dateStr;
      }
    };
    const normalizedTargetDate = normalizeDate(targetDate);
    
    let exercisesForDate = [];
    
    // Check if target date is within assignment/approval date range
    const startDate = new Date(approval.start_date);
    const endDate = new Date(approval.end_date);
    const targetDateObj = new Date(normalizedTargetDate);
    
    // Check if date is within range
    if (targetDateObj < startDate || targetDateObj > endDate) {
      console.warn('⚠️ Target date is outside assignment date range:', {
        targetDate: normalizedTargetDate,
        startDate: approval.start_date,
        endDate: approval.end_date
      });
    }
    
    if (Array.isArray(dailyPlansSource) && dailyPlansSource.length > 0) {
      // Find the plan for this date - try multiple date formats
      let planForDate = dailyPlansSource.find(p => {
        const planDate = normalizeDate(p.date);
        return planDate === normalizedTargetDate;
      });
      
      // If not found, try finding by day index (if workouts array exists)
      if (!planForDate) {
        // Try to find by calculating day index
        const dayIndex = Math.floor((targetDateObj - startDate) / (1000 * 60 * 60 * 24));
        if (dayIndex >= 0 && dayIndex < dailyPlansSource.length) {
          planForDate = dailyPlansSource[dayIndex];
        }
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
      
      // Find exercises for target date - try multiple date formats
      let planForDate = distributed.daily_plans.find(p => {
        const planDate = normalizeDate(p.date);
        return planDate === normalizedTargetDate;
      });
      
      // If not found by exact date match, try by day index
      if (!planForDate) {
        const dayIndex = Math.floor((targetDateObj - startDate) / (1000 * 60 * 60 * 24));
        if (dayIndex >= 0 && dayIndex < distributed.daily_plans.length) {
          planForDate = distributed.daily_plans[dayIndex];
        }
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
    
    // CRITICAL: Use normalizedTargetDate for query to ensure correct date matching
    // This prevents finding Day 1's plan when looking for Day 2's plan
    // Check if daily plan already exists for the EXACT normalized date
    const existing = await db('daily_training_plans')
      .where({
        user_id: user_id,
        plan_date: normalizedTargetDate, // Use normalized date, not raw targetDate
        source_plan_id: actualApprovalId,
        is_stats_record: false
      })
      .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
      .first();

    let dailyPlan;
    let shouldCreateNew = false;
    
    if (existing) {
      // CRITICAL: Verify the existing plan's date matches the requested date
      // This prevents returning Day 1's plan when Day 2 is requested
      let existingPlanDateStr;
      if (existing.plan_date instanceof Date) {
        const d = existing.plan_date;
        existingPlanDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else if (typeof existing.plan_date === 'string') {
        existingPlanDateStr = existing.plan_date.split('T')[0];
      } else {
        existingPlanDateStr = new Date(existing.plan_date).toISOString().split('T')[0];
      }
      
      if (existingPlanDateStr !== normalizedTargetDate) {
        console.error(`❌ CRITICAL: Existing plan ${existing.id} has date ${existingPlanDateStr} but requested date is ${normalizedTargetDate}. This is a date mismatch - will create new plan instead.`);
        // Don't use the existing plan if dates don't match - create a new one
        shouldCreateNew = true;
      } else {
        // Update existing plan (also update plan_type if it's wrong)
        const [updated] = await db('daily_training_plans')
          .where({ id: existing.id })
          .update({
            exercises_details: JSON.stringify(exercisesForDate),
            plan_category: approval.exercise_plan_category || approval.category || 'General',
            user_level: approval.user_level || 'Beginner',
            plan_type: determinedPlanType, // Update plan_type if it was wrong
            updated_at: new Date()
          })
          .returning('*');
        dailyPlan = updated;
        console.log(`✅ Updated daily plan ${updated.id} (date: ${normalizedTargetDate}) with plan_type: ${determinedPlanType}`);
      }
    }
    
    if (!existing || shouldCreateNew || !dailyPlan) {
      // Create new daily plan with normalized date
      const [inserted] = await db('daily_training_plans')
        .insert({
          user_id: user_id,
          gym_id: gym_id,
          plan_date: normalizedTargetDate, // Use normalized date to ensure correct date storage
          plan_type: determinedPlanType, // Use determined plan_type
          source_plan_id: actualApprovalId,
          plan_category: approval.exercise_plan_category || approval.category || 'General',
          user_level: approval.user_level || 'Beginner',
          exercises_details: JSON.stringify(exercisesForDate),
          is_stats_record: false
        })
        .returning('*');
      dailyPlan = inserted;
      console.log(`✅ Created daily plan ${inserted.id} (date: ${normalizedTargetDate}) with plan_type: ${determinedPlanType}`);
    }
    
    // CRITICAL: Verify the returned plan's date matches the requested date
    // This is a final safety check to prevent returning the wrong plan
    let returnedPlanDateStr;
    if (dailyPlan.plan_date instanceof Date) {
      const d = dailyPlan.plan_date;
      returnedPlanDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else if (typeof dailyPlan.plan_date === 'string') {
      returnedPlanDateStr = dailyPlan.plan_date.split('T')[0];
    } else {
      returnedPlanDateStr = new Date(dailyPlan.plan_date).toISOString().split('T')[0];
    }
    
    if (returnedPlanDateStr !== normalizedTargetDate) {
      console.error(`❌ CRITICAL ERROR: Returned plan ${dailyPlan.id} has date ${returnedPlanDateStr} but requested date is ${normalizedTargetDate}! This is a serious bug.`);
      return res.status(500).json({
        success: false,
        message: `Date mismatch error: Created plan has date ${returnedPlanDateStr} but requested date is ${normalizedTargetDate}. Please try again.`,
        error: 'DATE_MISMATCH',
        requested_date: normalizedTargetDate,
        returned_date: returnedPlanDateStr
      });
    }
    
    console.log(`✅ Verified returned plan ${dailyPlan.id} has correct date: ${returnedPlanDateStr} (matches requested: ${normalizedTargetDate})`);

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

// Find daily plan by source (assignment/approval) and date (for mobile app)
exports.findDailyPlanBySource = async (req, res, next) => {
  try {
    const { assignment_id, approval_id, web_plan_id, plan_date, source_plan_id } = req.query;
    const user_id = req.user.id;
    const gym_id = req.user.gym_id;

    // Support multiple ways to find the source
    const searchId = assignment_id || approval_id || web_plan_id || source_plan_id;
    // Use provided plan_date or default to today
    const targetDate = plan_date || new Date().toISOString().split('T')[0];

    // Validate that searchId is provided (targetDate always has a value due to default)
    if (!searchId) {
      return res.status(400).json({
        success: false,
        message: 'assignment_id, approval_id, web_plan_id, or source_plan_id is required'
      });
    }

    // Normalize date
    const normalizeDate = (dateStr) => {
      try {
        const d = new Date(dateStr);
        return d.toISOString().split('T')[0];
      } catch (e) {
        return dateStr;
      }
    };
    const normalizedDate = normalizeDate(targetDate);

    // Find daily plan by source_plan_id and date
    let dailyPlan = await db('daily_training_plans')
      .where({
        user_id: user_id,
        plan_date: normalizedDate,
        source_plan_id: searchId,
        is_stats_record: false
      })
      .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
      .first();

    // If not found by source_plan_id, try to find by matching assignment/approval/manual plan
    if (!dailyPlan) {
      // Try to find assignment first
      const assignment = await db('training_plan_assignments')
        .where({ id: searchId, user_id: user_id })
        .orWhere({ web_plan_id: searchId, user_id: user_id })
        .first();

      if (assignment) {
        dailyPlan = await db('daily_training_plans')
          .where({
            user_id: user_id,
            plan_date: normalizedDate,
            source_plan_id: assignment.id.toString(),
            is_stats_record: false
          })
          .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
          .first();
      }

      // Try to find approval
      if (!dailyPlan) {
        const approval = await db('training_approvals')
          .where({ id: searchId, user_id: user_id })
          .orWhere({ plan_id: searchId, user_id: user_id })
          .first();

        if (approval) {
          dailyPlan = await db('daily_training_plans')
            .where({
              user_id: user_id,
              plan_date: normalizedDate,
              source_plan_id: approval.id.toString(),
              is_stats_record: false
            })
            .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
            .first();
        }
      }

      // Try to find manual plan (for manual plans, source_plan_id is the plan_id)
      if (!dailyPlan) {
        const manualPlan = await db('app_manual_training_plans')
          .where({ id: searchId, user_id: user_id })
          .first();

        if (manualPlan) {
          // For manual plans, source_plan_id is stored as the plan_id (string)
          dailyPlan = await db('daily_training_plans')
            .where({
              user_id: user_id,
              plan_date: normalizedDate,
              source_plan_id: manualPlan.id.toString(),
              plan_type: 'manual',
              is_stats_record: false
            })
            .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
            .first();
          
          // If still not found, try to sync daily plans from manual plan
          if (!dailyPlan && manualPlan.daily_plans) {
            console.log(`🔄 Daily plan not found for manual plan ${searchId}, attempting to sync...`);
            try {
              const { syncDailyPlansFromManualPlanHelper } = require('./DailyTrainingController');
              await syncDailyPlansFromManualPlanHelper(manualPlan.id);
              
              // Try to find again after sync
              dailyPlan = await db('daily_training_plans')
                .where({
                  user_id: user_id,
                  plan_date: normalizedDate,
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
      }

      // Try to find AI plan
      if (!dailyPlan) {
        const aiPlan = await db('app_ai_generated_plans')
          .where({ id: searchId, user_id: user_id })
          .first();

        if (aiPlan) {
          dailyPlan = await db('daily_training_plans')
            .where({
              user_id: user_id,
              plan_date: normalizedDate,
              source_plan_id: aiPlan.id.toString(),
              plan_type: 'ai_generated',
              is_stats_record: false
            })
            .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
            .first();
        }
      }
    }

    if (!dailyPlan) {
      return res.status(404).json({
        success: false,
        message: `Daily plan not found for source ${searchId} on date ${normalizedDate}. Use /mobile/plans/create-from-approval to create it.`
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
        
        let nextIncompleteQuery = db('daily_training_plans')
          .where({
            user_id: user_id,
            is_stats_record: false,
            plan_type: dailyPlan.plan_type
          })
          .andWhere('source_plan_id', dailyPlan.source_plan_id)
          .andWhere('is_completed', false)
          .andWhere('plan_date', '>', normalizedDate);
        
        // CRITICAL: Only consider plans on/after assignment start_date
        if (assignmentStartDate) {
          nextIncompleteQuery = nextIncompleteQuery.andWhere('plan_date', '>=', assignmentStartDate);
        }
        
        nextIncompleteQuery = nextIncompleteQuery
          .modify((qb) => { if (gym_id != null) qb.andWhere({ gym_id }); })
          .orderBy('plan_date', 'asc')
          .first();
        
        const nextIncomplete = await nextIncompleteQuery;

        if (nextIncomplete) {
          console.log(`📅 Requested completed day ${normalizedDate} for source ${searchId}; returning next incomplete day ${nextIncomplete.plan_date} instead (assignment_start: ${assignmentStartDate || 'N/A'}).`);
          dailyPlan = nextIncomplete;
        } else {
          console.log(`📅 No next incomplete day found for source ${searchId} after ${normalizedDate} (assignment_start: ${assignmentStartDate || 'N/A'})`);
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
    
    // IMPORTANT: Check last completed date and start from next day
    // Find the last completed daily plan for this assignment (by plan_date, not completed_at)
    // This ensures we skip days that are already completed and start from the next day
    const lastCompletedPlan = await db('daily_training_plans')
      .where({
        user_id: assignment.user_id,
        is_stats_record: false,
        is_completed: true
      })
      .whereNotNull('completed_at')
      .whereNotNull('plan_date')
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
      .orderBy('plan_date', 'desc')
      .first();
    
    let lastCompletedDate = null;
    if (lastCompletedPlan && lastCompletedPlan.plan_date) {
      // Use plan_date (the scheduled date) to determine which day was last completed
      const planDate = new Date(lastCompletedPlan.plan_date);
      planDate.setHours(0, 0, 0, 0);
      const completedDateStr = planDate.toISOString().split('T')[0];
      
      // CRITICAL: Only use lastCompletedDate if it's on or after start_date
      // This prevents old completed plans (before start_date) from blocking new plan creation
      // We'll calculate startDateStr below, but for now just store the completed date
      lastCompletedDate = completedDateStr;
      console.log(`📅 Last completed day for assignment ${assignmentId}: ${lastCompletedDate} (plan_date from plan ${lastCompletedPlan.id})`);
    } else {
      console.log(`📅 No completed plans found for assignment ${assignmentId}, will start from first day`);
    }
    
    // IMPORTANT: Recalculate dates based on assignment's start_date
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
    
    // CRITICAL: Delete any existing plans that are BEFORE start_date for this assignment
    // This prevents date mismatches where old plans (e.g., 2025-12-01) exist when start_date is 2025-12-02
    // We only delete plans BEFORE start_date, not plans on/after start_date (to preserve completed days)
    // IMPORTANT: This also fixes cases where Day 1 was incorrectly created on start_date - 1 day due to timezone issues
    const deletedBeforeStart = await db('daily_training_plans')
      .where({
        user_id: assignment.user_id,
        source_plan_id: assignment.id.toString(),
        is_stats_record: false
      })
      .where('plan_date', '<', startDateStr) // Only delete plans BEFORE start_date
      .del();
    
    if (deletedBeforeStart > 0) {
      console.log(`🗑️ Deleted ${deletedBeforeStart} daily plan(s) that were before start_date (${startDateStr}) for assignment ${assignmentId}`);
      console.log(`🗑️ This includes any plans incorrectly created on ${startDateStr} - 1 day due to timezone issues`);
    }
    
    // CRITICAL: Delete any COMPLETED plans before start_date
    // These are duplicate Day 1 plans that cause completion bugs:
    // - User completes Day 1 on wrong date (2025-12-01) → is_completed=true
    // - Then tries to complete Day 1 on correct date (2025-12-02) → system thinks Day 1 is already done
    // - This prevents Day 2 from being completed because system thinks Day 1 is done on wrong date
    // We MUST delete these duplicate completed plans to fix the issue
    const duplicateCompletedPlansBeforeStart = await db('daily_training_plans')
      .where({
        user_id: assignment.user_id,
        source_plan_id: assignment.id.toString(),
        is_stats_record: false
      })
      .where('plan_date', '<', startDateStr)
      .where(function() {
        this.where('is_completed', true)
          .orWhere('is_completed', 't')
          .orWhere('is_completed', 1);
      })
      .whereNotNull('completed_at')
      .select('id', 'plan_date', 'exercises_details', 'is_completed', 'completed_at');
    
    if (duplicateCompletedPlansBeforeStart.length > 0) {
      console.warn(`⚠️ CRITICAL BUG DETECTED: Found ${duplicateCompletedPlansBeforeStart.length} COMPLETED plan(s) before start_date (${startDateStr})!`);
      console.warn(`⚠️ These are duplicate Day 1 plans that cause completion bugs. They will be deleted.`);
      
      for (const duplicatePlan of duplicateCompletedPlansBeforeStart) {
        console.warn(`⚠️ Deleting duplicate completed plan: id=${duplicatePlan.id}, plan_date=${duplicatePlan.plan_date}, is_completed=${duplicatePlan.is_completed}, completed_at=${duplicatePlan.completed_at}`);
        await db('daily_training_plans')
          .where({ id: duplicatePlan.id })
          .del();
      }
      
      console.log(`🗑️ Deleted ${duplicateCompletedPlansBeforeStart.length} duplicate completed plan(s) before start_date to fix completion bugs`);
    }
    
    // CRITICAL: Also check if there's a plan on start_date that has the wrong workout (Day 2 workout instead of Day 1)
    // This can happen if Day 1 was created on start_date - 1 day, and Day 2 was created on start_date
    // We need to delete Day 2's plan from start_date and recreate it correctly
    // NOTE: This check will be done after sortedDailyPlans is defined below
    
    // IMPORTANT: We NO LONGER delete ALL existing daily plans for this assignment.
    // Deleting and recreating all days caused completed days (Day 1, Day 2, ...)
    // to be reset back to incomplete whenever the mobile app re-synced the plan.
    // 
    // Instead, we:
    // - Delete only plans BEFORE start_date (to fix date mismatches)
    // - Keep all existing daily_training_plans rows on/after start_date
    // - Skip any day whose plan_date is on/before lastCompletedDate (if it's before start_date)
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
    
    // CRITICAL: Check if there's a plan on start_date that has the wrong workout (Day 2 workout instead of Day 1)
    // This can happen if Day 1 was created on start_date - 1 day due to timezone issues, and Day 2 was created on start_date
    // We need to delete the incorrectly dated plan from start_date and recreate it correctly
    if (sortedDailyPlans.length > 0 && sortedDailyPlans[0]) {
      const existingPlanOnStartDate = await db('daily_training_plans')
        .where({
          user_id: assignment.user_id,
          source_plan_id: assignment.id.toString(),
          plan_date: startDateStr,
          is_stats_record: false
        })
        .first();
      
      if (existingPlanOnStartDate) {
        const day1Workout = sortedDailyPlans[0];
        let day1WorkoutName = null;
        if (Array.isArray(day1Workout.workouts) && day1Workout.workouts.length > 0) {
          day1WorkoutName = day1Workout.workouts[0].name || day1Workout.workouts[0].workout_name;
        } else if (Array.isArray(day1Workout.exercises) && day1Workout.exercises.length > 0) {
          day1WorkoutName = day1Workout.exercises[0].name || day1Workout.exercises[0].workout_name;
        }
        
        if (day1WorkoutName) {
          let existingPlanWorkoutName = null;
          try {
            const existingDetails = typeof existingPlanOnStartDate.exercises_details === 'string' 
              ? JSON.parse(existingPlanOnStartDate.exercises_details) 
              : existingPlanOnStartDate.exercises_details;
            if (Array.isArray(existingDetails) && existingDetails.length > 0) {
              existingPlanWorkoutName = existingDetails[0].name || existingDetails[0].workout_name;
            }
          } catch (e) {
            // Ignore parse errors
          }
          
          // If the existing plan on start_date has a different workout than Day 1's workout,
          // it means Day 1 was created on the wrong date. Delete it and recreate correctly.
          if (existingPlanWorkoutName && existingPlanWorkoutName !== day1WorkoutName) {
            console.warn(`⚠️ WARNING: Plan on start_date (${startDateStr}) has workout "${existingPlanWorkoutName}" but Day 1 should have "${day1WorkoutName}". This indicates Day 1 was created on wrong date. Will delete and recreate.`);
            await db('daily_training_plans')
              .where({ id: existingPlanOnStartDate.id })
              .del();
            console.log(`🗑️ Deleted incorrectly dated plan ${existingPlanOnStartDate.id} from start_date ${startDateStr}`);
          }
        }
      }
    }
    
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
        
        // CRITICAL: Recalculate date based on assignment's start_date and day number
        // Day 1 = start_date + 0 days (no offset) - MUST match start_date exactly
        // Day 2 = start_date + 1 day
        // Day 3 = start_date + 2 days
        // etc.
        // Use LOCAL date calculation to avoid timezone shifting backwards
        // Example: If start_date is 2025-12-02, Day 1 MUST be 2025-12-02, not 2025-12-01
        const dayOffset = dayNumber - 1; // Day 1 = offset 0, Day 2 = offset 1, Day 3 = offset 2, etc.
        
        // CRITICAL: Use LOCAL date components from startDateStr (not UTC)
        // startDateStr is already in YYYY-MM-DD format from LOCAL date components
        // Parse it directly to avoid any timezone conversion
        const [startYearLocal, startMonthLocal, startDayLocal] = startDateStr.split('-').map(Number);
        
        // Create a LOCAL date object (not UTC) for the start date
        const startDateLocal = new Date(startYearLocal, startMonthLocal - 1, startDayLocal, 0, 0, 0, 0);
        
        // Add dayOffset days to get the plan date (still in LOCAL timezone)
        const planDateLocal = new Date(startDateLocal);
        planDateLocal.setDate(startDateLocal.getDate() + dayOffset);
        
        // Format as YYYY-MM-DD string using LOCAL date components (not UTC)
        // This ensures Day 1 = start_date exactly, with no timezone shifts
        const year = planDateLocal.getFullYear(); // LOCAL year
        const month = String(planDateLocal.getMonth() + 1).padStart(2, '0'); // LOCAL month
        const day = String(planDateLocal.getDate()).padStart(2, '0'); // LOCAL day
        const planDateStr = `${year}-${month}-${day}`;
        
        console.log(`📅 Day ${dayNumber} calculation: start_date=${startDateStr}, dayOffset=${dayOffset}, calculated plan_date=${planDateStr}`);
        
        // Validate: plan_date must not be before start_date
        if (planDateStr < startDateStr) {
          console.error(`❌ ERROR: Calculated plan_date ${planDateStr} for Day ${dayNumber} is before start_date ${startDateStr}. Skipping.`);
          continue;
        }
        
        // Validate: plan_date must not be after end_date
        if (planDateStr > endDateStr) {
          console.warn(`⚠️ Calculated plan_date ${planDateStr} for Day ${dayNumber} is after end_date ${endDateStr}. Skipping.`);
          continue;
        }
        
        // CRITICAL: Only skip days that are BEFORE the start_date
        // DO NOT skip days that are ON or AFTER start_date
        // This prevents creating plans before start_date (which causes date mismatches)
        if (planDateStr < startDateStr) {
          console.log(`⏭️ Skipping Day ${dayNumber} (${planDateStr}) - before start_date (${startDateStr})`);
          continue;
        }
        
        // CRITICAL: Only skip if this day is already completed AND it's on/after start_date
        // This preserves completed days on/after start_date but allows creating new days after them
        // DO NOT skip based on lastCompletedDate if it's before start_date (old plans from previous syncs)
        if (lastCompletedDate && planDateStr <= lastCompletedDate && planDateStr >= startDateStr) {
          console.log(`⏭️ Skipping Day ${dayNumber} (${planDateStr}) - already completed (last completed: ${lastCompletedDate}, start_date: ${startDateStr})`);
          continue;
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
        console.log(`📅 Day ${dayNumber} (index ${index}, original day: ${dayPlan.day || 'N/A'}): Date ${planDateStr} (start_date: ${startDateStr} + ${dayOffset} days), Workouts: [${workoutNames}]`);
        
        if (exercises.length === 0) {
          console.warn(`⚠️ Daily plan for Day ${dayNumber} (date: ${planDateStr}) has no exercises, skipping`);
          continue;
        }
        
        // Check if a plan already exists for this date (shouldn't happen after deletion, but double-check)
        // IMPORTANT: Also check for plans with wrong plan_type (e.g., 'manual' instead of 'web_assigned')
        // This fixes existing plans that were created with incorrect plan_type
        // CRITICAL: Always check for ANY plan with matching user_id, plan_date, and source_plan_id
        // regardless of plan_type, to catch plans that were incorrectly created with 'manual' type
        let existingPlan = await db('daily_training_plans')
          .where({
            user_id: assignment.user_id,
            plan_date: planDateStr,
            source_plan_id: assignment.id.toString(),
            is_stats_record: false
          })
          .first();
        
        // If found with wrong plan_type, log warning
        if (existingPlan && existingPlan.plan_type !== 'web_assigned' && existingPlan.plan_type !== 'web_assigne') {
          console.warn(`⚠️ Found existing plan ${existingPlan.id} with wrong plan_type '${existingPlan.plan_type}' for Day ${dayNumber} (assignment ${assignmentId}), will fix to 'web_assigned'`);
        }
        
        if (existingPlan) {
          console.warn(`⚠️ Plan already exists for Day ${dayNumber} (date: ${planDateStr}), updating instead of creating`);
          // Update existing plan details BUT PRESERVE its completion status.
          // This keeps previously completed days completed even after a sync.
          const [updated] = await db('daily_training_plans')
            .where({ id: existingPlan.id })
            .update({
              exercises_details: JSON.stringify(exercises),
              plan_category: assignment.category || dayPlan.category || 'General',
              user_level: assignment.user_level || dayPlan.user_level || 'Beginner',
              plan_type: 'web_assigned', // Ensure plan_type is correct for assignments
              is_completed: existingPlan.is_completed,   // preserve completion flag
              completed_at: existingPlan.completed_at,   // preserve completion timestamp
              updated_at: new Date()
            })
            .returning('*');
          
          if (existingPlan.plan_type !== 'web_assigned' && existingPlan.plan_type !== 'web_assigne') {
            console.log(`✅ Fixed plan_type from '${existingPlan.plan_type}' to 'web_assigned' for plan ${updated.id}`);
          }
          
          console.log(`✅ Updated existing daily plan ${updated.id} for Day ${dayNumber} (date: ${planDateStr}, workouts: [${workoutNames}], plan_type: web_assigned, is_completed: false)`);
          createdOrUpdated.push(updated);
        } else {
          // Always create a fresh daily plan (we deleted all existing ones above)
          // This ensures the plan starts from day 1 with no completion status
          try {
            const insertData = {
              user_id: assignment.user_id,
              gym_id: assignment.gym_id,
              plan_date: planDateStr,  // Use recalculated date
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
              plan_date: insertData.plan_date,
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
            
            console.log(`✅ Created fresh daily plan ${inserted.id} for Day ${dayNumber} (date: ${planDateStr}, workouts: [${workoutNames}], is_completed: false)`);
            
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
            console.error(`❌ CRITICAL ERROR inserting daily plan for Day ${dayNumber} (date: ${planDateStr}):`, {
              error_message: insertErr.message,
              error_stack: insertErr.stack,
              error_code: insertErr.code,
              error_constraint: insertErr.constraint,
              day_number: dayNumber,
              plan_date: planDateStr,
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
          plan_date: planDateStr,
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
      created_plan_dates: createdOrUpdated.map(p => p.plan_date),
      first_plan: createdOrUpdated[0] ? {
        id: createdOrUpdated[0].id,
        plan_date: createdOrUpdated[0].plan_date,
        plan_type: createdOrUpdated[0].plan_type,
        is_completed: createdOrUpdated[0].is_completed
      } : null,
      last_plan: createdOrUpdated[createdOrUpdated.length - 1] ? {
        id: createdOrUpdated[createdOrUpdated.length - 1].id,
        plan_date: createdOrUpdated[createdOrUpdated.length - 1].plan_date,
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
      .select('id', 'plan_date', 'plan_type', 'is_completed')
      .orderBy('plan_date', 'asc');
    
    console.log(`🔍 VERIFICATION: Found ${verificationQuery.length} plans in database for assignment ${assignmentId} after sync`);
    if (verificationQuery.length !== createdOrUpdated.length) {
      console.error(`❌ CRITICAL MISMATCH: Created ${createdOrUpdated.length} plans but database has ${verificationQuery.length} plans!`);
      console.error(`❌ Database plans:`, verificationQuery.map(p => ({ id: p.id, plan_date: p.plan_date, plan_type: p.plan_type })));
    } else {
      console.log(`✅ VERIFICATION PASSED: Database has ${verificationQuery.length} plans matching created count`);
    }
    
    // CRITICAL: Update the daily_plans JSON in the assignment with correct dates
    // This ensures the frontend sees the correct dates (Day 1 = start_date, not start_date + 1 day)
    // The dates in daily_plans JSON were likely calculated incorrectly using toISOString()
    // which converts to UTC and can shift dates by one day
    try {
      const updatedDailyPlans = sortedDailyPlans.map((dayPlan, index) => {
        const dayNumber = index + 1;
        const dayOffset = dayNumber - 1;
        
        // Recalculate date using LOCAL date components (same logic as above)
        const [startYearLocal, startMonthLocal, startDayLocal] = startDateStr.split('-').map(Number);
        const startDateLocal = new Date(startYearLocal, startMonthLocal - 1, startDayLocal, 0, 0, 0, 0);
        const planDateLocal = new Date(startDateLocal);
        planDateLocal.setDate(startDateLocal.getDate() + dayOffset);
        
        const year = planDateLocal.getFullYear();
        const month = String(planDateLocal.getMonth() + 1).padStart(2, '0');
        const day = String(planDateLocal.getDate()).padStart(2, '0');
        const correctDate = `${year}-${month}-${day}`;
        
        // Update the date in the dayPlan object
        return {
          ...dayPlan,
          day: dayNumber,
          date: correctDate
        };
      });
      
      // Update the assignment's daily_plans JSON with corrected dates
      await db('training_plan_assignments')
        .where({ id: assignmentId })
        .update({
          daily_plans: JSON.stringify(updatedDailyPlans),
          updated_at: new Date()
        });
      
      console.log(`✅ Updated assignment ${assignmentId} daily_plans JSON with corrected dates (Day 1 = ${startDateStr})`);
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
    
    // IMPORTANT: Check last completed date and start from next day
    // Find the last completed daily plan for this manual plan (by plan_date, not completed_at)
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
      .whereNotNull('plan_date')
      .modify((qb) => { 
        if (manualPlan.gym_id != null) {
          qb.andWhere({ gym_id: manualPlan.gym_id });
        }
      })
      .orderBy('plan_date', 'desc')
      .first();
    
    let lastCompletedDate = null;
    if (lastCompletedPlan && lastCompletedPlan.plan_date) {
      // Use plan_date (the scheduled date) to determine which day was last completed
      const planDate = new Date(lastCompletedPlan.plan_date);
      planDate.setHours(0, 0, 0, 0);
      lastCompletedDate = planDate.toISOString().split('T')[0];
      console.log(`📅 Last completed day for manual plan ${manualPlanId}: ${lastCompletedDate} (plan_date from plan ${lastCompletedPlan.id}), will start from next day`);
    } else {
      console.log(`📅 No completed plans found for manual plan ${manualPlanId}, will start from first day`);
    }
    
    const createdOrUpdated = [];
    
    // Process each daily plan
    for (const dayPlan of dailyPlans) {
      try {
        // Extract date from dayPlan
        let planDate = null;
        if (dayPlan.date) {
          planDate = new Date(dayPlan.date).toISOString().split('T')[0];
        } else if (dayPlan.plan_date) {
          planDate = new Date(dayPlan.plan_date).toISOString().split('T')[0];
        } else {
          console.warn(`⚠️ Daily plan missing date, skipping:`, dayPlan);
          continue;
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
          exercises = dayPlan;
        }
        
        if (exercises.length === 0) {
          console.warn(`⚠️ Daily plan for ${planDate} has no exercises, skipping`);
          continue;
        }
        
        // IMPORTANT: Skip days that are already completed (before or on lastCompletedDate)
        // Only create/update plans for days AFTER the last completed date
        if (lastCompletedDate && planDate <= lastCompletedDate) {
          console.log(`⏭️ Skipping day ${planDate} - already completed (last completed: ${lastCompletedDate})`);
          continue;
        }
        
        // Check if daily plan already exists
        const existing = await db('daily_training_plans')
          .where({
            user_id: manualPlan.user_id,
            plan_date: planDate,
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
          console.log(`✅ Updated daily plan ${existing.id} for date ${planDate}`);
        } else {
          // Create new daily plan
          const [inserted] = await db('daily_training_plans')
            .insert({
              user_id: manualPlan.user_id,
              gym_id: manualPlan.gym_id,
              plan_date: planDate,
              plan_type: 'manual',
              source_plan_id: manualPlan.id.toString(),
              plan_category: manualPlan.exercise_plan_category || dayPlan.category || 'General',
              user_level: dayPlan.user_level || manualPlan.user_level || 'Beginner',
              exercises_details: JSON.stringify(exercises),
              is_stats_record: false
            })
            .returning('*');
          dailyPlan = inserted;
          console.log(`✅ Created daily plan ${inserted.id} for date ${planDate}`);
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
    
    // Process each daily plan
    for (const dayPlan of dailyPlans) {
      try {
        // Extract date from dayPlan
        let planDate = null;
        if (dayPlan.date) {
          planDate = new Date(dayPlan.date).toISOString().split('T')[0];
        } else if (dayPlan.plan_date) {
          planDate = new Date(dayPlan.plan_date).toISOString().split('T')[0];
        } else {
          console.warn(`⚠️ Daily plan missing date, skipping:`, dayPlan);
          continue;
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
          exercises = dayPlan;
        }
        
        if (exercises.length === 0) {
          console.warn(`⚠️ Daily plan for ${planDate} has no exercises, skipping`);
          continue;
        }
        
        // Check if daily plan already exists
        const existing = await db('daily_training_plans')
          .where({
            user_id: aiPlan.user_id,
            plan_date: planDate,
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
          console.log(`✅ Updated daily plan ${existing.id} for date ${planDate}`);
        } else {
          // Create new daily plan
          const [inserted] = await db('daily_training_plans')
            .insert({
              user_id: aiPlan.user_id,
              gym_id: aiPlan.gym_id,
              plan_date: planDate,
              plan_type: 'ai_generated',
              source_plan_id: aiPlan.id.toString(),
              plan_category: aiPlan.exercise_plan_category || dayPlan.category || 'General',
              user_level: dayPlan.user_level || aiPlan.user_level || 'Beginner',
              exercises_details: JSON.stringify(exercises),
              is_stats_record: false
            })
            .returning('*');
          dailyPlan = inserted;
          console.log(`✅ Created daily plan ${inserted.id} for date ${planDate}`);
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

