/**
 * Add weight_min_kg and weight_max_kg columns to daily_training_plan_items
 * for AI Generated Plans to store weight ranges
 * NOTE: This table was dropped in migration 20250115000006, so this migration is now a no-op
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if table exists before trying to alter it
  const hasTable = await knex.schema.hasTable('daily_training_plan_items');
  if (hasTable) {
    return knex.schema.alterTable('daily_training_plan_items', function(table) {
      table.decimal('weight_min_kg', 10, 2).nullable().after('weight_kg');
      table.decimal('weight_max_kg', 10, 2).nullable().after('weight_min_kg');
    });
  }
  // Table doesn't exist, skip this migration
  return Promise.resolve();
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('daily_training_plan_items');
  if (hasTable) {
    return knex.schema.alterTable('daily_training_plan_items', function(table) {
      table.dropColumn('weight_min_kg');
      table.dropColumn('weight_max_kg');
    });
  }
  return Promise.resolve();
};

