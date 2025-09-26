/**
 * Test script for Mobile Training Approval API
 * Run with: node test_mobile_training_approval_api.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_TOKEN = 'YOUR_MOBILE_USER_JWT_TOKEN_HERE'; // Replace with actual token

// Test data
const testTrainingApproval = {
  start_date: "2024-01-15",
  end_date: "2024-01-22",
  workout_name: "Upper Body Strength Training",
  category: "Strength Training",
  sets: 3,
  reps: 12,
  weight_kg: 25.5,
  total_training_minutes: 60,
  total_workouts: 4,
  minutes: 45,
  exercise_types: "Bench Press, Pull-ups, Shoulder Press",
  user_level: "Intermediate",
  notes: "Focus on progressive overload this week"
};

// Test cases
const testCases = [
  {
    name: "Valid Training Approval Submission",
    data: testTrainingApproval,
    expectedStatus: 201
  },
  {
    name: "Missing Required Field - start_date",
    data: { ...testTrainingApproval, start_date: undefined },
    expectedStatus: 400
  },
  {
    name: "Missing Required Field - workout_name",
    data: { ...testTrainingApproval, workout_name: undefined },
    expectedStatus: 400
  },
  {
    name: "Invalid Date Format",
    data: { ...testTrainingApproval, start_date: "15-01-2024" },
    expectedStatus: 400
  },
  {
    name: "Invalid Date Range - Start after End",
    data: { ...testTrainingApproval, start_date: "2024-01-25", end_date: "2024-01-20" },
    expectedStatus: 400
  },
  {
    name: "Invalid User Level",
    data: { ...testTrainingApproval, user_level: "Advanced" },
    expectedStatus: 400
  },
  {
    name: "Minimal Valid Data",
    data: {
      start_date: "2024-01-15",
      end_date: "2024-01-22",
      workout_name: "Basic Workout",
      category: "General Fitness"
    },
    expectedStatus: 201
  }
];

// Test function
async function testMobileTrainingApprovalAPI() {
  console.log('🧪 Testing Mobile Training Approval API\n');
  
  if (TEST_TOKEN === 'YOUR_MOBILE_USER_JWT_TOKEN_HERE') {
    console.log('❌ Please update TEST_TOKEN with a valid mobile user JWT token');
    return;
  }

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    try {
      console.log(`📋 Testing: ${testCase.name}`);
      
      // Test both endpoints
      const endpoints = [
        `${BASE_URL}/training-approvals/mobile/submit`,
        `${BASE_URL}/training-approvals` // Web portal endpoint (should also work for mobile)
      ];
      
      let response;
      for (const endpoint of endpoints) {
        try {
          response = await axios.post(
            endpoint,
            testCase.data,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_TOKEN}`
              }
            }
          );
          console.log(`   ✅ Success with endpoint: ${endpoint}`);
          break;
        } catch (endpointError) {
          if (endpointError.response?.status === testCase.expectedStatus) {
            response = endpointError.response;
            console.log(`   ✅ Expected error with endpoint: ${endpoint}`);
            break;
          }
        }
      }

      if (response.status === testCase.expectedStatus) {
        console.log(`✅ PASS - Status: ${response.status}`);
        if (response.data.success) {
          console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
        }
        passedTests++;
      } else {
        console.log(`❌ FAIL - Expected: ${testCase.expectedStatus}, Got: ${response.status}`);
      }
    } catch (error) {
      if (error.response && error.response.status === testCase.expectedStatus) {
        console.log(`✅ PASS - Status: ${error.response.status}`);
        console.log(`   Error Response: ${JSON.stringify(error.response.data, null, 2)}`);
        passedTests++;
      } else {
        console.log(`❌ FAIL - Expected: ${testCase.expectedStatus}, Got: ${error.response?.status || 'Network Error'}`);
        if (error.response?.data) {
          console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      }
    }
    console.log(''); // Empty line for readability
  }

  // Summary
  console.log('📊 Test Summary:');
  console.log(`   Passed: ${passedTests}/${totalTests}`);
  console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
}

// Authentication test
async function testAuthentication() {
  console.log('🔐 Testing Authentication\n');
  
  try {
    // Test without token
    await axios.post(`${BASE_URL}/training-approvals/mobile/submit`, testTrainingApproval);
    console.log('❌ FAIL - Should require authentication');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ PASS - Correctly requires authentication');
    } else {
      console.log(`❌ FAIL - Expected 401, got ${error.response?.status}`);
    }
  }

  try {
    // Test with invalid token
    await axios.post(
      `${BASE_URL}/training-approvals/mobile/submit`,
      testTrainingApproval,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid_token'
        }
      }
    );
    console.log('❌ FAIL - Should reject invalid token');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ PASS - Correctly rejects invalid token');
    } else {
      console.log(`❌ FAIL - Expected 401, got ${error.response?.status}`);
    }
  }
  
  console.log('');
}

// Main execution
async function main() {
  console.log('🚀 Mobile Training Approval API Test Suite\n');
  console.log('=' .repeat(50));
  
  await testAuthentication();
  await testMobileTrainingApprovalAPI();
  
  console.log('=' .repeat(50));
  console.log('✨ Test suite completed!');
}

// Run tests
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testMobileTrainingApprovalAPI,
  testAuthentication
};
