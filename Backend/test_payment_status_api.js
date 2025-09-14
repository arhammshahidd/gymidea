const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
let authToken = '';

// Test data
const testPayment = {
  user_id: 1,
  amount: 75.00,
  payment_status: 'Unpaid',
  due_date: '2024-01-25'
};

// Helper function to make authenticated requests
const makeRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error in ${method} ${endpoint}:`, error.response?.data || error.message);
    return null;
  }
};

// Test functions
const testLogin = async () => {
  console.log('\n🔐 Testing Gym Admin Login...');
  
  try {
    const response = await axios.post(`${BASE_URL}/auth/gymadmin/login`, {
      phone: '12345678',
      password: 'admin123'
    });
    
    if (response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login successful');
      console.log('User:', response.data.admin.name);
      console.log('Permissions:', response.data.admin.permissions);
      return true;
    }
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
};

const testPaymentOverview = async () => {
  console.log('\n📊 Testing Payment Overview...');
  
  const result = await makeRequest('GET', '/paymentStatus/overview');
  if (result) {
    console.log('✅ Payment overview retrieved successfully');
    console.log('Total Amount:', result.data.total_amount);
    console.log('Paid Members:', result.data.paid_members);
    console.log('Unpaid Members:', result.data.unpaid_members);
    console.log('Total Records:', result.data.all_payments.length);
  } else {
    console.log('❌ Failed to retrieve payment overview');
  }
};

const testGetAllPayments = async () => {
  console.log('\n📋 Testing Get All Payments...');
  
  const result = await makeRequest('GET', '/paymentStatus?page=1&limit=5');
  if (result) {
    console.log('✅ Payments retrieved successfully');
    console.log('Current Page:', result.data.pagination.current_page);
    console.log('Total Pages:', result.data.pagination.total_pages);
    console.log('Total Records:', result.data.pagination.total_records);
    console.log('Payments Count:', result.data.payments.length);
  } else {
    console.log('❌ Failed to retrieve payments');
  }
};

const testCreatePayment = async () => {
  console.log('\n➕ Testing Create Payment...');
  
  const result = await makeRequest('POST', '/paymentStatus', testPayment);
  if (result) {
    console.log('✅ Payment created successfully');
    console.log('Payment ID:', result.data.id);
    console.log('Amount:', result.data.amount);
    console.log('Status:', result.data.payment_status);
    return result.data.id;
  } else {
    console.log('❌ Failed to create payment');
    return null;
  }
};

const testGetSinglePayment = async (paymentId) => {
  console.log('\n🔍 Testing Get Single Payment...');
  
  const result = await makeRequest('GET', `/paymentStatus/${paymentId}`);
  if (result) {
    console.log('✅ Payment retrieved successfully');
    console.log('Payment ID:', result.data.id);
    console.log('User Name:', result.data.user_name);
    console.log('Amount:', result.data.amount);
    console.log('Status:', result.data.payment_status);
  } else {
    console.log('❌ Failed to retrieve payment');
  }
};

const testUpdatePayment = async (paymentId) => {
  console.log('\n✏️ Testing Update Payment...');
  
  const updateData = {
    amount: 80.00,
    payment_status: 'Paid'
  };
  
  const result = await makeRequest('PUT', `/paymentStatus/${paymentId}`, updateData);
  if (result) {
    console.log('✅ Payment updated successfully');
    console.log('New Amount:', result.data.amount);
    console.log('New Status:', result.data.payment_status);
    console.log('Payment Date:', result.data.payment_date);
  } else {
    console.log('❌ Failed to update payment');
  }
};

const testWhatsAppReminders = async () => {
  console.log('\n📱 Testing WhatsApp Reminders...');
  
  const result = await makeRequest('POST', '/paymentStatus/whatsapp-reminder');
  if (result) {
    console.log('✅ WhatsApp reminders prepared successfully');
    console.log('Reminders Sent:', result.data.reminders_sent);
    console.log('Sample Message:', result.data.reminders[0]?.message);
  } else {
    console.log('❌ Failed to prepare WhatsApp reminders');
  }
};

const testDeletePayment = async (paymentId) => {
  console.log('\n🗑️ Testing Delete Payment...');
  
  const result = await makeRequest('DELETE', `/paymentStatus/${paymentId}`);
  if (result) {
    console.log('✅ Payment deleted successfully');
  } else {
    console.log('❌ Failed to delete payment');
  }
};

const testFilteredPayments = async () => {
  console.log('\n🔍 Testing Filtered Payments...');
  
  // Test status filter
  const unpaidResult = await makeRequest('GET', '/paymentStatus?status=Unpaid');
  if (unpaidResult) {
    console.log('✅ Unpaid payments retrieved:', unpaidResult.data.payments.length);
  }
  
  // Test search filter
  const searchResult = await makeRequest('GET', '/paymentStatus?search=john');
  if (searchResult) {
    console.log('✅ Search results retrieved:', searchResult.data.payments.length);
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Payment Status API Tests...\n');
  
  // Test login first
  const loginSuccess = await testLogin();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  // Run all tests
  await testPaymentOverview();
  await testGetAllPayments();
  
  const paymentId = await testCreatePayment();
  if (paymentId) {
    await testGetSinglePayment(paymentId);
    await testUpdatePayment(paymentId);
    await testDeletePayment(paymentId);
  }
  
  await testWhatsAppReminders();
  await testFilteredPayments();
  
  console.log('\n🎉 All Payment Status API tests completed!');
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testLogin,
  testPaymentOverview,
  testGetAllPayments,
  testCreatePayment,
  testGetSinglePayment,
  testUpdatePayment,
  testWhatsAppReminders,
  testDeletePayment,
  testFilteredPayments
};
