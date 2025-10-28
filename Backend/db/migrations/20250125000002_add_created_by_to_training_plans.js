/**
 * Add created_by field to training_plans table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('training_plans', function(table) {
    table.integer('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('training_plans', function(table) {
    table.dropColumn('created_by');
  });
};
