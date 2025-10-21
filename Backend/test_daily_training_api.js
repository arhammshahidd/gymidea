const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_TOKEN = 'your_test_jwt_token_here'; // Replace with actual token

// Test data
const testDailyPlan = {
  user_id: 1,
  plan_date: '2025-01-08',
  plan_type: 'manual',
  source_plan_id: 123,
  plan_category: 'Chest',
  workout_name: 'Chest Day',
  total_exercises: 3,
  training_minutes: 60,
  total_sets: 9,
  total_reps: 108,
  total_weight_kg: 120.00,
  user_level: 'Beginner',
  items: [
    {
      exercise_name: 'Bench Press',
      sets: 3,
      reps: 12,
      weight_kg: 40.00,
      minutes: 20,
      exercise_type: 'Strength',
      notes: null
    },
    {
      exercise_name: 'Incline Dumbbell Press',
      sets: 3,
      reps: 10,
      weight_kg: 30.00,
      minutes: 20,
      exercise_type: 'Strength',
      notes: null
    }
  ]
};

const testCompletionData = {
  daily_plan_id: 1, // This would be the actual ID from the created plan
  completion_data: [
    {
      item_id: 1, // This would be the actual item ID
      sets_completed: 3,
      reps_completed: 12,
      weight_used: 45.5,
      minutes_spent: 25,
      notes: 'Felt good today, increased weight'
    },
    {
      item_id: 2, // This would be the actual item ID
      sets_completed: 3,
      reps_completed: 10,
      weight_used: 35.0,
      minutes_spent: 20,
      notes: 'Good form maintained'
    }
  ]
};

// Test functions
async function testGetDailyPlans() {
  try {
    console.log('Testing GET /api/dailyTraining/mobile/plans...');
    const response = await axios.get(`${BASE_URL}/dailyTraining/mobile/plans`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });
    console.log('✅ Get daily plans successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Get daily plans failed:', error.response?.data || error.message);
  }
}

async function testGetDailyPlanById(planId) {
  try {
    console.log(`Testing GET /api/dailyTraining/mobile/plans/${planId}...`);
    const response = await axios.get(`${BASE_URL}/dailyTraining/mobile/plans/${planId}`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });
    console.log('✅ Get daily plan by ID successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Get daily plan by ID failed:', error.response?.data || error.message);
  }
}

async function testCreateDailyPlan() {
  try {
    console.log('Testing POST /api/dailyTraining/plans (create)...');
    const response = await axios.post(`${BASE_URL}/dailyTraining/plans`, testDailyPlan, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Create daily plan successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Create daily plan failed:', error.response?.data || error.message);
  }
}

async function testSubmitCompletion() {
  try {
    console.log('Testing POST /api/dailyTraining/mobile/complete...');
    const response = await axios.post(`${BASE_URL}/dailyTraining/mobile/complete`, testCompletionData, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Submit completion successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Submit completion failed:', error.response?.data || error.message);
  }
}

async function testGetTrainingStats() {
  try {
    console.log('Testing GET /api/dailyTraining/mobile/stats...');
    const response = await axios.get(`${BASE_URL}/dailyTraining/mobile/stats`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });
    console.log('✅ Get training stats successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Get training stats failed:', error.response?.data || error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Daily Training API Tests...\n');
  
  if (TEST_TOKEN === 'your_test_jwt_token_here') {
    console.log('⚠️  Please update TEST_TOKEN with a valid JWT token before running tests');
    return;
  }
  
  try {
    // Test 1: Get daily plans
    await testGetDailyPlans();
    console.log('');
    
    // Test 2: Create a daily plan (admin/trainer only)
    const createdPlan = await testCreateDailyPlan();
    console.log('');
    
    // Test 3: Get specific plan if one was created
    if (createdPlan && createdPlan.data && createdPlan.data.id) {
      await testGetDailyPlanById(createdPlan.data.id);
      console.log('');
    }
    
    // Test 4: Submit completion
    await testSubmitCompletion();
    console.log('');
    
    // Test 5: Get training stats
    await testGetTrainingStats();
    console.log('');
    
    console.log('✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Example payload structures for documentation
function showPayloadExamples() {
  console.log('📋 Daily Training API Payload Examples:\n');
  
  console.log('1. Create Daily Plan Payload:');
  console.log(JSON.stringify(testDailyPlan, null, 2));
  console.log('');
  
  console.log('2. Submit Completion Payload:');
  console.log(JSON.stringify(testCompletionData, null, 2));
  console.log('');
  
  console.log('3. Expected Response Structure:');
  console.log(JSON.stringify({
    success: true,
    data: {
      id: 1,
      user_id: 456,
      plan_date: "2025-01-08",
      plan_category: "Chest",
      is_completed: false,
      items: [
        {
          id: 1,
          exercise_name: "Bench Press",
          sets: 3,
          reps: 12,
          weight_kg: 40.00,
          is_completed: false
        }
      ]
    }
  }, null, 2));
}

// Show examples if no arguments provided
if (process.argv.length === 2) {
  showPayloadExamples();
} else if (process.argv[2] === 'test') {
  runTests();
} else {
  console.log('Usage:');
  console.log('  node test_daily_training_api.js        # Show payload examples');
  console.log('  node test_daily_training_api.js test   # Run API tests');
}
