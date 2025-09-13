// Test script for User Management API
// Run this after starting the backend server

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '+1234567890',
  password: 'password123',
  status: 'ACTIVE',
  membership_tier: 'BASIC'
};

async function testUserManagementAPI() {
  try {
    console.log('=== TESTING USER MANAGEMENT API ===\n');

    // Step 1: Login as Gym Admin to get token
    console.log('1. Logging in as Gym Admin...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/gymadmin/login`, {
      phone: '+10000000000', // Use your gym admin phone
      password: 'admin123'   // Use your gym admin password
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received\n');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Step 2: Get user statistics
    console.log('2. Getting user statistics...');
    const statsResponse = await axios.get(`${BASE_URL}/userManagement/stats`, { headers });
    console.log('✅ User stats:', statsResponse.data.data);
    console.log('');

    // Step 3: Get all users
    console.log('3. Getting all users...');
    const usersResponse = await axios.get(`${BASE_URL}/userManagement/`, { headers });
    console.log('✅ Users found:', usersResponse.data.data.length);
    console.log('');

    // Step 4: Create a new user
    console.log('4. Creating a new user...');
    const createResponse = await axios.post(`${BASE_URL}/userManagement/`, testUser, { headers });
    console.log('✅ User created:', createResponse.data.data);
    const userId = createResponse.data.data.id;
    console.log('');

    // Step 5: Get user by ID
    console.log('5. Getting user by ID...');
    const userResponse = await axios.get(`${BASE_URL}/userManagement/${userId}`, { headers });
    console.log('✅ User retrieved:', userResponse.data.data);
    console.log('');

    // Step 6: Update user
    console.log('6. Updating user...');
    const updateResponse = await axios.put(`${BASE_URL}/userManagement/${userId}`, {
      status: 'INACTIVE',
      membership_tier: 'PREMIUM'
    }, { headers });
    console.log('✅ User updated:', updateResponse.data.data);
    console.log('');

    // Step 7: Logout user
    console.log('7. Logging out user...');
    const logoutResponse = await axios.post(`${BASE_URL}/userManagement/${userId}/logout`, {}, { headers });
    console.log('✅ User logged out:', logoutResponse.data.message);
    console.log('');

    // Step 8: Get updated statistics
    console.log('8. Getting updated statistics...');
    const updatedStatsResponse = await axios.get(`${BASE_URL}/userManagement/stats`, { headers });
    console.log('✅ Updated stats:', updatedStatsResponse.data.data);
    console.log('');

    // Step 9: Delete user
    console.log('9. Deleting user...');
    const deleteResponse = await axios.delete(`${BASE_URL}/userManagement/${userId}`, { headers });
    console.log('✅ User deleted:', deleteResponse.data.message);
    console.log('');

    console.log('🎉 All User Management API tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testUserManagementAPI();
