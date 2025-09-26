/**
 * Test the mobileSubmit function directly
 * Run with: node test_mobile_submit_direct.js
 */

const ctrl = require('./src/controllers/TrainingApprovalController');

// Mock request and response objects
const mockReq = {
  body: {
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
  },
  user: {
    id: 123,
    gym_id: 1,
    name: "John Doe",
    phone: "+1234567890"
  },
  path: '/mobile/submit'
};

const mockRes = {
  status: (code) => ({
    json: (data) => {
      console.log(`Response Status: ${code}`);
      console.log('Response Data:', JSON.stringify(data, null, 2));
      return { status: code, data };
    }
  })
};

const mockNext = (err) => {
  if (err) {
    console.error('Error:', err);
  }
};

console.log('🧪 Testing mobileSubmit function directly\n');

// Test the function
ctrl.mobileSubmit(mockReq, mockRes, mockNext);
