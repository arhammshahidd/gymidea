/**
 * Add stats-related columns to daily_training_plan_items table for enhanced tracking
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('daily_training_plan_items', (table) => {
    // Add any stats-related columns that might be useful for item-level tracking
    // These can be used for detailed stats calculations
    table.timestamp('completed_at').nullable().after('is_completed');
    
    // Index for faster stats queries
    table.index(['daily_plan_id', 'is_completed']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('daily_training_plan_items', (table) => {
    table.dropIndex(['daily_plan_id', 'is_completed']);
    table.dropColumn('completed_at');
  });
};

