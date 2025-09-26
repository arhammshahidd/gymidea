/**
 * Quick test to verify mobile training approval fix
 * Run with: node test_mobile_fix.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_TOKEN = 'YOUR_MOBILE_USER_JWT_TOKEN_HERE'; // Replace with actual token

// Test mobile submission payload (without user_id, user_name, user_phone)
const mobilePayload = {
  start_date: "2024-01-15",
  end_date: "2024-01-22",
  workout_name: "Upper Body Strength Training",
  category: "Strength Training",
  plan_category_name: "Intermediate Full Body Plan",
  sets: 3,
  reps: 12,
  weight_kg: 25.5,
  user_level: "Intermediate",
  notes: "Focus on progressive overload this week"
};

async function testMobileFix() {
  console.log('🔧 Testing Mobile Training Approval Fix\n');
  
  if (TEST_TOKEN === 'YOUR_MOBILE_USER_JWT_TOKEN_HERE') {
    console.log('❌ Please update TEST_TOKEN with a valid mobile user JWT token');
    console.log('   You can get a token by logging in through the mobile app or auth endpoint');
    return;
  }

  try {
    console.log('📱 Testing mobile submission to web portal endpoint...');
    console.log('   Endpoint: POST /api/training-approvals');
    console.log('   Payload:', JSON.stringify(mobilePayload, null, 2));
    
    const response = await axios.post(
      `${BASE_URL}/training-approvals`,
      mobilePayload,
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
      }
    } else {
      console.log('❌ NETWORK ERROR');
      console.log('   Error:', error.message);
      console.log('   Make sure the server is running on localhost:5000');
    }
  }
}

// Run test
testMobileFix().catch(console.error);
