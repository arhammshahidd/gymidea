const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testUser = {
  user_id: 1,
  start_date: '2025-01-08',
  end_date: '2025-01-12',
  plan_category: 'Muscle Building'
};

const testTrainingExercises = [
  {
    exercise_name: 'Push-ups',
    sets: 3,
    reps: 15,
    weight_kg: 0,
    minutes: 5,
    exercise_type: 'Bodyweight'
  },
  {
    exercise_name: 'Squats',
    sets: 3,
    reps: 20,
    weight_kg: 0,
    minutes: 5,
    exercise_type: 'Bodyweight'
  },
  {
    exercise_name: 'Plank',
    sets: 3,
    reps: 1,
    weight_kg: 0,
    minutes: 1,
    exercise_type: 'Core'
  }
];

const testNutritionMeals = [
  {
    meal_type: 'Breakfast',
    food_item_name: 'Oatmeal',
    grams: 100,
    calories: 350,
    proteins: 12,
    fats: 6,
    carbs: 60
  },
  {
    meal_type: 'Lunch',
    food_item_name: 'Grilled Chicken',
    grams: 150,
    calories: 250,
    proteins: 45,
    fats: 5,
    carbs: 0
  },
  {
    meal_type: 'Dinner',
    food_item_name: 'Salmon',
    grams: 120,
    calories: 200,
    proteins: 35,
    fats: 8,
    carbs: 0
  }
];

async function testDailyPlans() {
  try {
    console.log('🧪 Testing Daily Plans API...\n');

    // Test 1: Create daily training plans
    console.log('1. Creating daily training plans...');
    const trainingResponse = await axios.post(`${BASE_URL}/dailyPlans/training`, {
      ...testUser,
      exercises: testTrainingExercises
    });
    console.log('✅ Training plans created:', trainingResponse.data.message);
    console.log('   Plans created:', trainingResponse.data.data.length);

    // Test 2: Create daily nutrition plans
    console.log('\n2. Creating daily nutrition plans...');
    const nutritionResponse = await axios.post(`${BASE_URL}/dailyPlans/nutrition`, {
      ...testUser,
      meals: testNutritionMeals
    });
    console.log('✅ Nutrition plans created:', nutritionResponse.data.message);
    console.log('   Plans created:', nutritionResponse.data.data.length);

    // Test 3: Get user's daily plans
    console.log('\n3. Getting user daily plans...');
    const userPlansResponse = await axios.get(`${BASE_URL}/dailyPlans/user/${testUser.user_id}?start_date=${testUser.start_date}&end_date=${testUser.end_date}`);
    console.log('✅ User plans retrieved');
    console.log('   Training plans:', userPlansResponse.data.data.training_plans.length);
    console.log('   Nutrition plans:', userPlansResponse.data.data.nutrition_plans.length);

    // Test 4: Get today's plans
    console.log('\n4. Getting today\'s plans...');
    const todaysPlansResponse = await axios.get(`${BASE_URL}/dailyPlans/today/${testUser.user_id}`);
    console.log('✅ Today\'s plans retrieved');
    console.log('   Has training plan:', !!todaysPlansResponse.data.data.training_plan);
    console.log('   Has nutrition plan:', !!todaysPlansResponse.data.data.nutrition_plan);

    // Test 5: Update plan completion
    if (userPlansResponse.data.data.training_plans.length > 0) {
      console.log('\n5. Updating plan completion...');
      const firstTrainingPlan = userPlansResponse.data.data.training_plans[0];
      const completionResponse = await axios.patch(`${BASE_URL}/dailyPlans/completion`, {
        plan_id: firstTrainingPlan.id,
        plan_type: 'training',
        is_completed: true,
        completion_notes: 'Completed all exercises successfully!'
      });
      console.log('✅ Plan completion updated:', completionResponse.data.message);
    }

    console.log('\n🎉 All tests passed! Daily plans system is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testDailyPlans();
