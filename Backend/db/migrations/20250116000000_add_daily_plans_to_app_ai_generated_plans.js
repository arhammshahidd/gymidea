/**
 * Add daily_plans column to app_ai_generated_plans to store AI plan distribution
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('app_ai_generated_plans', function(table) {
    table.text('daily_plans').nullable().comment('JSON string with distributed daily plans');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('app_ai_generated_plans', function(table) {
    table.dropColumn('daily_plans');
  });
};

