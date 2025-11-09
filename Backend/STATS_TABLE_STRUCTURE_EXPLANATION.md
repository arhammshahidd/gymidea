# Daily Training Plans Table Structure Explanation

## Overview

The `daily_training_plans` table serves a **dual purpose** - it stores both:
1. **Individual Daily Plans** (one per day per user)
2. **User Statistics Record** (one per user)

This is **NOT a bug** - it's an intentional design choice to store both types of data in the same table.

## Two Types of Rows

### Type 1: Regular Daily Plans
- **Identified by**: `is_stats_record = false`
- **Characteristics**:
  - Has a `plan_date` (e.g., `2025-11-01`)
  - Contains `exercises_details` with workout data
  - Can be `is_completed = true` or `false`
  - One row per day per user

**Example Row:**
```
id: 651
user_id: 2
plan_date: 2025-11-01
plan_type: web_assigned
is_completed: true
is_stats_record: false
exercises_details: {"workouts":[{"name":"Chest",...},{"name":"Back",...}]}
stats_daily_workouts: NULL
stats_weekly_progress: NULL
```

### Type 2: Stats Record
- **Identified by**: `is_stats_record = true`
- **Characteristics**:
  - `plan_date = NULL` (stats don't have a specific date)
  - `plan_type = 'stats_record'`
  - `plan_category = 'Stats'`
  - `is_completed = false` (stats record is never "completed")
  - `exercises_details = NULL` (stats don't have workout details)
  - Contains aggregated statistics in `stats_*` columns
  - **One row per user** (aggregated from all their daily plans)

**Example Row:**
```
id: 652
user_id: 2
plan_date: NULL
plan_type: stats_record
plan_category: Stats
is_completed: false
is_stats_record: true
exercises_details: NULL
stats_daily_workouts: {"2025-11-01":["Chest","Back"],"2025-11-02":["Chest","Back"]}
stats_weekly_progress: {"completed":3,"total_workouts":6,...}
stats_monthly_progress: {"completed":3,"total_workouts":6,...}
stats_total_workouts: 6
stats_longest_streak: 3
```

## Why This Structure?

1. **Performance**: Aggregated stats are pre-calculated and stored, avoiding recalculation on every request
2. **Consistency**: Both daily plans and stats are in the same table, making queries simpler
3. **Efficiency**: One stats record per user instead of separate table

## How It Works

1. **When a workout is completed**:
   - The daily plan row is updated (`is_completed = true`, `exercises_details` updated)
   - The stats record is automatically recalculated and updated

2. **When stats are queried**:
   - Query: `WHERE user_id = X AND is_stats_record = true`
   - Returns the aggregated stats record

3. **When daily plans are queried**:
   - Query: `WHERE user_id = X AND is_stats_record = false`
   - Returns all individual daily plans

## Important Notes

- **The two rows are DIFFERENT records** - they serve different purposes
- **Stats record is automatically updated** when workouts are completed
- **Stats record has NULL values** for plan-specific columns (plan_date, exercises_details, etc.)
- **Stats record has data** in stats_* columns (stats_daily_workouts, stats_weekly_progress, etc.)

## Filtering

Always filter by `is_stats_record` when querying:
- For daily plans: `WHERE is_stats_record = false`
- For stats: `WHERE is_stats_record = true`

This ensures you get the correct type of data.

