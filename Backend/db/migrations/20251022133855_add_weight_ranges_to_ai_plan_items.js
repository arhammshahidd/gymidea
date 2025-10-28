/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('app_ai_generated_plan_items', function(table) {
    table.decimal('weight_min_kg', 8, 2).nullable();
    table.decimal('weight_max_kg', 8, 2).nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('app_ai_generated_plan_items', function(table) {
    table.dropColumn('weight_min_kg');
    table.dropColumn('weight_max_kg');
  });
};
