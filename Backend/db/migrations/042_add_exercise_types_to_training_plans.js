/**
 * Add exercise_types column to training_plans table
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    table.string('exercise_types', 64).nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    table.dropColumn('exercise_types');
  });
};
