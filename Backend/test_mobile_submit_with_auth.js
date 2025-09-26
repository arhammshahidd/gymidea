/**
 * Test mobile submit with authentication
 * Run with: node test_mobile_submit_with_auth.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';

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

async function testMobileSubmitWithAuth() {
  console.log('🧪 Testing Mobile Submit with Authentication\n');
  
  // First, let's try to get a token by logging in
  try {
    console.log('1. Attempting to get authentication token...');
    
    // Try to login as a mobile user (you'll need to adjust these credentials)
    const loginResponse = await axios.post(`${BASE_URL}/auth/mobileuser/login`, {
      email: 'test@example.com', // Replace with actual mobile user email
      password: 'password123'    // Replace with actual password
    });
    
    if (loginResponse.data.success && loginResponse.data.token) {
      const token = loginResponse.data.token;
      console.log('✅ Authentication successful');
      
      // Now test the mobile submit endpoint
      console.log('\n2. Testing mobile submit endpoint...');
      
      const endpoints = [
        '/api/training-approvals/mobile/submit',
        '/api/trainingApprovals/mobile/submit',
        '/api/training-approvals',
        '/api/trainingApprovals'
      ];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`\n🔍 Testing: ${endpoint}`);
          
          const response = await axios.post(
            `http://localhost:5000${endpoint}`,
            testPayload,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
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
      }
      
    } else {
      console.log('❌ Authentication failed');
      console.log('   Response:', loginResponse.data);
    }
    
  } catch (error) {
    console.log('❌ Login failed');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('   Error:', error.message);
    }
    
    console.log('\n💡 You may need to:');
    console.log('   1. Create a mobile user account first');
    console.log('   2. Use correct login credentials');
    console.log('   3. Check if the auth endpoint is working');
  }
}

// Run test
testMobileSubmitWithAuth().catch(console.error);
