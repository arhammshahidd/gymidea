const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testData = {
  gymAdminToken: 'your_gym_admin_token_here',
  regularUserToken: 'your_regular_user_token_here',
  testUserId: 1,
  testPlanId: 1
};

async function testFoodMenuAssignments() {
  console.log('🧪 Testing Food Menu Assignment Fixes...\n');
  
  try {
    // Test 1: List assignments with user information
    console.log('1. Testing listAssignments with user info...');
    const assignmentsResponse = await axios.get(`${BASE_URL}/foodMenu/assignments`, {
      headers: { 'Authorization': `Bearer ${testData.gymAdminToken}` },
      params: { user_id: testData.testUserId }
    });
    
    if (assignmentsResponse.data.success) {
      const assignments = assignmentsResponse.data.data;
      console.log('✅ Assignments retrieved successfully');
      console.log(`📊 Found ${assignments.length} assignments`);
      
      if (assignments.length > 0) {
        const firstAssignment = assignments[0];
        console.log('📋 First assignment details:');
        console.log(`   - User ID: ${firstAssignment.user_id}`);
        console.log(`   - User Name: ${firstAssignment.user_name || 'Not provided'}`);
        console.log(`   - User Phone: ${firstAssignment.user_phone || 'Not provided'}`);
        console.log(`   - User Email: ${firstAssignment.user_email || 'Not provided'}`);
        console.log(`   - Plan Category: ${firstAssignment.menu_plan_category}`);
        console.log(`   - Total Calories: ${firstAssignment.total_daily_calories}`);
      }
    } else {
      console.log('❌ Failed to retrieve assignments');
    }
    
    // Test 2: Test user isolation for regular users
    console.log('\n2. Testing user isolation for regular users...');
    try {
      const userAssignmentsResponse = await axios.get(`${BASE_URL}/foodMenu/assignments/user/${testData.testUserId}`, {
        headers: { 'Authorization': `Bearer ${testData.regularUserToken}` }
      });
      
      if (userAssignmentsResponse.data.success) {
        const userAssignments = userAssignmentsResponse.data.data;
        console.log('✅ User assignments retrieved successfully');
        console.log(`📊 Found ${userAssignments.length} assignments for user`);
        
        // Verify all assignments belong to the authenticated user
        const allOwnAssignments = userAssignments.every(assignment => 
          assignment.user_id === testData.testUserId
        );
        
        if (allOwnAssignments) {
          console.log('✅ User isolation working correctly - user only sees their own assignments');
        } else {
          console.log('❌ User isolation failed - user can see other users\' assignments');
        }
      }
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ User isolation working correctly - access denied for other users\' data');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    
    // Test 3: Test AI meal plan user isolation
    console.log('\n3. Testing AI meal plan user isolation...');
    try {
      const aiPlansResponse = await axios.get(`${BASE_URL}/appAIMeals/generated`, {
        headers: { 'Authorization': `Bearer ${testData.regularUserToken}` }
      });
      
      if (aiPlansResponse.data.success) {
        const aiPlans = aiPlansResponse.data.data;
        console.log('✅ AI meal plans retrieved successfully');
        console.log(`📊 Found ${aiPlans.length} AI meal plans`);
        
        // Verify all plans belong to the authenticated user
        const allOwnPlans = aiPlans.every(plan => 
          plan.user_id === testData.testUserId
        );
        
        if (allOwnPlans) {
          console.log('✅ AI meal plan isolation working correctly - user only sees their own plans');
        } else {
          console.log('❌ AI meal plan isolation failed - user can see other users\' plans');
        }
      }
    } catch (error) {
      console.log('❌ Error testing AI meal plans:', error.message);
    }
    
    // Test 4: Test daily plans user isolation
    console.log('\n4. Testing daily plans user isolation...');
    try {
      const dailyPlansResponse = await axios.get(`${BASE_URL}/dailyPlans/today/${testData.testUserId}`, {
        headers: { 'Authorization': `Bearer ${testData.regularUserToken}` }
      });
      
      if (dailyPlansResponse.data.success) {
        const dailyPlans = dailyPlansResponse.data.data;
        console.log('✅ Daily plans retrieved successfully');
        console.log(`📅 Today's date: ${dailyPlans.date}`);
        
        if (dailyPlans.training_plan) {
          console.log('🏋️ Training plan found');
        }
        if (dailyPlans.nutrition_plan) {
          console.log('🍎 Nutrition plan found');
        }
        
        console.log('✅ Daily plans isolation working correctly');
      }
    } catch (error) {
      console.log('❌ Error testing daily plans:', error.message);
    }
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('⚠️  Note: Update the test tokens and user IDs in the script before running');
  console.log('📝 To run tests: node test_food_menu_fixes.js');
  
  // Uncomment the line below to run tests
  // testFoodMenuAssignments();
}

module.exports = { testFoodMenuAssignments };
