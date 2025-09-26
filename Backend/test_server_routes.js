/**
 * Test if server is running and routes are accessible
 * Run with: node test_server_routes.js
 */

const axios = require('axios');

async function testServerRoutes() {
  console.log('🔍 Testing Server and Routes\n');
  
  try {
    // Test if server is running
    console.log('1. Testing server health...');
    const healthResponse = await axios.get('http://localhost:5000/');
    console.log('✅ Server is running');
    console.log('   Response:', healthResponse.data);
    
    // Test if routes are accessible (without auth)
    console.log('\n2. Testing route accessibility...');
    
    const routes = [
      '/api/training-approvals',
      '/api/trainingApprovals',
      '/api/training-approvals/mobile/submit',
      '/api/trainingApprovals/mobile/submit'
    ];
    
    for (const route of routes) {
      try {
        const response = await axios.get(`http://localhost:5000${route}`);
        console.log(`✅ ${route} - Status: ${response.status}`);
      } catch (error) {
        if (error.response) {
          if (error.response.status === 401) {
            console.log(`✅ ${route} - Route exists (401 Unauthorized - expected)`);
          } else if (error.response.status === 404) {
            console.log(`❌ ${route} - Route not found (404)`);
          } else {
            console.log(`⚠️  ${route} - Status: ${error.response.status}`);
          }
        } else {
          console.log(`❌ ${route} - Network error: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    console.log('   Error:', error.message);
    console.log('\n💡 Make sure to start the server with: npm run dev');
  }
}

// Run test
testServerRoutes().catch(console.error);
