/**
 * Add stats columns to daily_training_plans table
 * Stats will be calculated and stored per user (aggregated from all plans)
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('daily_training_plans', (table) => {
    // Add stats columns for user-level aggregated stats
    // These will be stored in a single row per user (identified by a flag or calculated on-the-fly)
    table.timestamp('stats_date_updated').nullable().after('updated_at');
    
    // Daily workouts tracking (JSON)
    // Format: { "2025-11-04": ["Chest", "Arms"], "2025-11-03": ["Cardio"] }
    table.text('stats_daily_workouts').nullable();
    
    // Overall statistics
    table.integer('stats_total_workouts').nullable().defaultTo(0);
    table.integer('stats_total_minutes').nullable().defaultTo(0);
    table.integer('stats_longest_streak').nullable().defaultTo(0);
    
    // Recent workouts (JSON array)
    // Format: ["Leg Day", "Chest Press", "Yoga", "Arms", "Cardio"]
    table.text('stats_recent_workouts').nullable();
    
    // Weekly progress (JSON)
    // Format: { "completed": 5, "remaining": 2, "total_minutes": 320, "total_workouts": 7 }
    table.text('stats_weekly_progress').nullable();
    
    // Monthly progress (JSON)
    // Format: { "completed": 20, "remaining": 10, "completion_rate": 66.7, "daily_avg": 45, "days_passed": 15, "total_minutes": 900 }
    table.text('stats_monthly_progress').nullable();
    
    // Remaining tasks (JSON)
    // Format: { "today": ["Run 2km"], "weekly": ["Yoga session"], "monthly": ["Endurance test"], "upcoming": ["Marathon prep"] }
    table.text('stats_remaining_tasks').nullable();
    
    // Task completion report (JSON)
    // Format: { "today": { "completed": 2, "total": 3 }, "week": { "completed": 5, "total": 7 }, "month": { "completed": 15, "total": 20 } }
    table.text('stats_task_completion_report').nullable();
    
    // Flag to indicate this is a stats record (not a regular plan)
    table.boolean('is_stats_record').defaultTo(false).after('is_completed');
    
    // Add index for faster stats retrieval
    table.index(['user_id', 'is_stats_record']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('daily_training_plans', (table) => {
    table.dropIndex(['user_id', 'is_stats_record']);
    table.dropColumn('is_stats_record');
    table.dropColumn('stats_task_completion_report');
    table.dropColumn('stats_remaining_tasks');
    table.dropColumn('stats_monthly_progress');
    table.dropColumn('stats_weekly_progress');
    table.dropColumn('stats_recent_workouts');
    table.dropColumn('stats_longest_streak');
    table.dropColumn('stats_total_minutes');
    table.dropColumn('stats_total_workouts');
    table.dropColumn('stats_daily_workouts');
    table.dropColumn('stats_date_updated');
  });
};

