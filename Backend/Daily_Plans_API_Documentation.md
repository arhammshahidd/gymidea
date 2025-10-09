# Daily Plans API Documentation

This API provides endpoints for managing daily training and nutrition plans, allowing users to access their plans when switching devices or reinstalling the app.

## Base URL
```
http://localhost:5000/api/dailyPlans
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Create Daily Training Plans
**POST** `/training`

Creates daily training plans for a user over a date range.

**Request Body:**
```json
{
  "user_id": 1,
  "start_date": "2025-01-08",
  "end_date": "2025-01-12",
  "plan_category": "Muscle Building",
  "plan_type": "manual",
  "source_plan_id": 123,
  "exercises": [
    {
      "exercise_name": "Push-ups",
      "sets": 3,
      "reps": 15,
      "weight_kg": 0,
      "minutes": 5,
      "exercise_type": "Bodyweight"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "plan_date": "2025-01-08",
      "plan_type": "manual",
      "plan_category": "Muscle Building",
      "workout_name": "Daily Workout",
      "total_exercises": 1,
      "training_minutes": 5,
      "total_sets": 3,
      "total_reps": 15,
      "total_weight_kg": 0,
      "user_level": "Beginner",
      "is_completed": false,
      "created_at": "2025-01-08T10:00:00.000Z"
    }
  ],
  "message": "Created 5 daily training plans"
}
```

### 2. Create Daily Nutrition Plans
**POST** `/nutrition`

Creates daily nutrition plans for a user over a date range.

**Request Body:**
```json
{
  "user_id": 1,
  "start_date": "2025-01-08",
  "end_date": "2025-01-12",
  "plan_category": "Weight Loss",
  "plan_type": "manual",
  "source_plan_id": 456,
  "meals": [
    {
      "meal_type": "Breakfast",
      "food_item_name": "Oatmeal",
      "grams": 100,
      "calories": 350,
      "proteins": 12,
      "fats": 6,
      "carbs": 60
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "plan_date": "2025-01-08",
      "plan_type": "manual",
      "plan_category": "Weight Loss",
      "total_calories": 350,
      "total_proteins": 12,
      "total_fats": 6,
      "total_carbs": 60,
      "is_completed": false,
      "created_at": "2025-01-08T10:00:00.000Z"
    }
  ],
  "message": "Created 5 daily nutrition plans"
}
```

### 3. Get User's Daily Plans
**GET** `/user/:user_id`

Retrieves all daily plans for a user within a date range.

**Query Parameters:**
- `start_date` (optional): Start date in YYYY-MM-DD format
- `end_date` (optional): End date in YYYY-MM-DD format
- `plan_type` (optional): Filter by plan type (manual, ai_generated, web_assigned)

**Example:**
```
GET /user/1?start_date=2025-01-08&end_date=2025-01-12
```

**Response:**
```json
{
  "success": true,
  "data": {
    "training_plans": [
      {
        "id": 1,
        "user_id": 1,
        "plan_date": "2025-01-08",
        "plan_type": "manual",
        "plan_category": "Muscle Building",
        "workout_name": "Daily Workout",
        "total_exercises": 3,
        "training_minutes": 15,
        "total_sets": 9,
        "total_reps": 50,
        "total_weight_kg": 0,
        "user_level": "Beginner",
        "is_completed": false,
        "exercises_details": [...],
        "items": [
          {
            "id": 1,
            "daily_plan_id": 1,
            "exercise_name": "Push-ups",
            "sets": 3,
            "reps": 15,
            "weight_kg": 0,
            "minutes": 5,
            "exercise_type": "Bodyweight",
            "is_completed": false
          }
        ]
      }
    ],
    "nutrition_plans": [
      {
        "id": 1,
        "user_id": 1,
        "plan_date": "2025-01-08",
        "plan_type": "manual",
        "plan_category": "Weight Loss",
        "total_calories": 1200,
        "total_proteins": 80,
        "total_fats": 40,
        "total_carbs": 120,
        "is_completed": false,
        "meal_details": [...],
        "items": [
          {
            "id": 1,
            "daily_plan_id": 1,
            "meal_type": "Breakfast",
            "food_item_name": "Oatmeal",
            "grams": 100,
            "calories": 350,
            "proteins": 12,
            "fats": 6,
            "carbs": 60,
            "is_completed": false
          }
        ]
      }
    ]
  }
}
```

### 4. Get Today's Plans
**GET** `/today/:user_id`

Retrieves today's training and nutrition plans for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2025-01-08",
    "training_plan": {
      "id": 1,
      "user_id": 1,
      "plan_date": "2025-01-08",
      "plan_type": "manual",
      "plan_category": "Muscle Building",
      "workout_name": "Daily Workout",
      "total_exercises": 3,
      "training_minutes": 15,
      "total_sets": 9,
      "total_reps": 50,
      "total_weight_kg": 0,
      "user_level": "Beginner",
      "is_completed": false,
      "exercises_details": [...],
      "items": [...]
    },
    "nutrition_plan": {
      "id": 1,
      "user_id": 1,
      "plan_date": "2025-01-08",
      "plan_type": "manual",
      "plan_category": "Weight Loss",
      "total_calories": 1200,
      "total_proteins": 80,
      "total_fats": 40,
      "total_carbs": 120,
      "is_completed": false,
      "meal_details": [...],
      "items": [...]
    }
  }
}
```

### 5. Update Plan Completion Status
**PATCH** `/completion`

Updates the completion status of a daily plan.

**Request Body:**
```json
{
  "plan_id": 1,
  "plan_type": "training",
  "is_completed": true,
  "completion_notes": "Completed all exercises successfully!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "plan_date": "2025-01-08",
    "is_completed": true,
    "completed_at": "2025-01-08T15:30:00.000Z",
    "completion_notes": "Completed all exercises successfully!",
    "updated_at": "2025-01-08T15:30:00.000Z"
  },
  "message": "Plan completion status updated"
}
```

### 6. Sync Existing Plans to Daily Plans
**POST** `/sync`

Converts existing training or nutrition plans into daily plans.

**Request Body:**
```json
{
  "user_id": 1,
  "plan_type": "training",
  "source_plan_id": 123
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "plan_date": "2025-01-08",
      "plan_type": "manual",
      "source_plan_id": 123,
      "plan_category": "Muscle Building",
      "workout_name": "Daily Workout",
      "total_exercises": 3,
      "training_minutes": 15,
      "total_sets": 9,
      "total_reps": 50,
      "total_weight_kg": 0,
      "user_level": "Beginner",
      "is_completed": false,
      "created_at": "2025-01-08T10:00:00.000Z"
    }
  ],
  "message": "Synced 5 daily training plans"
}
```

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `400`: Bad Request - Missing required fields or invalid data
- `401`: Unauthorized - Invalid or missing authentication token
- `404`: Not Found - Resource not found
- `500`: Internal Server Error - Server error

## Usage Examples

### Mobile App Integration

When a user logs in on a new device, the mobile app can:

1. **Get today's plans:**
   ```javascript
   const response = await fetch('/api/dailyPlans/today/1', {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   const { data } = await response.json();
   ```

2. **Get plans for a date range:**
   ```javascript
   const response = await fetch('/api/dailyPlans/user/1?start_date=2025-01-08&end_date=2025-01-14', {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   const { data } = await response.json();
   ```

3. **Mark plan as completed:**
   ```javascript
   const response = await fetch('/api/dailyPlans/completion', {
     method: 'PATCH',
     headers: { 
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       plan_id: 1,
       plan_type: 'training',
       is_completed: true,
       completion_notes: 'Great workout!'
     })
   });
   ```

## Automatic Daily Plan Creation

When users create new training or nutrition plans through the existing APIs (`/api/appManualTraining`, `/api/appManualMeals`, etc.), daily plans are automatically created in the background. This ensures that:

1. Users can immediately access their plans in daily format
2. Plans are available when switching devices
3. No additional API calls are needed for basic functionality

The daily plans system provides a seamless experience for mobile users while maintaining backward compatibility with existing web-based plan management.
