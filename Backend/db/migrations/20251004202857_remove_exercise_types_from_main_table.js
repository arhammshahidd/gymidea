/**
 * Remove exercise_types column from training_plans table
 * exercise_types will now be stored in exercises_details JSON for each exercise
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    table.dropColumn('exercise_types');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    table.text('exercise_types').nullable();
  });
};