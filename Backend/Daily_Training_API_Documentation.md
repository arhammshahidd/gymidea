# Daily Training API Documentation

## Overview
This API allows mobile app users to interact with daily training plans stored in `daily_training_plans` and `daily_training_plan_items` tables. Users can view their daily plans, submit completion data, and view training statistics.

## Database Tables

### daily_training_plans
- Stores daily training plan information
- Links to users and gyms
- Contains plan metadata and completion status

### daily_training_plan_items
- Stores individual exercise items for each daily plan
- Contains exercise details (sets, reps, weight, etc.)
- Tracks completion status for each exercise

## API Endpoints

### 1. Get Daily Training Plans

**Endpoint**: `GET /api/daily-training/mobile/plans`

**Authentication**: Required (Mobile User JWT Token)

**Query Parameters**:
- `date` (optional): Filter by specific date (YYYY-MM-DD)
- `plan_type` (optional): Filter by plan type (manual, ai_generated, web_assigned)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 456,
      "gym_id": 1,
      "plan_date": "2025-01-08",
      "plan_type": "manual",
      "source_plan_id": 123,
      "plan_category": "Chest",
      "workout_name": "Chest Day",
      "total_exercises": 3,
      "training_minutes": 60,
      "total_sets": 9,
      "total_reps": 108,
      "total_weight_kg": 120.00,
      "user_level": "Beginner",
      "exercises_details": "[{\"name\":\"Bench Press\",\"sets\":3,\"reps\":12}]",
      "is_completed": false,
      "completed_at": null,
      "completion_notes": null,
      "created_at": "2025-01-08T10:00:00.000Z",
      "updated_at": "2025-01-08T10:00:00.000Z",
      "items": [
        {
          "id": 1,
          "daily_plan_id": 1,
          "exercise_name": "Bench Press",
          "sets": 3,
          "reps": 12,
          "weight_kg": 40.00,
          "minutes": 20,
          "exercise_type": "Strength",
          "notes": null,
          "is_completed": false,
          "created_at": "2025-01-08T10:00:00.000Z",
          "updated_at": "2025-01-08T10:00:00.000Z"
        }
      ]
    }
  ]
}
```

### 2. Get Single Daily Training Plan

**Endpoint**: `GET /api/daily-training/mobile/plans/:id`

**Authentication**: Required (Mobile User JWT Token)

**Response**: Same structure as above, but single plan object

### 3. Submit Daily Training Completion

**Endpoint**: `POST /api/daily-training/mobile/complete`

**Authentication**: Required (Mobile User JWT Token)

**Request Body**:
```json
{
  "daily_plan_id": 1,
  "completion_data": [
    {
      "item_id": 1,
      "sets_completed": 3,
      "reps_completed": 12,
      "weight_used": 45.5,
      "minutes_spent": 25,
      "notes": "Felt good today, increased weight"
    },
    {
      "item_id": 2,
      "sets_completed": 3,
      "reps_completed": 10,
      "weight_used": 35.0,
      "minutes_spent": 20,
      "notes": "Good form maintained"
    }
  ]
}
```

**Request Parameters**:
- `daily_plan_id` (integer, required): ID of the daily training plan
- `completion_data` (array, required): Array of exercise completion objects

**Completion Data Object**:
- `item_id` (integer, required): ID of the daily_training_plan_items record
- `sets_completed` (integer, optional): Number of sets actually completed
- `reps_completed` (integer, optional): Number of reps actually completed
- `weight_used` (number, optional): Weight actually used in kg
- `minutes_spent` (integer, optional): Time spent on exercise in minutes
- `notes` (string, optional): Additional notes about the exercise

**Response**:
```json
{
  "success": true,
  "message": "Daily training completion submitted successfully",
  "data": {
    "daily_plan_id": 1,
    "plan_date": "2025-01-08",
    "is_completed": true,
    "completed_at": "2025-01-08T15:30:00.000Z",
    "items": [
      {
        "id": 1,
        "daily_plan_id": 1,
        "exercise_name": "Bench Press",
        "sets": 3,
        "reps": 12,
        "weight_kg": 45.50,
        "minutes": 25,
        "exercise_type": "Strength",
        "notes": "Felt good today, increased weight",
        "is_completed": true,
        "created_at": "2025-01-08T10:00:00.000Z",
        "updated_at": "2025-01-08T15:30:00.000Z"
      }
    ]
  }
}
```

### 4. Get Training Statistics

**Endpoint**: `GET /api/daily-training/mobile/stats`

**Authentication**: Required (Mobile User JWT Token)

**Query Parameters**:
- `start_date` (optional): Start date for stats period (YYYY-MM-DD)
- `end_date` (optional): End date for stats period (YYYY-MM-DD)

**Response**:
```json
{
  "success": true,
  "data": {
    "user_id": 456,
    "period": {
      "start_date": "2025-01-01",
      "end_date": "2025-01-08"
    },
    "stats": {
      "total_plans": 8,
      "completed_plans": 6,
      "total_training_minutes": 480,
      "total_exercises": 24,
      "total_sets": 72,
      "total_reps": 864,
      "total_weight_kg": 2160.00,
      "completion_rate": "75.00",
      "plans_by_category": {
        "Chest": {
          "total": 2,
          "completed": 2,
          "total_minutes": 120
        },
        "Back": {
          "total": 2,
          "completed": 1,
          "total_minutes": 60
        }
      },
      "plans_by_date": {
        "2025-01-08": {
          "total": 1,
          "completed": 1,
          "total_minutes": 60
        },
        "2025-01-07": {
          "total": 1,
          "completed": 0,
          "total_minutes": 0
        }
      }
    },
    "recent_plans": [
      {
        "id": 1,
        "plan_date": "2025-01-08",
        "plan_category": "Chest",
        "is_completed": true,
        "training_minutes": 60
      }
    ]
  }
}
```

## Mobile App Integration Examples

### JavaScript/React Native Example

```javascript
// Get today's training plans
const getTodaysPlans = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await fetch(`/api/daily-training/mobile/plans?date=${today}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching today\'s plans:', error);
    throw error;
  }
};

// Submit exercise completion
const submitExerciseCompletion = async (dailyPlanId, exerciseCompletions) => {
  try {
    const response = await fetch('/api/daily-training/mobile/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        daily_plan_id: dailyPlanId,
        completion_data: exerciseCompletions
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error submitting completion:', error);
    throw error;
  }
};

// Get training statistics
const getTrainingStats = async (startDate, endDate) => {
  try {
    let url = '/api/daily-training/mobile/stats';
    const params = new URLSearchParams();
    
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
};
```

### Example Usage Flow

```javascript
// 1. Get today's training plan
const todaysPlans = await getTodaysPlans();
const todaysPlan = todaysPlans[0]; // Assuming one plan per day

// 2. User completes exercises
const exerciseCompletions = [
  {
    item_id: todaysPlan.items[0].id,
    sets_completed: 3,
    reps_completed: 12,
    weight_used: 45.5,
    minutes_spent: 25,
    notes: "Increased weight from 40kg"
  },
  {
    item_id: todaysPlan.items[1].id,
    sets_completed: 3,
    reps_completed: 10,
    weight_used: 35.0,
    minutes_spent: 20,
    notes: "Good form"
  }
];

// 3. Submit completion
const completionResult = await submitExerciseCompletion(todaysPlan.id, exerciseCompletions);

// 4. Get updated stats
const stats = await getTrainingStats('2025-01-01', '2025-01-08');
console.log(`Completion rate: ${stats.stats.completion_rate}%`);
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "daily_plan_id and completion_data are required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Daily training plan not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Real-time Events

When daily training is completed, the following Socket.IO event is emitted:

**Event**: `dailyTraining:completed`
**Room**: `gym:{gym_id}`

**Data**:
```json
{
  "daily_plan_id": 1,
  "user_id": 456,
  "plan_date": "2025-01-08",
  "completion_data": [...],
  "source": "mobile_app"
}
```

## Notes

- All endpoints require proper authentication
- Users can only access their own data (unless admin/trainer)
- Completion data updates both the plan and individual exercise items
- Statistics are calculated in real-time from the database
- Real-time updates are sent to the web portal via Socket.IO
- All timestamps are in ISO format
- Weight values are stored as decimal numbers
