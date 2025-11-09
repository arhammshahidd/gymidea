# Mobile Daily Training Plans - Complete Guide for Flutter App

## Overview
This guide explains how to use every column in the `daily_training_plans` table for your Flutter mobile app, including payloads, endpoints, and code examples.

## Table Structure

The `daily_training_plans` table has **26 columns** organized into three categories:

### 1. Core Plan Columns (Regular Daily Plans)
Used for storing daily workout plans.

### 2. Stats Columns (Stats Records Only)
Used for storing user statistics (one record per user with `is_stats_record = true`).

### 3. Metadata Columns
Timestamps and status tracking.

---

## Column Reference Guide

### Core Plan Columns

#### `id` (Integer, Primary Key)
- **Type**: Auto-incrementing integer
- **Usage**: Unique identifier for each daily plan
- **Read-only**: Set by database
- **Example**: `1`

#### `user_id` (Integer, Required, Foreign Key)
- **Type**: Integer
- **Usage**: Links plan to user (from `users` table)
- **Required**: Yes
- **How to Use**: 
  - Get from JWT token: `req.user.id`
  - Or send in payload for other users (admin/trainer)
- **Example**: `42`

#### `gym_id` (Integer, Optional)
- **Type**: Integer (nullable)
- **Usage**: Links plan to gym (for multi-gym support)
- **Required**: No
- **How to Use**: 
  - Auto-populated from JWT token (`req.user.gym_id`)
  - Can be `null` for standalone users
- **Example**: `5` or `null`

#### `plan_date` (Date, Required for plans, NULL for stats)
- **Type**: Date (nullable)
- **Format**: `YYYY-MM-DD` (e.g., `"2025-11-04"`)
- **Usage**: 
  - For regular plans: The date of the workout
  - For stats records: `null` (stats don't have a specific date)
- **Required**: Yes (for regular plans)
- **Example**: `"2025-11-04"`

#### `plan_type` (String, Required)
- **Type**: String (varchar)
- **Usage**: Type of plan
- **Values**: 
  - `"manual"` - User-created manual plan
  - `"ai_generated"` - AI-generated plan
  - `"web_assigned"` - Assigned by gym admin/trainer
  - `"stats_record"` - Special stats record (one per user)
- **Required**: Yes
- **Example**: `"manual"`

#### `source_plan_id` (Integer, Optional)
- **Type**: Integer (nullable)
- **Usage**: ID of the original plan that generated this daily plan
- **Required**: No
- **How to Use**: 
  - Link daily plan to its source (e.g., training approval ID)
  - Can be `null` for standalone daily plans
- **Example**: `123` or `null`

#### `plan_category` (String, Required)
- **Type**: String (varchar)
- **Usage**: Category of the plan
- **Values**: 
  - `"Weight Loss"`
  - `"Muscle Building"`
  - `"Strength Training"`
  - `"Cardio"`
  - `"Endurance"`
  - `"General"` (for stats records)
- **Required**: Yes
- **Example**: `"Muscle Building"`

#### `user_level` (String, Optional)
- **Type**: String (varchar)
- **Default**: `"Beginner"`
- **Usage**: User's fitness level
- **Values**: 
  - `"Beginner"`
  - `"Intermediate"`
  - `"Advanced"`
- **Required**: No (defaults to "Beginner")
- **Example**: `"Intermediate"`

#### `exercises_details` (JSON Text, Optional)
- **Type**: Text (stores JSON)
- **Usage**: Array of exercise details for the day
- **Format**: JSON array of exercise objects
- **Required**: No (but recommended)
- **Structure**:
```json
[
  {
    "exercise_name": "Push-ups",
    "workout_name": "Chest Workout",
    "name": "Push-ups",
    "sets": 3,
    "reps": 15,
    "weight_kg": 0,
    "weight_min_kg": 0,
    "weight_max_kg": 0,
    "minutes": 5,
    "training_minutes": 5,
    "exercise_type": "Bodyweight",
    "exercise_types": "Bodyweight",
    "notes": "Focus on form",
    "is_completed": false,
    "completed_at": null,
    "id": 1,
    "item_id": 1
  }
]
```

#### `is_completed` (Boolean, Optional)
- **Type**: Boolean
- **Default**: `false`
- **Usage**: Whether the daily plan is completed
- **Required**: No
- **Example**: `true` or `false`

#### `completed_at` (Timestamp, Optional)
- **Type**: Timestamp (nullable)
- **Usage**: When the plan was completed
- **Format**: ISO 8601 (e.g., `"2025-11-04T10:30:00.000Z"`)
- **Required**: No (auto-set when `is_completed = true`)
- **Example**: `"2025-11-04T10:30:00.000Z"` or `null`

### Stats Columns (Only for Stats Records)

#### `is_stats_record` (Boolean, Optional)
- **Type**: Boolean
- **Default**: `false`
- **Usage**: Flag to identify stats records (one per user)
- **Values**: 
  - `false` - Regular daily plan
  - `true` - Stats record (aggregated data)
- **Required**: No
- **Important**: Set to `true` only for stats records, never for regular plans

#### `stats_date_updated` (Timestamp, Optional)
- **Type**: Timestamp (nullable)
- **Usage**: Last time stats were updated
- **Format**: ISO 8601
- **Required**: No (auto-updated)
- **Example**: `"2025-11-04T10:30:00.000Z"`

#### `stats_daily_workouts` (JSON Text, Optional)
- **Type**: Text (stores JSON)
- **Usage**: Daily workouts grouped by date
- **Format**: JSON object where keys are dates
- **Example**:
```json
{
  "2025-11-04": ["Chest", "Cardio"],
  "2025-11-03": ["Legs"],
  "2025-11-02": ["Arms", "Back"]
}
```

#### `stats_total_workouts` (Integer, Optional)
- **Type**: Integer
- **Default**: `0`
- **Usage**: Total number of completed workouts overall
- **Example**: `145`

#### `stats_total_minutes` (Integer, Optional)
- **Type**: Integer
- **Default**: `0`
- **Usage**: Total minutes spent on all workouts
- **Example**: `8250`

#### `stats_longest_streak` (Integer, Optional)
- **Type**: Integer
- **Default**: `0`
- **Usage**: Longest consecutive workout streak in days
- **Example**: `14`

#### `stats_recent_workouts` (JSON Text, Optional)
- **Type**: Text (stores JSON)
- **Usage**: Last 5 unique workout names
- **Format**: JSON array of strings
- **Example**: `["Leg Day", "Cardio", "Chest", "Yoga", "Back"]`

#### `stats_weekly_progress` (JSON Text, Optional)
- **Type**: Text (stores JSON)
- **Usage**: Current week statistics
- **Format**: JSON object
- **Example**:
```json
{
  "completed": 5,
  "remaining": 2,
  "total_minutes": 320,
  "total_workouts": 7
}
```

#### `stats_monthly_progress` (JSON Text, Optional)
- **Type**: Text (stores JSON)
- **Usage**: Current month statistics
- **Format**: JSON object
- **Example**:
```json
{
  "completed": 20,
  "remaining": 10,
  "completion_rate": 66.7,
  "daily_avg": 45,
  "days_passed": 15,
  "total_minutes": 900
}
```

#### `stats_remaining_tasks` (JSON Text, Optional)
- **Type**: Text (stores JSON)
- **Usage**: Pending tasks grouped by timeframe
- **Format**: JSON object
- **Example**:
```json
{
  "today": ["Stretching", "Cardio"],
  "weekly": ["HIIT", "Yoga"],
  "monthly": ["Endurance test"],
  "upcoming": ["Half Marathon"]
}
```

#### `stats_task_completion_report` (JSON Text, Optional)
- **Type**: Text (stores JSON)
- **Usage**: Completion statistics for today, week, and month
- **Format**: JSON object
- **Example**:
```json
{
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
}
```

#### `stats_items` (JSON Text, Optional)
- **Type**: Text (stores JSON)
- **Usage**: All items from all completed plans (aggregated)
- **Format**: JSON array of item objects
- **Example**: Array of exercise items from all workouts

### Metadata Columns

#### `created_at` (Timestamp, Read-only)
- **Type**: Timestamp
- **Usage**: When the record was created
- **Read-only**: Set by database
- **Example**: `"2025-01-15T08:00:00.000Z"`

#### `updated_at` (Timestamp, Read-only)
- **Type**: Timestamp
- **Usage**: When the record was last updated
- **Read-only**: Auto-updated by database
- **Example**: `"2025-11-04T10:30:00.000Z"`

---

## API Endpoints for Mobile App

### 1. Store Daily Plans (Bulk)
**POST** `/api/dailyTraining/mobile/plans/store`

Store multiple daily plans from mobile app.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Payload:**
```json
{
  "plan_type": "manual",
  "user_id": 42,
  "source_plan_id": 123,
  "daily_plans": [
    {
      "plan_date": "2025-11-04",
      "user_level": "Intermediate",
      "plan_category": "Muscle Building",
      "exercises_details": [
        {
          "exercise_name": "Push-ups",
          "workout_name": "Chest Workout",
          "name": "Push-ups",
          "sets": 3,
          "reps": 15,
          "weight_kg": 0,
          "weight_min_kg": 0,
          "weight_max_kg": 0,
          "minutes": 5,
          "training_minutes": 5,
          "exercise_type": "Bodyweight",
          "notes": "Focus on form"
        },
        {
          "exercise_name": "Bench Press",
          "workout_name": "Chest Workout",
          "sets": 3,
          "reps": 12,
          "weight_kg": 80,
          "weight_min_kg": 75,
          "weight_max_kg": 85,
          "minutes": 10,
          "exercise_type": "Strength",
          "notes": null
        }
      ]
    },
    {
      "plan_date": "2025-11-05",
      "user_level": "Intermediate",
      "plan_category": "Muscle Building",
      "exercises_details": [
        {
          "exercise_name": "Squats",
          "workout_name": "Leg Day",
          "sets": 4,
          "reps": 12,
          "weight_kg": 100,
          "minutes": 15,
          "exercise_type": "Strength"
        }
      ]
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
      "user_id": 42,
      "gym_id": 5,
      "plan_date": "2025-11-04",
      "plan_type": "manual",
      "source_plan_id": 123,
      "plan_category": "Muscle Building",
      "user_level": "Intermediate",
      "exercises_details": "[{\"exercise_name\":\"Push-ups\",...}]",
      "is_completed": false,
      "completed_at": null,
      "is_stats_record": false,
      "created_at": "2025-11-04T10:00:00.000Z",
      "updated_at": "2025-11-04T10:00:00.000Z"
    }
  ]
}
```

### 2. Get Daily Plans
**GET** `/api/dailyTraining/mobile/plans`

Get user's daily training plans.

**Query Parameters:**
- `start_date` (optional): Filter from date (YYYY-MM-DD)
- `end_date` (optional): Filter to date (YYYY-MM-DD)

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 42,
      "gym_id": 5,
      "plan_date": "2025-11-04",
      "plan_type": "manual",
      "source_plan_id": 123,
      "plan_category": "Muscle Building",
      "user_level": "Intermediate",
      "exercises_details": "[{\"exercise_name\":\"Push-ups\",...}]",
      "items": [
        {
          "exercise_name": "Push-ups",
          "sets": 3,
          "reps": 15,
          "weight_kg": 0,
          "minutes": 5,
          "exercise_type": "Bodyweight",
          "notes": "Focus on form"
        }
      ],
      "is_completed": false,
      "completed_at": null,
      "created_at": "2025-11-04T10:00:00.000Z",
      "updated_at": "2025-11-04T10:00:00.000Z"
    }
  ]
}
```

### 3. Submit Plan Completion
**POST** `/api/dailyTraining/mobile/complete`

Mark a daily plan as completed with exercise completion data.

**Request Payload:**
```json
{
  "daily_plan_id": 1,
  "completion_data": [
    {
      "item_id": 1,
      "sets_completed": 3,
      "reps_completed": 15,
      "weight_used": 0,
      "minutes_spent": 6,
      "notes": "Completed successfully"
    },
    {
      "item_id": 2,
      "sets_completed": 3,
      "reps_completed": 12,
      "weight_used": 82,
      "minutes_spent": 12,
      "notes": "Increased weight by 2kg"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Daily training completion submitted successfully",
  "data": {
    "daily_plan_id": 1,
    "plan_date": "2025-11-04",
    "is_completed": true,
    "completed_at": "2025-11-04T15:30:00.000Z",
    "items": [
      {
        "exercise_name": "Push-ups",
        "sets": 3,
        "reps": 15,
        "weight_kg": 0,
        "minutes": 6,
        "is_completed": true
      }
    ]
  }
}
```

### 4. Get User Stats
**GET** `/api/stats/mobile`

Get user statistics (reads from stats record).

**Query Parameters:**
- `refresh` (optional, boolean): Force recalculation (default: `false`)

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
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
    "items": [
      {
        "id": 1,
        "exercise_name": "Push-ups",
        "sets": 3,
        "reps": 15,
        "weight_kg": 0,
        "minutes": 5,
        "plan_date": "2025-11-04",
        "is_completed": true
      }
    ]
  }
}
```

### 5. Sync Stats
**POST** `/api/stats/mobile/sync`

Manually trigger stats recalculation.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{}
```

**Response:** Same as Get User Stats

---

## Flutter/Dart Implementation Guide

### 1. Data Models

#### Daily Training Plan Model
```dart
class DailyTrainingPlan {
  final int? id;
  final int userId;
  final int? gymId;
  final String? planDate; // YYYY-MM-DD
  final String planType; // 'manual', 'ai_generated', 'web_assigned'
  final int? sourcePlanId;
  final String planCategory;
  final String? userLevel; // 'Beginner', 'Intermediate', 'Advanced'
  final List<ExerciseDetail> exercisesDetails;
  final bool isCompleted;
  final String? completedAt;
  final bool isStatsRecord; // Should be false for regular plans
  final DateTime? createdAt;
  final DateTime? updatedAt;

  DailyTrainingPlan({
    this.id,
    required this.userId,
    this.gymId,
    this.planDate,
    required this.planType,
    this.sourcePlanId,
    required this.planCategory,
    this.userLevel,
    this.exercisesDetails = const [],
    this.isCompleted = false,
    this.completedAt,
    this.isStatsRecord = false,
    this.createdAt,
    this.updatedAt,
  });

  // Convert to JSON for API
  Map<String, dynamic> toJson() {
    return {
      'plan_date': planDate,
      'user_level': userLevel ?? 'Beginner',
      'plan_category': planCategory,
      'exercises_details': exercisesDetails.map((e) => e.toJson()).toList(),
    };
  }

  // Create from API response
  factory DailyTrainingPlan.fromJson(Map<String, dynamic> json) {
    List<ExerciseDetail> exercises = [];
    try {
      if (json['exercises_details'] != null) {
        final details = json['exercises_details'];
        if (details is String) {
          exercises = (jsonDecode(details) as List)
              .map((e) => ExerciseDetail.fromJson(e))
              .toList();
        } else if (details is List) {
          exercises = details
              .map((e) => ExerciseDetail.fromJson(e))
              .toList();
        }
      }
    } catch (e) {
      print('Error parsing exercises_details: $e');
    }

    // Also check items array (for backward compatibility)
    if (json['items'] != null && exercises.isEmpty) {
      exercises = (json['items'] as List)
          .map((e) => ExerciseDetail.fromJson(e))
          .toList();
    }

    return DailyTrainingPlan(
      id: json['id'],
      userId: json['user_id'],
      gymId: json['gym_id'],
      planDate: json['plan_date'],
      planType: json['plan_type'] ?? 'manual',
      sourcePlanId: json['source_plan_id'],
      planCategory: json['plan_category'],
      userLevel: json['user_level'],
      exercisesDetails: exercises,
      isCompleted: json['is_completed'] ?? false,
      completedAt: json['completed_at'],
      isStatsRecord: json['is_stats_record'] ?? false,
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at']) 
          : null,
      updatedAt: json['updated_at'] != null 
          ? DateTime.parse(json['updated_at']) 
          : null,
    );
  }
}
```

#### Exercise Detail Model
```dart
class ExerciseDetail {
  final int? id;
  final int? itemId;
  final String? exerciseName;
  final String? workoutName;
  final String? name;
  final int sets;
  final int reps;
  final double weightKg;
  final double? weightMinKg;
  final double? weightMaxKg;
  final int minutes;
  final int? trainingMinutes;
  final String? exerciseType;
  final String? exerciseTypes;
  final String? notes;
  final bool isCompleted;
  final String? completedAt;

  ExerciseDetail({
    this.id,
    this.itemId,
    this.exerciseName,
    this.workoutName,
    this.name,
    this.sets = 0,
    this.reps = 0,
    this.weightKg = 0,
    this.weightMinKg,
    this.weightMaxKg,
    this.minutes = 0,
    this.trainingMinutes,
    this.exerciseType,
    this.exerciseTypes,
    this.notes,
    this.isCompleted = false,
    this.completedAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'exercise_name': exerciseName ?? name ?? workoutName,
      'workout_name': workoutName,
      'name': name ?? exerciseName,
      'sets': sets,
      'reps': reps,
      'weight_kg': weightKg,
      if (weightMinKg != null) 'weight_min_kg': weightMinKg,
      if (weightMaxKg != null) 'weight_max_kg': weightMaxKg,
      'minutes': minutes,
      'training_minutes': trainingMinutes ?? minutes,
      'exercise_type': exerciseType ?? exerciseTypes,
      if (notes != null) 'notes': notes,
      'is_completed': isCompleted,
      if (completedAt != null) 'completed_at': completedAt,
      if (id != null) 'id': id,
      if (itemId != null) 'item_id': itemId,
    };
  }

  factory ExerciseDetail.fromJson(Map<String, dynamic> json) {
    return ExerciseDetail(
      id: json['id'],
      itemId: json['item_id'],
      exerciseName: json['exercise_name'] ?? json['name'],
      workoutName: json['workout_name'],
      name: json['name'] ?? json['exercise_name'],
      sets: json['sets'] ?? 0,
      reps: json['reps'] ?? 0,
      weightKg: (json['weight_kg'] ?? 0).toDouble(),
      weightMinKg: json['weight_min_kg']?.toDouble(),
      weightMaxKg: json['weight_max_kg']?.toDouble(),
      minutes: json['minutes'] ?? json['training_minutes'] ?? 0,
      trainingMinutes: json['training_minutes'] ?? json['minutes'],
      exerciseType: json['exercise_type'] ?? json['exercise_types'],
      exerciseTypes: json['exercise_types'] ?? json['exercise_type'],
      notes: json['notes'],
      isCompleted: json['is_completed'] ?? false,
      completedAt: json['completed_at'],
    );
  }
}
```

#### User Stats Model
```dart
class UserStats {
  final int id;
  final int userId;
  final DateTime dateUpdated;
  final Map<String, List<String>> dailyWorkouts;
  final int totalWorkouts;
  final int totalMinutes;
  final int longestStreak;
  final List<String> recentWorkouts;
  final WeeklyProgress weeklyProgress;
  final MonthlyProgress monthlyProgress;
  final RemainingTasks remainingTasks;
  final TaskCompletionReport taskCompletionReport;
  final List<ExerciseDetail> items;

  UserStats({
    required this.id,
    required this.userId,
    required this.dateUpdated,
    required this.dailyWorkouts,
    required this.totalWorkouts,
    required this.totalMinutes,
    required this.longestStreak,
    required this.recentWorkouts,
    required this.weeklyProgress,
    required this.monthlyProgress,
    required this.remainingTasks,
    required this.taskCompletionReport,
    this.items = const [],
  });

  factory UserStats.fromJson(Map<String, dynamic> json) {
    return UserStats(
      id: json['id'],
      userId: json['user_id'],
      dateUpdated: DateTime.parse(json['date_updated']),
      dailyWorkouts: Map<String, List<String>>.from(
        json['daily_workouts']?.map((k, v) => MapEntry(k, List<String>.from(v))) ?? {}
      ),
      totalWorkouts: json['total_workouts'] ?? 0,
      totalMinutes: json['total_minutes'] ?? 0,
      longestStreak: json['longest_streak'] ?? 0,
      recentWorkouts: List<String>.from(json['recent_workouts'] ?? []),
      weeklyProgress: WeeklyProgress.fromJson(json['weekly_progress'] ?? {}),
      monthlyProgress: MonthlyProgress.fromJson(json['monthly_progress'] ?? {}),
      remainingTasks: RemainingTasks.fromJson(json['remaining_tasks'] ?? {}),
      taskCompletionReport: TaskCompletionReport.fromJson(
        json['task_completion_report'] ?? {}
      ),
      items: (json['items'] as List<dynamic>?)
          ?.map((e) => ExerciseDetail.fromJson(e))
          .toList() ?? [],
    );
  }
}

class WeeklyProgress {
  final int completed;
  final int remaining;
  final int totalMinutes;
  final int totalWorkouts;

  WeeklyProgress({
    required this.completed,
    required this.remaining,
    required this.totalMinutes,
    required this.totalWorkouts,
  });

  factory WeeklyProgress.fromJson(Map<String, dynamic> json) {
    return WeeklyProgress(
      completed: json['completed'] ?? 0,
      remaining: json['remaining'] ?? 0,
      totalMinutes: json['total_minutes'] ?? 0,
      totalWorkouts: json['total_workouts'] ?? 0,
    );
  }
}

class MonthlyProgress {
  final int completed;
  final int remaining;
  final double completionRate;
  final int dailyAvg;
  final int daysPassed;
  final int totalMinutes;

  MonthlyProgress({
    required this.completed,
    required this.remaining,
    required this.completionRate,
    required this.dailyAvg,
    required this.daysPassed,
    required this.totalMinutes,
  });

  factory MonthlyProgress.fromJson(Map<String, dynamic> json) {
    return MonthlyProgress(
      completed: json['completed'] ?? 0,
      remaining: json['remaining'] ?? 0,
      completionRate: (json['completion_rate'] ?? 0).toDouble(),
      dailyAvg: json['daily_avg'] ?? 0,
      daysPassed: json['days_passed'] ?? 0,
      totalMinutes: json['total_minutes'] ?? 0,
    );
  }
}

class RemainingTasks {
  final List<String> today;
  final List<String> weekly;
  final List<String> monthly;
  final List<String> upcoming;

  RemainingTasks({
    this.today = const [],
    this.weekly = const [],
    this.monthly = const [],
    this.upcoming = const [],
  });

  factory RemainingTasks.fromJson(Map<String, dynamic> json) {
    return RemainingTasks(
      today: List<String>.from(json['today'] ?? []),
      weekly: List<String>.from(json['weekly'] ?? []),
      monthly: List<String>.from(json['monthly'] ?? []),
      upcoming: List<String>.from(json['upcoming'] ?? []),
    );
  }
}

class TaskCompletionReport {
  final TaskStats today;
  final TaskStats week;
  final TaskStats month;

  TaskCompletionReport({
    required this.today,
    required this.week,
    required this.month,
  });

  factory TaskCompletionReport.fromJson(Map<String, dynamic> json) {
    return TaskCompletionReport(
      today: TaskStats.fromJson(json['today'] ?? {}),
      week: TaskStats.fromJson(json['week'] ?? {}),
      month: TaskStats.fromJson(json['month'] ?? {}),
    );
  }
}

class TaskStats {
  final int completed;
  final int total;

  TaskStats({
    required this.completed,
    required this.total,
  });

  factory TaskStats.fromJson(Map<String, dynamic> json) {
    return TaskStats(
      completed: json['completed'] ?? 0,
      total: json['total'] ?? 0,
    );
  }
}
```

### 2. API Service Class

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class DailyTrainingService {
  final String baseUrl;
  final String token;

  DailyTrainingService({
    required this.baseUrl,
    required this.token,
  });

  // Store multiple daily plans
  Future<List<DailyTrainingPlan>> storeDailyPlans({
    required String planType,
    int? sourcePlanId,
    required List<DailyTrainingPlan> dailyPlans,
  }) async {
    final url = Uri.parse('$baseUrl/api/dailyTraining/mobile/plans/store');
    
    final response = await http.post(
      url,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'plan_type': planType,
        'source_plan_id': sourcePlanId,
        'daily_plans': dailyPlans.map((plan) => plan.toJson()).toList(),
      }),
    );

    if (response.statusCode == 201) {
      final data = json.decode(response.body);
      if (data['success'] == true) {
        return (data['data'] as List)
            .map((p) => DailyTrainingPlan.fromJson(p))
            .toList();
      }
    }
    throw Exception('Failed to store daily plans: ${response.body}');
  }

  // Get daily plans
  Future<List<DailyTrainingPlan>> getDailyPlans({
    String? startDate,
    String? endDate,
  }) async {
    final queryParams = <String, String>{};
    if (startDate != null) queryParams['start_date'] = startDate;
    if (endDate != null) queryParams['end_date'] = endDate;

    final uri = Uri.parse('$baseUrl/api/dailyTraining/mobile/plans')
        .replace(queryParameters: queryParams);

    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['success'] == true) {
        return (data['data'] as List)
            .map((p) => DailyTrainingPlan.fromJson(p))
            .toList();
      }
    }
    throw Exception('Failed to get daily plans: ${response.body}');
  }

  // Submit plan completion
  Future<Map<String, dynamic>> submitCompletion({
    required int dailyPlanId,
    required List<Map<String, dynamic>> completionData,
  }) async {
    final url = Uri.parse('$baseUrl/api/dailyTraining/mobile/complete');

    final response = await http.post(
      url,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'daily_plan_id': dailyPlanId,
        'completion_data': completionData,
      }),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['success'] == true) {
        return data['data'];
      }
    }
    throw Exception('Failed to submit completion: ${response.body}');
  }

  // Get user stats
  Future<UserStats> getStats({bool refresh = false}) async {
    final url = Uri.parse('$baseUrl/api/stats/mobile')
        .replace(queryParameters: refresh ? {'refresh': 'true'} : {});

    final response = await http.get(
      url,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['success'] == true) {
        return UserStats.fromJson(data['data']);
      }
    }
    throw Exception('Failed to get stats: ${response.body}');
  }

  // Sync stats
  Future<UserStats> syncStats() async {
    final url = Uri.parse('$baseUrl/api/stats/mobile/sync');

    final response = await http.post(
      url,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({}),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['success'] == true) {
        return UserStats.fromJson(data['data']);
      }
    }
    throw Exception('Failed to sync stats: ${response.body}');
  }
}
```

### 3. Usage Examples

#### Create Daily Plans
```dart
final service = DailyTrainingService(
  baseUrl: 'https://your-api-url.com',
  token: userToken,
);

final plans = [
  DailyTrainingPlan(
    planDate: '2025-11-04',
    planType: 'manual',
    planCategory: 'Muscle Building',
    userLevel: 'Intermediate',
    exercisesDetails: [
      ExerciseDetail(
        exerciseName: 'Push-ups',
        workoutName: 'Chest Workout',
        sets: 3,
        reps: 15,
        weightKg: 0,
        minutes: 5,
        exerciseType: 'Bodyweight',
      ),
      ExerciseDetail(
        exerciseName: 'Bench Press',
        workoutName: 'Chest Workout',
        sets: 3,
        reps: 12,
        weightKg: 80,
        weightMinKg: 75,
        weightMaxKg: 85,
        minutes: 10,
        exerciseType: 'Strength',
      ),
    ],
  ),
];

try {
  final createdPlans = await service.storeDailyPlans(
    planType: 'manual',
    dailyPlans: plans,
  );
  print('Created ${createdPlans.length} plans');
} catch (e) {
  print('Error: $e');
}
```

#### Get Daily Plans
```dart
try {
  final plans = await service.getDailyPlans(
    startDate: '2025-11-01',
    endDate: '2025-11-30',
  );
  
  for (final plan in plans) {
    print('Plan Date: ${plan.planDate}');
    print('Category: ${plan.planCategory}');
    print('Exercises: ${plan.exercisesDetails.length}');
    print('Completed: ${plan.isCompleted}');
  }
} catch (e) {
  print('Error: $e');
}
```

#### Submit Completion
```dart
try {
  final result = await service.submitCompletion(
    dailyPlanId: 1,
    completionData: [
      {
        'item_id': 1,
        'sets_completed': 3,
        'reps_completed': 15,
        'weight_used': 0,
        'minutes_spent': 6,
        'notes': 'Completed successfully',
      },
      {
        'item_id': 2,
        'sets_completed': 3,
        'reps_completed': 12,
        'weight_used': 82,
        'minutes_spent': 12,
        'notes': 'Increased weight by 2kg',
      },
    ],
  );
  
  print('Plan completed: ${result['is_completed']}');
  print('Completed at: ${result['completed_at']}');
} catch (e) {
  print('Error: $e');
}
```

#### Get User Stats
```dart
try {
  final stats = await service.getStats(refresh: false);
  
  print('Total Workouts: ${stats.totalWorkouts}');
  print('Total Minutes: ${stats.totalMinutes}');
  print('Longest Streak: ${stats.longestStreak} days');
  print('Weekly Progress: ${stats.weeklyProgress.completed}/${stats.weeklyProgress.totalWorkouts}');
  print('Monthly Progress: ${stats.monthlyProgress.completionRate}%');
  
  // Display daily workouts
  stats.dailyWorkouts.forEach((date, workouts) {
    print('$date: ${workouts.join(", ")}');
  });
  
  // Display recent workouts
  print('Recent Workouts: ${stats.recentWorkouts.join(", ")}');
  
  // Display remaining tasks
  print('Today Tasks: ${stats.remainingTasks.today.join(", ")}');
  print('Weekly Tasks: ${stats.remainingTasks.weekly.join(", ")}');
  
} catch (e) {
  print('Error: $e');
}
```

---

## Column Usage Summary

### For Regular Daily Plans (is_stats_record = false)

**Required Columns:**
- `user_id` - From JWT token
- `plan_date` - Date of workout (YYYY-MM-DD)
- `plan_type` - "manual", "ai_generated", or "web_assigned"
- `plan_category` - Category name

**Optional Columns:**
- `gym_id` - Auto from token
- `source_plan_id` - Link to source plan
- `user_level` - Fitness level (defaults to "Beginner")
- `exercises_details` - JSON array of exercises
- `is_completed` - Completion status
- `completed_at` - Completion timestamp

**Don't Set:**
- `id` - Auto-generated
- `is_stats_record` - Always `false` for regular plans
- `stats_*` columns - Only for stats records
- `created_at`, `updated_at` - Auto-managed

### For Stats Records (is_stats_record = true)

**Important:** Stats records are managed automatically by the API. You should NOT create them manually.

**To Get Stats:**
- Use `GET /api/stats/mobile` endpoint
- Stats are automatically calculated from regular plans
- One stats record per user (created automatically)

**Stats Record Structure:**
- `is_stats_record = true`
- `plan_date = null`
- `plan_type = "stats_record"`
- `plan_category = "Stats"`
- All `stats_*` columns contain aggregated data

---

## Best Practices

1. **Always use `exercises_details` JSON** - Don't try to set individual columns like `total_exercises`, `training_minutes`, etc. These are calculated from `exercises_details`.

2. **Workout names** - Store in `exercises_details` array, not in a separate `workout_name` column (removed).

3. **Stats are auto-synced** - When you complete a plan, stats are automatically updated. You don't need to manually sync unless you want to force a refresh.

4. **Parse `exercises_details` carefully** - It's a JSON string in the database, but parsed as an object/array in responses.

5. **Use `items` array** - Some endpoints return `items` array which is the parsed version of `exercises_details`.

6. **Date format** - Always use `YYYY-MM-DD` format for dates.

7. **Completion data** - Use `item_id` from `exercises_details` array when submitting completion.

---

## Error Handling

### Common Errors

**400 Bad Request:**
- Missing required fields
- Invalid date format
- `exercises_details` not an array

**401 Unauthorized:**
- Invalid or missing token

**404 Not Found:**
- Plan not found
- Stats not found (will auto-create on first sync)

**500 Internal Server Error:**
- Server error (check logs)

### Error Response Format
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Complete Example: Full Workflow

```dart
// 1. Create daily plans
final plans = [
  DailyTrainingPlan(
    planDate: DateTime.now().toIso8601String().split('T')[0],
    planType: 'manual',
    planCategory: 'Muscle Building',
    userLevel: 'Intermediate',
    exercisesDetails: [
      ExerciseDetail(
        exerciseName: 'Squats',
        sets: 4,
        reps: 12,
        weightKg: 100,
        minutes: 15,
        exerciseType: 'Strength',
      ),
    ],
  ),
];

await service.storeDailyPlans(planType: 'manual', dailyPlans: plans);

// 2. Get plans for today
final todayPlans = await service.getDailyPlans(
  startDate: DateTime.now().toIso8601String().split('T')[0],
  endDate: DateTime.now().toIso8601String().split('T')[0],
);

// 3. Complete a plan
if (todayPlans.isNotEmpty) {
  final plan = todayPlans.first;
  final completionData = plan.exercisesDetails.map((exercise) => {
    return {
      'item_id': exercise.id ?? exercise.itemId,
      'sets_completed': exercise.sets,
      'reps_completed': exercise.reps,
      'weight_used': exercise.weightKg,
      'minutes_spent': exercise.minutes,
      'notes': 'Completed',
    };
  }).toList();

  await service.submitCompletion(
    dailyPlanId: plan.id!,
    completionData: completionData,
  );
}

// 4. Get updated stats
final stats = await service.getStats(refresh: true);
print('Stats updated: ${stats.totalWorkouts} workouts');
```

---

## Notes

- **All stats are calculated from `daily_training_plans` and `daily_training_plan_items` tables** (items table is now removed, but stats calculation supports both)
- **Stats sync automatically** when plans are completed
- **One stats record per user** with `is_stats_record = true`
- **Regular plans** have `is_stats_record = false` and `plan_date` set
- **Stats records** have `is_stats_record = true` and `plan_date = null`

---

## Support

For issues or questions, contact the backend development team.

