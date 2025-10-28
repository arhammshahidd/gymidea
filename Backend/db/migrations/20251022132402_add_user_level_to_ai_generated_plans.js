/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('app_ai_generated_plans', function(table) {
    table.string('user_level').defaultTo('Beginner');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('app_ai_generated_plans', function(table) {
    table.dropColumn('user_level');
  });
};
