/**
 * Add ai_meal_plan_id field to approval_food_menu table to link approvals to original AI meal plans
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('approval_food_menu', function(table) {
    table.integer('ai_meal_plan_id').nullable().references('id').inTable('app_ai_generated_meal_plans').onDelete('SET NULL');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('approval_food_menu', function(table) {
    table.dropColumn('ai_meal_plan_id');
  });
};
