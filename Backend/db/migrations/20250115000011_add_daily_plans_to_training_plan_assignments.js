/**
 * Add daily_plans column to training_plans and training_plan_assignments tables
 * This column stores the distributed daily plans as JSON
 * This migration is idempotent - it checks if columns exist before adding them
 */

exports.up = async function(knex) {
  // Check if columns exist before adding
  const hasDailyPlansInTrainingPlans = await knex.schema.hasColumn('training_plans', 'daily_plans');
  const hasDailyPlansInAssignments = await knex.schema.hasColumn('training_plan_assignments', 'daily_plans');

  // Add daily_plans column to training_plans table if it doesn't exist
  if (!hasDailyPlansInTrainingPlans) {
    await knex.schema.alterTable('training_plans', (table) => {
      table.text('daily_plans').nullable().comment('JSON string with distributed daily plans');
    });
  }

  // Add daily_plans column to training_plan_assignments table if it doesn't exist
  if (!hasDailyPlansInAssignments) {
    await knex.schema.alterTable('training_plan_assignments', (table) => {
      table.text('daily_plans').nullable().comment('JSON string with distributed daily plans from the source training plan');
    });
  }
};

exports.down = async function(knex) {
  // Remove daily_plans column from training_plan_assignments table
  await knex.schema.alterTable('training_plan_assignments', (table) => {
    table.dropColumn('daily_plans');
  });

  // Remove daily_plans column from training_plans table
  await knex.schema.alterTable('training_plans', (table) => {
    table.dropColumn('daily_plans');
  });
};

