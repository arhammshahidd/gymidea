/**
 * Drop user_stats table since stats are now stored in daily_training_plans table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.dropTableIfExists('user_stats');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // Recreate user_stats table if needed to rollback
  return knex.schema.createTable('user_stats', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('date_updated').defaultTo(knex.fn.now());
    table.text('daily_workouts').nullable();
    table.integer('total_workouts').defaultTo(0);
    table.integer('total_minutes').defaultTo(0);
    table.integer('longest_streak').defaultTo(0);
    table.text('recent_workouts').nullable();
    table.text('weekly_progress').nullable();
    table.text('monthly_progress').nullable();
    table.text('remaining_tasks').nullable();
    table.text('task_completion_report').nullable();
    table.timestamps(true, true);
    table.index('user_id');
    table.index('date_updated');
  });
};

