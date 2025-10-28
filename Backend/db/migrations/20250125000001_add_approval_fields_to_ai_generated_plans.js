/**
 * Add approval fields to app_ai_generated_plans table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('app_ai_generated_plans', function(table) {
    table.string('approval_status', 32).defaultTo('PENDING'); // PENDING, APPROVED, REJECTED
    table.integer('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('approved_at').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('app_ai_generated_plans', function(table) {
    table.dropColumn('approval_status');
    table.dropColumn('approved_by');
    table.dropColumn('approved_at');
  });
};
