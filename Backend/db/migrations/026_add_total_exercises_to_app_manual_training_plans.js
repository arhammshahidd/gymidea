/**
 * Add total_exercises field to app_manual_training_plans table
 * This field represents the total number of exercises in a particular workout
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('app_manual_training_plans', (table) => {
    table.integer('total_exercises').defaultTo(0).after('total_workouts');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('app_manual_training_plans', (table) => {
    table.dropColumn('total_exercises');
  });
};
