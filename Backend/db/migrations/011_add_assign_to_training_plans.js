/**
 * Add assign_to field to training_plans table
 * This field will store the trainer ID who the plan is assigned to
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    table.integer('assign_to').nullable().index().comment('Trainer ID who the plan is assigned to');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    table.dropColumn('assign_to');
  });
};
