/**
 * Test with the exact mobile app payload structure
 * Run with: node test_exact_mobile_payload.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_TOKEN = 'YOUR_MOBILE_USER_JWT_TOKEN_HERE'; // Replace with actual token

// Exact payload from mobile app
const exactMobilePayload = {
  "user_id": 123,
  "user_name": "John Doe",
  "user_phone": "+1234567890",
  
  // Plan Information
  "start_date": "2024-01-15",
  "end_date": "2024-01-22",
  "workout_name": "Chest Workout",
  "category": "Muscle Building",
  "sets": 3,
  "reps": 12,
  "weight_kg": 40.0,
  "total_training_minutes": 90,
  "total_workouts": 2,
  "minutes": 45,
  "exercise_types": "8, 6",
  "user_level": "Intermediate",
  "notes": "Focus on progressive overload this week"
};

async function testExactMobilePayload() {
  console.log('📱 Testing Exact Mobile App Payload\n');
  
  if (TEST_TOKEN === 'YOUR_MOBILE_USER_JWT_TOKEN_HERE') {
    console.log('❌ Please update TEST_TOKEN with a valid mobile user JWT token');
    console.log('   You can get a token by logging in through the mobile app or auth endpoint');
    return;
  }

  console.log('📋 Payload Structure:');
  console.log(JSON.stringify(exactMobilePayload, null, 2));
  console.log('\n🔗 Testing Endpoints:\n');

  // Test both endpoints
  const endpoints = [
    {
      url: `${BASE_URL}/training-approvals/mobile/submit`,
      name: 'Mobile Submit Endpoint'
    },
    {
      url: `${BASE_URL}/training-approvals`,
      name: 'Web Portal Endpoint (with mobile detection)'
    }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🧪 Testing: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      
      const response = await axios.post(
        endpoint.url,
        exactMobilePayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TEST_TOKEN}`
          }
        }
      );

      console.log('✅ SUCCESS!');
      console.log('   Status:', response.status);
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
      // Verify the response contains expected fields
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        console.log('\n📊 Verification:');
        console.log(`   ✅ ID: ${data.id}`);
        console.log(`   ✅ User ID: ${data.user_id}`);
        console.log(`   ✅ User Name: ${data.user_name}`);
        console.log(`   ✅ Workout: ${data.workout_name}`);
        console.log(`   ✅ Category: ${data.category}`);
        console.log(`   ✅ Total Days: ${data.total_days}`);
        console.log(`   ✅ Status: ${data.approval_status}`);
        console.log(`   ✅ Sets: ${data.sets}`);
        console.log(`   ✅ Reps: ${data.reps}`);
        console.log(`   ✅ Weight: ${data.weight_kg} kg`);
        console.log(`   ✅ Exercise Types: ${data.exercise_types}`);
        console.log(`   ✅ User Level: ${data.user_level}`);
      }
      
    } catch (error) {
      if (error.response) {
        console.log('❌ FAILED');
        console.log('   Status:', error.response.status);
        console.log('   Error:', JSON.stringify(error.response.data, null, 2));
        
        if (error.response.status === 400) {
          console.log('\n🔍 Possible issues:');
          console.log('   1. Missing required fields in payload');
          console.log('   2. Invalid date format');
          console.log('   3. Invalid user_level value');
          console.log('   4. Authentication issues');
          console.log('   5. Database connection issues');
        } else if (error.response.status === 401) {
          console.log('\n🔍 Authentication issue:');
          console.log('   1. Invalid or expired JWT token');
          console.log('   2. Missing Authorization header');
          console.log('   3. Wrong user role (should be mobile_user)');
        } else if (error.response.status === 500) {
          console.log('\n🔍 Server error:');
          console.log('   1. Database connection issue');
          console.log('   2. Missing database migration');
          console.log('   3. Server configuration issue');
        }
      } else {
        console.log('❌ NETWORK ERROR');
        console.log('   Error:', error.message);
        console.log('   Make sure the server is running on localhost:5000');
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// Run test
testExactMobilePayload().catch(console.error);
