/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('training_approvals', function(table) {
    table.string('source', 32).defaultTo('manual'); // 'manual', 'mobile_app', 'ai'
    table.timestamp('requested_at').nullable(); // When the plan was requested
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('training_approvals', function(table) {
    table.dropColumn('source');
    table.dropColumn('requested_at');
  });
};
