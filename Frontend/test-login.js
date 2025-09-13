// Test Gym Admin login functionality
const http = require('http');

function testGymAdminLogin() {
  const postData = JSON.stringify({
    phone: '+10000000000',
    password: 'admin123'
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/superadmin/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('Testing Super Admin login...');
  console.log('Credentials:', { phone: '+10000000000', password: 'admin123' });

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Response:', data);
      
      if (res.statusCode === 200) {
        console.log('✅ Login successful!');
        try {
          const response = JSON.parse(data);
          console.log('Token:', response.token ? 'Present' : 'Missing');
          console.log('User:', response.user);
        } catch (e) {
          console.log('Response is not valid JSON');
        }
      } else {
        console.log('❌ Login failed!');
        try {
          const error = JSON.parse(data);
          console.log('Error message:', error.message);
        } catch (e) {
          console.log('Error response is not valid JSON');
        }
      }
    });
  });

  req.on('error', (error) => {
    console.log('❌ Request failed:', error.message);
  });

  req.write(postData);
  req.end();
}

testGymAdminLogin();
