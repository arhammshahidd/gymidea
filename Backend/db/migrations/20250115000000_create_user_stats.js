/**
 * Create user_stats table for storing aggregated workout statistics
 * Calculated from daily_training_plans and daily_training_plan_items tables
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_stats', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    
    // Timestamp tracking
    table.timestamp('date_updated').defaultTo(knex.fn.now());
    
    // Daily workouts tracking (JSON)
    // Format: { "2025-11-04": ["Chest", "Arms"], "2025-11-03": ["Cardio"] }
    table.text('daily_workouts').nullable(); // JSON string
    
    // Overall statistics
    table.integer('total_workouts').defaultTo(0);
    table.integer('total_minutes').defaultTo(0);
    table.integer('longest_streak').defaultTo(0);
    
    // Recent workouts (JSON array)
    // Format: ["Leg Day", "Chest Press", "Yoga", "Arms", "Cardio"]
    table.text('recent_workouts').nullable(); // JSON string
    
    // Weekly progress (JSON)
    // Format: { "completed": 5, "remaining": 2, "total_minutes": 320, "total_workouts": 7 }
    table.text('weekly_progress').nullable(); // JSON string
    
    // Monthly progress (JSON)
    // Format: { "completed": 20, "remaining": 10, "completion_rate": 66.7, "daily_avg": 45, "days_passed": 15, "total_minutes": 900 }
    table.text('monthly_progress').nullable(); // JSON string
    
    // Remaining tasks (JSON)
    // Format: { "today": ["Run 2km"], "weekly": ["Yoga session"], "monthly": ["Endurance test"], "upcoming": ["Marathon prep"] }
    table.text('remaining_tasks').nullable(); // JSON string
    
    // Task completion report (JSON)
    // Format: { "today": { "completed": 2, "total": 3 }, "week": { "completed": 5, "total": 7 }, "month": { "completed": 15, "total": 20 } }
    table.text('task_completion_report').nullable(); // JSON string
    
    // Metadata
    table.timestamps(true, true);
    
    // Indexes for performance
    table.index('user_id');
    table.index('date_updated');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_stats');
};

