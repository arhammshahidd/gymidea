# Mobile Stats API - Quick Reference

## Migration Status
✅ **Migration completed successfully!** The `user_stats` table has been created.

## Quick Endpoints

### 1. Get User Stats
```
GET /api/stats/mobile
GET /api/stats/mobile?refresh=true  (force recalculate)
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 42,
    "date_updated": "2025-11-04T10:30:00.000Z",
    "daily_workouts": { "2025-11-04": ["Chest", "Cardio"] },
    "total_workouts": 145,
    "total_minutes": 8250,
    "longest_streak": 14,
    "recent_workouts": ["Leg Day", "Cardio", "Chest", "Yoga", "Back"],
    "weekly_progress": { "completed": 5, "remaining": 2, "total_minutes": 320, "total_workouts": 7 },
    "monthly_progress": { "completed": 20, "remaining": 10, "completion_rate": 66.7, "daily_avg": 45, "days_passed": 15, "total_minutes": 900 },
    "remaining_tasks": { "today": ["Stretching"], "weekly": ["HIIT"], "monthly": ["Endurance test"], "upcoming": ["Half Marathon"] },
    "task_completion_report": { "today": { "completed": 2, "total": 3 }, "week": { "completed": 5, "total": 7 }, "month": { "completed": 15, "total": 20 } }
  }
}
```

### 2. Sync Stats
```
POST /api/stats/mobile/sync
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "message": "Stats synced successfully",
  "data": { /* same as Get Stats response */ }
}
```

## Auto-Sync
Stats automatically sync when:
- Daily training plan is completed
- Plan completion status is updated

No manual sync needed in most cases!

## Full Documentation
See `Mobile_Stats_API_Guide.md` for complete documentation with examples.

