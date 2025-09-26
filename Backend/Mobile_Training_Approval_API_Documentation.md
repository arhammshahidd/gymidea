# Mobile Training Approval API Documentation

## Overview
This API allows mobile app users to submit training approval requests to the web portal for gym admin review and approval.

## Endpoints
```
POST /api/training-approvals/mobile/submit  (Recommended for mobile apps)
POST /api/training-approvals                (Also supports mobile submissions)
```

**Note**: The mobile app can use either endpoint. The web portal endpoint (`/api/training-approvals`) now automatically detects mobile submissions and handles them appropriately.

## Authentication
- **Required**: Bearer token in Authorization header
- **User Role**: `mobile_user`
- **Token Format**: `Bearer <jwt_token>`

## Request Headers
```
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

## Request Payload Structure

### Required Fields
```json
{
  "start_date": "2024-01-15",
  "end_date": "2024-01-22", 
  "workout_name": "Upper Body Strength Training",
  "category": "Strength Training"
}
```

### Complete Payload Example (Exact Mobile App Structure)
```json
{
  "user_id": 123,
  "user_name": "John Doe",
  "user_phone": "+1234567890",
  
  // Plan Information
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
}
```

## Field Descriptions

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `user_id` | integer | ❌ | JWT token | User ID (auto-populated from JWT if not provided) |
| `user_name` | string (max 120 chars) | ❌ | JWT token | User name (auto-populated from JWT if not provided) |
| `user_phone` | string (max 32 chars) | ❌ | JWT token | User phone (auto-populated from JWT if not provided) |
| `start_date` | string (YYYY-MM-DD) | ✅ | - | Training plan start date |
| `end_date` | string (YYYY-MM-DD) | ✅ | - | Training plan end date |
| `workout_name` | string (max 120 chars) | ✅ | - | Name of the workout/training plan |
| `category` | string (max 32 chars) | ✅ | - | Training category (e.g., "Strength Training", "Cardio", "HIIT") |
| `plan_category_name` | string (max 120 chars) | ❌ | category | Plan category name for card display |
| `sets` | integer | ❌ | 0 | Number of sets per exercise |
| `reps` | integer | ❌ | 0 | Number of repetitions per set |
| `weight_kg` | decimal (8,2) | ❌ | 0 | Weight in kilograms |
| `total_training_minutes` | integer | ❌ | 0 | Total training duration in minutes |
| `total_workouts` | integer | ❌ | 0 | Total number of workouts in the plan |
| `minutes` | integer | ❌ | 0 | Duration per workout in minutes |
| `exercise_types` | string | ❌ | null | Comma-separated list of exercise types |
| `user_level` | enum | ❌ | "Beginner" | User fitness level: "Beginner", "Intermediate", "Expert" |
| `notes` | string | ❌ | null | Additional notes or comments |

## Response Format

### Success Response (201 Created)
```json
{
  "success": true,
  "message": "Training approval submitted successfully",
  "data": {
    "id": 123,
    "approval_status": "PENDING",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Responses

#### 400 Bad Request - Missing Required Field
```json
{
  "success": false,
  "message": "start_date is required"
}
```

#### 400 Bad Request - Invalid Date Format
```json
{
  "success": false,
  "message": "Invalid date format. Use YYYY-MM-DD"
}
```

#### 400 Bad Request - Invalid Date Range
```json
{
  "success": false,
  "message": "Start date cannot be after end date"
}
```

#### 400 Bad Request - Invalid User Level
```json
{
  "success": false,
  "message": "user_level must be one of: Beginner, Intermediate, Expert"
}
```

#### 401 Unauthorized - Missing Token
```json
{
  "success": false,
  "message": "No token provided"
}
```

#### 401 Unauthorized - Invalid Token
```json
{
  "success": false,
  "message": "Invalid token"
}
```

#### 403 Forbidden - Wrong Role
```json
{
  "success": false,
  "message": "Access denied"
}
```

## Real-time Updates
When a training approval is submitted via mobile app, the web portal will receive a real-time notification via Socket.IO:

```javascript
// Web portal will receive this event
socket.on('trainingApproval:created', (data) => {
  console.log('New training approval:', data);
  // data.source will be 'mobile_app'
});
```

## Example Usage

### JavaScript/Fetch
```javascript
const submitTrainingApproval = async (trainingData) => {
  try {
    // You can use either endpoint - both work for mobile submissions
    const response = await fetch('/api/training-approvals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(trainingData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Training approval submitted:', result.data);
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error submitting training approval:', error);
    throw error;
  }
};

// Usage
const trainingData = {
  user_id: 123,
  user_name: "John Doe",
  user_phone: "+1234567890",
  start_date: "2024-01-15",
  end_date: "2024-01-22",
  workout_name: "Chest Workout",
  category: "Muscle Building",
  sets: 3,
  reps: 12,
  weight_kg: 40.0,
  total_training_minutes: 90,
  total_workouts: 2,
  minutes: 45,
  exercise_types: "8, 6",
  user_level: "Intermediate",
  notes: "Focus on progressive overload this week"
};

submitTrainingApproval(trainingData);
```

### cURL Example
```bash
curl -X POST http://localhost:5000/api/training-approvals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
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
  }'
```

## Notes
- The API automatically sets `approval_status` to "PENDING" for all mobile submissions
- User information (user_id, user_name, user_phone) is automatically populated from the JWT token if not provided in payload
- The gym_id is automatically set based on the authenticated user's gym
- All submissions trigger real-time notifications to the web portal
- Date format must be YYYY-MM-DD (ISO 8601 date format)
- The API validates date ranges to ensure start_date is not after end_date
- The API automatically calculates `total_days` from the date range
- Mobile submissions are detected automatically based on payload structure and endpoint
