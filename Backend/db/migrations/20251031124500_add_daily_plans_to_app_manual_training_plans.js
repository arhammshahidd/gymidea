/**
 * Add daily_plans column to app_manual_training_plans to store manual plan distribution
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('app_manual_training_plans', function(table) {
    table.text('daily_plans').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('app_manual_training_plans', function(table) {
    table.dropColumn('daily_plans');
  });
};


