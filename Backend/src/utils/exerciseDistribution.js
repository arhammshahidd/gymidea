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
 * Determine workout density based on average intensity
 * @param {number} avgIntensity - Average minutes per exercise
 * @returns {number} Number of workouts per day
 */
function getWorkoutDensity(avgIntensity) {
  if (avgIntensity < 50) {
    return 3; // Low intensity: 3 workouts/day
  } else if (avgIntensity >= 50 && avgIntensity < 80) {
    return 2; // Medium intensity: 2 workouts/day
  } else {
    return 1; // High intensity: 1 workout/day
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

    // Add workouts for this day
    for (let workout = 0; workout < workoutsPerDay && dayWorkouts.length < 3; workout++) {
      // Find next available exercise (round-robin with rotation offset and no repetition within same day)
      let attempts = 0;
      let selectedExercise = null;
      let startIndex = currentExerciseIndex;
      
      while (attempts < exercises.length && !selectedExercise) {
        const currentIndex = (startIndex + attempts) % exercises.length;
        const exercise = exercises[currentIndex];
        const exerciseId = exercise.id || exercise.name || exercise.workout_name || currentIndex;
        
        // Check if this exercise is already used in this day
        if (!usedExerciseIds.has(exerciseId)) {
          selectedExercise = exercise;
          usedExerciseIds.add(exerciseId);
          currentExerciseIndex = (currentIndex + 1) % exercises.length;
          break;
        }
        
        attempts++;
      }

      // If we couldn't find a unique exercise and we have fewer exercises than workouts per day,
      // we need to repeat some exercises (but still try to minimize repetition)
      if (!selectedExercise && exercises.length > 0) {
        // Use the exercise that was used least recently in this day
        const leastUsedIndex = (currentExerciseIndex) % exercises.length;
        selectedExercise = exercises[leastUsedIndex];
        currentExerciseIndex = (leastUsedIndex + 1) % exercises.length;
        // Add to used set to track repetition
        usedExerciseIds.add(selectedExercise.id || selectedExercise.name || selectedExercise.workout_name || leastUsedIndex);
      }

      if (selectedExercise) {
        dayWorkouts.push(selectedExercise);
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

  // Calculate average intensity
  const totalMinutes = exercises.reduce((sum, exercise) => {
    return sum + (exercise.training_minutes || exercise.minutes || 0);
  }, 0);
  
  const avgIntensity = calculateAverageIntensity(totalMinutes, exercises.length);
  
  // Determine workout density
  const workoutsPerDay = getWorkoutDensity(avgIntensity);
  
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
