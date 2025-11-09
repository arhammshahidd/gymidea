/**
 * Add weight_min_kg and weight_max_kg columns to app_manual_training_plan_items
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('app_manual_training_plan_items', function(table) {
    table.decimal('weight_min_kg', 10, 2).nullable().after('weight_kg');
    table.decimal('weight_max_kg', 10, 2).nullable().after('weight_min_kg');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('app_manual_training_plan_items', function(table) {
    table.dropColumn('weight_min_kg');
    table.dropColumn('weight_max_kg');
  });
};

