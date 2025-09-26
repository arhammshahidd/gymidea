/**
 * Test all training approval endpoints
 * Run with: node test_endpoints.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_TOKEN = 'YOUR_MOBILE_USER_JWT_TOKEN_HERE'; // Replace with actual token

// Test payload
const testPayload = {
  "user_id": 123,
  "user_name": "John Doe",
  "user_phone": "+1234567890",
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

async function testEndpoints() {
  console.log('🧪 Testing Training Approval Endpoints\n');
  
  if (TEST_TOKEN === 'YOUR_MOBILE_USER_JWT_TOKEN_HERE') {
    console.log('❌ Please update TEST_TOKEN with a valid mobile user JWT token');
    return;
  }

  const endpoints = [
    {
      url: `${BASE_URL}/training-approvals/mobile/submit`,
      name: 'Kebab-case Mobile Submit'
    },
    {
      url: `${BASE_URL}/training-approvals`,
      name: 'Kebab-case Main Endpoint'
    },
    {
      url: `${BASE_URL}/trainingApprovals/mobile/submit`,
      name: 'CamelCase Mobile Submit'
    },
    {
      url: `${BASE_URL}/trainingApprovals`,
      name: 'CamelCase Main Endpoint'
    }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      
      const response = await axios.post(
        endpoint.url,
        testPayload,
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
      } else {
        console.log('❌ NETWORK ERROR');
        console.log('   Error:', error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// Run test
testEndpoints().catch(console.error);
