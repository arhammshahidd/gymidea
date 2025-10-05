/**
 * Add missing fields to training_approvals table to support the new data structure
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('training_approvals', (table) => {
    // Add only the missing fields that don't already exist
    table.integer('plan_id').nullable();
    table.string('plan_type', 32).defaultTo('manual');
    table.string('exercise_plan_category', 64).nullable();
    table.text('items').nullable(); // JSON string for all exercises
    table.text('daily_plans').nullable(); // JSON string for daily plans
    table.integer('total_exercises').defaultTo(0);
    table.text('exercises_details').nullable(); // Keep for backward compatibility
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('training_approvals', (table) => {
    table.dropColumn('plan_id');
    table.dropColumn('plan_type');
    table.dropColumn('exercise_plan_category');
    table.dropColumn('items');
    table.dropColumn('daily_plans');
    table.dropColumn('total_exercises');
    table.dropColumn('exercises_details');
  });
};
