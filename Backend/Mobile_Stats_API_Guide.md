# Mobile Stats API Guide

## Overview
This guide provides endpoints and payloads for the mobile app to interact with user statistics calculated from `daily_training_plans` and `daily_training_plan_items` tables.

**Note:** Stats are stored directly in the `daily_training_plans` table in a special stats record (identified by `is_stats_record = true`). This allows the mobile app to query stats using the same table structure as daily plans.

## Base URL
```
http://your-backend-url/api/stats
```

## Authentication
All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### 1. Get User Stats

Retrieve user statistics. Stats are automatically calculated from `daily_training_plans` and `daily_training_plan_items` tables.

**Endpoint:** `GET /api/stats/mobile`

**Query Parameters:**
- `refresh` (optional, boolean): If `true`, recalculates stats from database. Default: `false` (returns cached stats)

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Example:**
```bash
# Get cached stats
GET /api/stats/mobile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Force refresh stats
GET /api/stats/mobile?refresh=true
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 42,
    "date_updated": "2025-11-04T10:30:00.000Z",
    "daily_workouts": {
      "2025-11-04": ["Chest", "Cardio"],
      "2025-11-03": ["Legs"],
      "2025-11-02": ["Arms", "Back"],
      "2025-11-01": ["Cardio"]
    },
    "total_workouts": 145,
    "total_minutes": 8250,
    "longest_streak": 14,
    "recent_workouts": ["Leg Day", "Cardio", "Chest", "Yoga", "Back"],
    "weekly_progress": {
      "completed": 5,
      "remaining": 2,
      "total_minutes": 320,
      "total_workouts": 7
    },
    "monthly_progress": {
      "completed": 20,
      "remaining": 10,
      "completion_rate": 66.7,
      "daily_avg": 45,
      "days_passed": 15,
      "total_minutes": 900
    },
    "remaining_tasks": {
      "today": ["Stretching", "Cardio"],
      "weekly": ["HIIT", "Yoga"],
      "monthly": ["Endurance test"],
      "upcoming": ["Half Marathon"]
    },
    "task_completion_report": {
      "today": {
        "completed": 2,
        "total": 3
      },
      "week": {
        "completed": 5,
        "total": 7
      },
      "month": {
        "completed": 15,
        "total": 20
      }
    },
    "created_at": "2025-01-15T08:00:00.000Z",
    "updated_at": "2025-11-04T10:30:00.000Z"
  }
}
```

**Response (Stats Not Found - 404):**
```json
{
  "success": false,
  "message": "Stats not found for this user"
}
```

**Response (Unauthorized - 401):**
```json
{
  "success": false,
  "message": "Invalid token"
}
```

---

### 2. Sync/Update User Stats

Manually trigger recalculation and update of user statistics from `daily_training_plans` and `daily_training_plan_items` tables.

**Endpoint:** `POST /api/stats/mobile/sync`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{}
```
*(No body required - stats are calculated from user's daily training plans)*

**Request Example:**
```bash
POST /api/stats/mobile/sync
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Stats synced successfully",
  "data": {
    "id": 1,
    "user_id": 42,
    "date_updated": "2025-11-04T10:30:00.000Z",
    "daily_workouts": {
      "2025-11-04": ["Chest", "Cardio"],
      "2025-11-03": ["Legs"]
    },
    "total_workouts": 145,
    "total_minutes": 8250,
    "longest_streak": 14,
    "recent_workouts": ["Leg Day", "Cardio", "Chest", "Yoga", "Back"],
    "weekly_progress": {
      "completed": 5,
      "remaining": 2,
      "total_minutes": 320,
      "total_workouts": 7
    },
    "monthly_progress": {
      "completed": 20,
      "remaining": 10,
      "completion_rate": 66.7,
      "daily_avg": 45,
      "days_passed": 15,
      "total_minutes": 900
    },
    "remaining_tasks": {
      "today": ["Stretching", "Cardio"],
      "weekly": ["HIIT", "Yoga"],
      "monthly": ["Endurance test"],
      "upcoming": ["Half Marathon"]
    },
    "task_completion_report": {
      "today": {
        "completed": 2,
        "total": 3
      },
      "week": {
        "completed": 5,
        "total": 7
      },
      "month": {
        "completed": 15,
        "total": 20
      }
    },
    "created_at": "2025-01-15T08:00:00.000Z",
    "updated_at": "2025-11-04T10:30:00.000Z"
  }
}
```

**Response (Error - 500):**
```json
{
  "success": false,
  "message": "Error syncing stats"
}
```

---

## Data Structure Reference

### Stats Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Unique stats record ID |
| `user_id` | Integer | User ID (matches authenticated user) |
| `date_updated` | DateTime (ISO 8601) | Last time stats were updated |
| `daily_workouts` | JSON Object | Daily workouts grouped by date. Format: `{ "YYYY-MM-DD": ["Workout1", "Workout2"] }` |
| `total_workouts` | Integer | Total number of completed workouts overall |
| `total_minutes` | Integer | Total minutes spent on all workouts |
| `longest_streak` | Integer | Longest consecutive workout streak in days |
| `recent_workouts` | JSON Array | Last 5 unique workout names (most recent first) |
| `weekly_progress` | JSON Object | Current week statistics |
| `monthly_progress` | JSON Object | Current month statistics |
| `remaining_tasks` | JSON Object | Pending tasks grouped by timeframe |
| `task_completion_report` | JSON Object | Completion statistics for today, week, and month |

### Weekly Progress Object
```json
{
  "completed": 5,        // Number of completed workouts this week
  "remaining": 2,        // Number of remaining workouts this week
  "total_minutes": 320,  // Total minutes spent this week
  "total_workouts": 7    // Total workouts completed this week
}
```

### Monthly Progress Object
```json
{
  "completed": 20,           // Number of completed workouts this month
  "remaining": 10,           // Number of remaining workouts this month
  "completion_rate": 66.7,   // Completion percentage
  "daily_avg": 45,           // Average minutes per day this month
  "days_passed": 15,         // Days passed in current month
  "total_minutes": 900       // Total minutes spent this month
}
```

### Remaining Tasks Object
```json
{
  "today": ["Workout1", "Workout2"],      // Today's remaining tasks
  "weekly": ["Workout3", "Workout4"],     // This week's remaining tasks
  "monthly": ["Workout5", "Workout6"],    // This month's remaining tasks
  "upcoming": ["Workout7", "Workout8"]    // Future upcoming tasks
}
```

### Task Completion Report Object
```json
{
  "today": {
    "completed": 2,  // Completed tasks today
    "total": 3       // Total tasks today
  },
  "week": {
    "completed": 5,  // Completed tasks this week
    "total": 7       // Total tasks this week
  },
  "month": {
    "completed": 15, // Completed tasks this month
    "total": 20      // Total tasks this month
  }
}
```

---

## Auto-Sync Behavior

Stats are automatically synced when:
1. A daily training plan is completed via `POST /api/dailyTraining/mobile/complete`
2. A daily plan completion status is updated via `PATCH /api/dailyPlans/completion`

**Note:** You don't need to manually sync stats after completing workouts. The backend handles this automatically.

---

## Usage Examples

### Flutter/Dart Example

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class StatsService {
  final String baseUrl = 'http://your-backend-url/api/stats';
  final String token; // Your JWT token
  
  StatsService(this.token);
  
  // Get user stats
  Future<Map<String, dynamic>> getStats({bool refresh = false}) async {
    final uri = Uri.parse('$baseUrl/mobile${refresh ? '?refresh=true' : ''}');
    
    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['data'];
    } else {
      throw Exception('Failed to load stats');
    }
  }
  
  // Sync stats
  Future<Map<String, dynamic>> syncStats() async {
    final uri = Uri.parse('$baseUrl/mobile/sync');
    
    final response = await http.post(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({}),
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['data'];
    } else {
      throw Exception('Failed to sync stats');
    }
  }
}
```

### React Native Example

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://your-backend-url/api/stats';

class StatsService {
  constructor(token) {
    this.token = token;
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Get user stats
  async getStats(refresh = false) {
    try {
      const response = await this.api.get(`/mobile${refresh ? '?refresh=true' : ''}`);
      return response.data.data;
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }

  // Sync stats
  async syncStats() {
    try {
      const response = await this.api.post('/mobile/sync', {});
      return response.data.data;
    } catch (error) {
      console.error('Error syncing stats:', error);
      throw error;
    }
  }
}

export default StatsService;
```

---

## Error Handling

### Common HTTP Status Codes

| Status Code | Meaning | Description |
|-------------|---------|-------------|
| 200 | OK | Request successful |
| 401 | Unauthorized | Invalid or missing authentication token |
| 403 | Forbidden | User doesn't have permission |
| 404 | Not Found | Stats not found (will auto-create on first sync) |
| 500 | Internal Server Error | Server error (check logs) |

### Error Response Format
```json
{
  "success": false,
  "message": "Error message description"
}
```

---

## Best Practices

1. **Caching**: Use cached stats (default) for better performance. Only use `refresh=true` when you need real-time data.

2. **Auto-Sync**: Stats automatically sync when workouts are completed. Manual sync is usually not needed unless:
   - User manually requests refresh
   - App detects data inconsistency
   - App starts after long offline period

3. **Error Handling**: Always handle errors gracefully. Show user-friendly messages.

4. **Loading States**: Show loading indicators when fetching or syncing stats.

5. **Offline Support**: Cache stats locally for offline viewing. Sync when connection is restored.

---

## Testing

### Using cURL

```bash
# Get stats (cached)
curl -X GET "http://your-backend-url/api/stats/mobile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Get stats (refreshed)
curl -X GET "http://your-backend-url/api/stats/mobile?refresh=true" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Sync stats
curl -X POST "http://your-backend-url/api/stats/mobile/sync" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Using Postman

1. **Get Stats:**
   - Method: `GET`
   - URL: `{{base_url}}/api/stats/mobile`
   - Headers: `Authorization: Bearer {{token}}`
   - Query Params (optional): `refresh: true`

2. **Sync Stats:**
   - Method: `POST`
   - URL: `{{base_url}}/api/stats/mobile/sync`
   - Headers: `Authorization: Bearer {{token}}`
   - Body: `{}` (empty JSON object)

---

## Notes

- **Stats Storage**: Stats are stored directly in the `daily_training_plans` table in a special stats record (one per user, with `is_stats_record = true`)
- **Data Source**: All stats are calculated from `daily_training_plans` and `daily_training_plan_items` tables
- **Auto-Sync**: Stats are automatically updated when workouts are completed
- **Weekly Progress**: Calculated from Monday to Sunday
- **Monthly Progress**: Calculated for the current calendar month
- **Longest Streak**: Counts consecutive days with completed workouts
- **Recent Workouts**: Shows the last 5 unique workout names from completed plans
- **Table Structure**: Stats columns are prefixed with `stats_` in the `daily_training_plans` table (e.g., `stats_total_workouts`, `stats_daily_workouts`)

---

## Support

For issues or questions, contact the backend development team.

