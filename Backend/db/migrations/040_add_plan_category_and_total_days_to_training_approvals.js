/**
 * Add plan_category_name and total_days fields to training_approvals table
 * to support the approval training card details and view page requirements
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('training_approvals', (table) => {
    table.string('plan_category_name', 120).nullable(); // Plan Category Name for card display
    table.integer('total_days').defaultTo(0); // Total Days calculated from start_date to end_date
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('training_approvals', (table) => {
    table.dropColumn('plan_category_name');
    table.dropColumn('total_days');
  });
};
