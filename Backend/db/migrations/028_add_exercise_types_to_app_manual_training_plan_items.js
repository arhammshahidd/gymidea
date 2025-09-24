/**
 * Add exercise_types column to app_manual_training_plan_items
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('app_manual_training_plan_items', (table) => {
    table.string('exercise_types', 64).nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('app_manual_training_plan_items', (table) => {
    table.dropColumn('exercise_types');
  });
};


