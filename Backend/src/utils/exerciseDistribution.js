/**
 * Smart Exercise Distribution Logic
 * Distributes exercises across days based on intensity and cycling rules
 */

/**
 * Calculate average intensity based on total training minutes and number of exercises
 * @param {number} totalMinutes - Total training minutes
 * @param {number} exerciseCount - Number of exercises
 * @returns {number} Average minutes per exercise
 */
function calculateAverageIntensity(totalMinutes, exerciseCount) {
  if (exerciseCount === 0) return 0;
  return totalMinutes / exerciseCount;
}

/**
 * Determine workout density based on total minutes per day
 * Rule: If total minutes per day > 80, show 1 workout/day
 *       If total minutes per day <= 80, show 2 workouts/day
 * @param {Array} exercises - Array of exercises
 * @param {number} workoutsPerDay - Proposed number of workouts per day
 * @returns {number} Number of workouts per day (adjusted based on 80-minute rule)
 */
function getWorkoutDensity(exercises, workoutsPerDay = 2) {
  // Calculate average minutes per exercise
  const totalMinutes = exercises.reduce((sum, exercise) => {
    return sum + (exercise.training_minutes || exercise.minutes || 0);
  }, 0);
  
  if (exercises.length === 0) return 1;
  
  const avgMinutesPerExercise = totalMinutes / exercises.length;
  
  // Calculate total minutes if we use the proposed workoutsPerDay
  // Estimate: if we have N exercises and want X workouts/day, we'll distribute them
  // For simplicity, calculate based on average minutes per exercise
  const estimatedTotalMinutesPerDay = avgMinutesPerExercise * workoutsPerDay;
  
  // Apply the 80-minute rule
  if (estimatedTotalMinutesPerDay > 80) {
    return 1; // If exceeding 80 minutes, use 1 workout/day
  } else {
    return 2; // If <= 80 minutes, use 2 workouts/day
  }
}

/**
 * Distribute exercises across days using round-robin cycling
 * @param {Array} exercises - Array of exercises
 * @param {number} totalDays - Total number of days
 * @param {number} workoutsPerDay - Number of workouts per day
 * @returns {Array} Array of daily plans
 */
function distributeExercises(exercises, totalDays, workoutsPerDay) {
  if (!exercises || exercises.length === 0 || totalDays <= 0) {
    return [];
  }

  const dailyPlans = [];
  let exerciseIndex = 0;

  for (let day = 1; day <= totalDays; day++) {
    const dayWorkouts = [];
    const usedExerciseIds = new Set(); // Track exercise IDs used in this day
    
    // Calculate rotation offset for this day to ensure proper cycling
    // This ensures exercises rotate across days: Day 1 starts at index 0, Day 2 starts at index workoutsPerDay, etc.
    const dayRotationOffset = ((day - 1) * workoutsPerDay) % exercises.length;
    let currentExerciseIndex = dayRotationOffset;

    // Add workouts for this day - enforce 80-minute rule
    const MAX_MINUTES_PER_DAY = 80;
    let dayTotalMinutes = 0;
    let shouldStop = false; // Flag to stop adding workouts
    
    for (let workout = 0; workout < workoutsPerDay && !shouldStop; workout++) {
      // Check if adding another workout would exceed 80 minutes
      if (dayTotalMinutes >= MAX_MINUTES_PER_DAY && dayWorkouts.length > 0) {
        shouldStop = true; // Stop adding workouts if we've reached 80 minutes
        break;
      }
      
      // Find next available exercise (round-robin with rotation offset and no repetition within same day)
      let attempts = 0;
      let selectedExercise = null;
      let startIndex = currentExerciseIndex;
      
      while (attempts < exercises.length && !selectedExercise && !shouldStop) {
        const currentIndex = (startIndex + attempts) % exercises.length;
        const exercise = exercises[currentIndex];
        const exerciseId = exercise.id || exercise.name || exercise.workout_name || currentIndex;
        
        // Check if this exercise is already used in this day
        if (!usedExerciseIds.has(exerciseId)) {
          const exerciseMinutes = exercise.training_minutes || exercise.minutes || 0;
          // Check if adding this exercise would exceed 80 minutes
          if (dayTotalMinutes + exerciseMinutes > MAX_MINUTES_PER_DAY && dayWorkouts.length > 0) {
            shouldStop = true; // Stop if adding would exceed 80 minutes and we already have at least 1 workout
            break;
          }
          selectedExercise = exercise;
          usedExerciseIds.add(exerciseId);
          currentExerciseIndex = (currentIndex + 1) % exercises.length;
          break;
        }
        
        attempts++;
      }

      // If we couldn't find a unique exercise and we have fewer exercises than workouts per day,
      // we need to repeat some exercises (but still try to minimize repetition)
      if (!selectedExercise && !shouldStop && exercises.length > 0) {
        // Use the exercise that was used least recently in this day
        const leastUsedIndex = (currentExerciseIndex) % exercises.length;
        const candidateExercise = exercises[leastUsedIndex];
        const candidateMinutes = candidateExercise.training_minutes || candidateExercise.minutes || 0;
        
        // Check if adding this exercise would exceed 80 minutes
        if (dayTotalMinutes + candidateMinutes <= MAX_MINUTES_PER_DAY || dayWorkouts.length === 0) {
          selectedExercise = candidateExercise;
          currentExerciseIndex = (leastUsedIndex + 1) % exercises.length;
          // Add to used set to track repetition
          usedExerciseIds.add(selectedExercise.id || selectedExercise.name || selectedExercise.workout_name || leastUsedIndex);
        } else {
          shouldStop = true; // Stop if adding would exceed 80 minutes
          break;
        }
      }

      if (selectedExercise && !shouldStop) {
        const exerciseMinutes = selectedExercise.training_minutes || selectedExercise.minutes || 0;
        dayWorkouts.push(selectedExercise);
        dayTotalMinutes += exerciseMinutes;
      }
    }

    // Safety constraint: Ensure at least 1 exercise per day
    if (dayWorkouts.length === 0 && exercises.length > 0) {
      // Use rotation offset to pick the first exercise
      const safeIndex = dayRotationOffset % exercises.length;
      dayWorkouts.push(exercises[safeIndex]);
    }

    // Update global exerciseIndex for next day's starting point
    exerciseIndex = currentExerciseIndex;

    // Calculate totals for this day
    const totalWorkouts = dayWorkouts.length;
    const totalMinutes = dayWorkouts.reduce((sum, workout) => {
      return sum + (workout.training_minutes || workout.minutes || 0);
    }, 0);

    dailyPlans.push({
      day: day,
      date: null, // Will be set by caller
      workouts: dayWorkouts,
      total_workouts: totalWorkouts,
      total_minutes: totalMinutes
    });
  }

  return dailyPlans;
}

/**
 * Main function to create distributed daily plans
 * @param {Object} planData - Plan data containing exercises and metadata
 * @param {Date} startDate - Start date of the plan
 * @param {Date} endDate - End date of the plan
 * @returns {Object} Enhanced plan data with distributed daily plans
 */
function createDistributedPlan(planData, startDate, endDate) {
  const exercises = planData.items || planData.exercises || [];
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  
  if (exercises.length === 0) {
    return {
      ...planData,
      daily_plans: [],
      total_days: totalDays
    };
  }

  // Calculate total minutes for all exercises
  const totalMinutes = exercises.reduce((sum, exercise) => {
    return sum + (exercise.training_minutes || exercise.minutes || 0);
  }, 0);
  
  const avgIntensity = calculateAverageIntensity(totalMinutes, exercises.length);
  
  // Determine workout density based on 80-minute rule
  // Calculate average minutes per exercise
  const avgMinutesPerExercise = exercises.length > 0 ? totalMinutes / exercises.length : 0;
  
  // Estimate total minutes per day with 2 workouts
  // If we have 2 exercises and each is 45 minutes, that's 90 minutes total (> 80)
  // So we need to check: if avgMinutesPerExercise * 2 > 80, use 1 workout
  const estimatedMinutesWith2Workouts = avgMinutesPerExercise * 2;
  
  // Apply 80-minute rule: if > 80 minutes with 2 workouts, use 1 workout
  // IMPORTANT: The rule is based on PER DAY total minutes, not per workout
  // If 2 workouts would exceed 80 minutes total, use 1 workout
  // If 2 workouts <= 80 minutes total, use 2 workouts
  let workoutsPerDay;
  if (estimatedMinutesWith2Workouts > 80) {
    workoutsPerDay = 1; // If 2 workouts would exceed 80 minutes, use 1 workout
    console.log(`80-minute rule applied: ${estimatedMinutesWith2Workouts.toFixed(1)} minutes with 2 workouts > 80, using 1 workout/day`);
  } else {
    workoutsPerDay = 2; // If 2 workouts <= 80 minutes, use 2 workouts
    console.log(`80-minute rule applied: ${estimatedMinutesWith2Workouts.toFixed(1)} minutes with 2 workouts <= 80, using 2 workouts/day`);
  }
  
  console.log(`Distribution calculation: totalMinutes=${totalMinutes}, avgMinutesPerExercise=${avgMinutesPerExercise.toFixed(1)}, estimatedWith2Workouts=${estimatedMinutesWith2Workouts.toFixed(1)}, workoutsPerDay=${workoutsPerDay}`);
  
  // Distribute exercises
  const dailyPlans = distributeExercises(exercises, totalDays, workoutsPerDay);
  
  // Set dates for each day
  dailyPlans.forEach((dayPlan, index) => {
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + index);
    dayPlan.date = dayDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  });

  return {
    ...planData,
    daily_plans: dailyPlans,
    total_days: totalDays,
    total_exercises: exercises.length,
    total_training_minutes: totalMinutes,
    avg_intensity: avgIntensity,
    workouts_per_day: workoutsPerDay
  };
}

/**
 * Validate distribution constraints
 * @param {Array} dailyPlans - Array of daily plans
 * @returns {Object} Validation result
 */
function validateDistribution(dailyPlans) {
  const issues = [];
  
  dailyPlans.forEach((dayPlan, index) => {
    // Check minimum exercises per day
    if (dayPlan.workouts.length < 1) {
      issues.push(`Day ${index + 1}: Has no exercises (minimum 1 required)`);
    }
    
    // Check maximum exercises per day
    if (dayPlan.workouts.length > 3) {
      issues.push(`Day ${index + 1}: Has ${dayPlan.workouts.length} exercises (maximum 3 allowed)`);
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues: issues
  };
}

module.exports = {
  createDistributedPlan,
  validateDistribution,
  calculateAverageIntensity,
  getWorkoutDensity,
  distributeExercises
};
