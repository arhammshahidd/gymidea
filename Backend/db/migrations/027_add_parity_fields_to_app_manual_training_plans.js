/**
 * Add parity fields to app_manual_training_plans to match web training_plans table
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('app_manual_training_plans', (table) => {
    // Align with web training_plans
    table.string('status', 24).notNullable().defaultTo('PLANNED'); // PLANNED | ACTIVE | COMPLETED | CANCELLED
    table.text('exercises_details').nullable(); // JSON string of detailed exercises
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('app_manual_training_plans', (table) => {
    table.dropColumn('status');
    table.dropColumn('exercises_details');
  });
};


