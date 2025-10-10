const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testData = {
  gymAdminToken: 'your_gym_admin_token_here',
  regularUserToken: 'your_regular_user_token_here',
  testUserId: 1,
  testPlanId: 1
};

async function testTrainingPlanUserIsolation() {
  console.log('🏋️ Testing Training Plan User Isolation Fixes...\n');
  
  try {
    // Test 1: Manual Training Plans - List Plans
    console.log('1. Testing Manual Training Plans - listPlans...');
    try {
      const manualPlansResponse = await axios.get(`${BASE_URL}/appManualTraining`, {
        headers: { 'Authorization': `Bearer ${testData.regularUserToken}` }
      });
      
      if (manualPlansResponse.data.success) {
        const manualPlans = manualPlansResponse.data.data;
        console.log('✅ Manual training plans retrieved successfully');
        console.log(`📊 Found ${manualPlans.length} manual training plans`);
        
        // Verify all plans belong to the authenticated user
        const allOwnPlans = manualPlans.every(plan => 
          plan.user_id === testData.testUserId
        );
        
        if (allOwnPlans) {
          console.log('✅ Manual training plan isolation working correctly - user only sees their own plans');
        } else {
          console.log('❌ Manual training plan isolation failed - user can see other users\' plans');
          console.log('Plans found:', manualPlans.map(p => ({ id: p.id, user_id: p.user_id })));
        }
      }
    } catch (error) {
      console.log('❌ Error testing manual training plans:', error.message);
    }
    
    // Test 2: AI Training Plans - List Plans
    console.log('\n2. Testing AI Training Plans - listGeneratedPlans...');
    try {
      const aiPlansResponse = await axios.get(`${BASE_URL}/appAIPlans/generated`, {
        headers: { 'Authorization': `Bearer ${testData.regularUserToken}` }
      });
      
      if (aiPlansResponse.data.success) {
        const aiPlans = aiPlansResponse.data.data;
        console.log('✅ AI training plans retrieved successfully');
        console.log(`📊 Found ${aiPlans.length} AI training plans`);
        
        // Verify all plans belong to the authenticated user
        const allOwnPlans = aiPlans.every(plan => 
          plan.user_id === testData.testUserId
        );
        
        if (allOwnPlans) {
          console.log('✅ AI training plan isolation working correctly - user only sees their own plans');
        } else {
          console.log('❌ AI training plan isolation failed - user can see other users\' plans');
          console.log('Plans found:', aiPlans.map(p => ({ id: p.id, user_id: p.user_id })));
        }
      }
    } catch (error) {
      console.log('❌ Error testing AI training plans:', error.message);
    }
    
    // Test 3: Manual Training Plans - Get Single Plan
    console.log('\n3. Testing Manual Training Plans - getPlan...');
    try {
      const manualPlanResponse = await axios.get(`${BASE_URL}/appManualTraining/${testData.testPlanId}`, {
        headers: { 'Authorization': `Bearer ${testData.regularUserToken}` }
      });
      
      if (manualPlanResponse.data.success) {
        const plan = manualPlanResponse.data.data;
        console.log('✅ Manual training plan retrieved successfully');
        console.log(`📋 Plan details: ID=${plan.id}, User ID=${plan.user_id}, Category=${plan.exercise_plan_category}`);
        
        if (plan.user_id === testData.testUserId) {
          console.log('✅ Manual training plan access control working correctly');
        } else {
          console.log('❌ Manual training plan access control failed - user can access other users\' plans');
        }
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Manual training plan access control working correctly - plan not found (user cannot access other users\' plans)');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    
    // Test 4: AI Training Plans - Get Single Plan
    console.log('\n4. Testing AI Training Plans - getGeneratedPlan...');
    try {
      const aiPlanResponse = await axios.get(`${BASE_URL}/appAIPlans/generated/${testData.testPlanId}`, {
        headers: { 'Authorization': `Bearer ${testData.regularUserToken}` }
      });
      
      if (aiPlanResponse.data.success) {
        const plan = aiPlanResponse.data.data;
        console.log('✅ AI training plan retrieved successfully');
        console.log(`📋 Plan details: ID=${plan.id}, User ID=${plan.user_id}, Category=${plan.exercise_plan_category}`);
        
        if (plan.user_id === testData.testUserId) {
          console.log('✅ AI training plan access control working correctly');
        } else {
          console.log('❌ AI training plan access control failed - user can access other users\' plans');
        }
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ AI training plan access control working correctly - plan not found (user cannot access other users\' plans)');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    
    // Test 5: Test Admin Access (should be able to see all plans in their gym)
    console.log('\n5. Testing Admin Access to Training Plans...');
    try {
      const adminPlansResponse = await axios.get(`${BASE_URL}/appManualTraining`, {
        headers: { 'Authorization': `Bearer ${testData.gymAdminToken}` }
      });
      
      if (adminPlansResponse.data.success) {
        const adminPlans = adminPlansResponse.data.data;
        console.log('✅ Admin can retrieve training plans successfully');
        console.log(`📊 Admin found ${adminPlans.length} training plans in their gym`);
        
        // Verify all plans belong to the same gym
        const allSameGym = adminPlans.every(plan => 
          plan.gym_id === testData.gymId // You'll need to add gymId to testData
        );
        
        if (allSameGym) {
          console.log('✅ Admin gym isolation working correctly');
        } else {
          console.log('❌ Admin gym isolation failed - admin can see plans from other gyms');
        }
      }
    } catch (error) {
      console.log('❌ Error testing admin access:', error.message);
    }
    
    console.log('\n🎉 All training plan isolation tests completed!');
    
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
  console.log('📝 To run tests: node test_training_plan_fixes.js');
  
  // Uncomment the line below to run tests
  // testTrainingPlanUserIsolation();
}

module.exports = { testTrainingPlanUserIsolation };
