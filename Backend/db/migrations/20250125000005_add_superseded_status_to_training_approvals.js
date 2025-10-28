/**
 * Add SUPERSEDED status to training_approvals table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('training_approvals', function(table) {
    // Update the approval_status column to include SUPERSEDED
    table.string('approval_status', 32).defaultTo('PENDING').alter(); // PENDING, APPROVED, REJECTED, SUPERSEDED
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('training_approvals', function(table) {
    // Revert to original status values
    table.string('approval_status', 32).defaultTo('PENDING').alter();
  });
};
