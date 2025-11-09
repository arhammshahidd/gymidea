/**
 * Ensure daily_plans column exists in training_plans and training_plan_assignments tables
 * This migration is a safety check to ensure the column exists even if the previous migration had issues
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = async function(knex) {
  // Check if columns exist before adding
  const hasDailyPlansInTrainingPlans = await knex.schema.hasColumn('training_plans', 'daily_plans');
  const hasDailyPlansInAssignments = await knex.schema.hasColumn('training_plan_assignments', 'daily_plans');

  console.log('Checking daily_plans column in training_plans:', hasDailyPlansInTrainingPlans);
  console.log('Checking daily_plans column in training_plan_assignments:', hasDailyPlansInAssignments);

  // Add daily_plans column to training_plans table if it doesn't exist
  if (!hasDailyPlansInTrainingPlans) {
    console.log('Adding daily_plans column to training_plans table...');
    await knex.schema.alterTable('training_plans', (table) => {
      table.text('daily_plans').nullable().comment('JSON string with distributed daily plans');
    });
    console.log('✅ Added daily_plans column to training_plans table');
  } else {
    console.log('✅ daily_plans column already exists in training_plans table');
  }

  // Add daily_plans column to training_plan_assignments table if it doesn't exist
  if (!hasDailyPlansInAssignments) {
    console.log('Adding daily_plans column to training_plan_assignments table...');
    await knex.schema.alterTable('training_plan_assignments', (table) => {
      table.text('daily_plans').nullable().comment('JSON string with distributed daily plans from the source training plan');
    });
    console.log('✅ Added daily_plans column to training_plan_assignments table');
  } else {
    console.log('✅ daily_plans column already exists in training_plan_assignments table');
  }
};

exports.down = async function(knex) {
  // Remove daily_plans column from training_plan_assignments table
  const hasDailyPlansInAssignments = await knex.schema.hasColumn('training_plan_assignments', 'daily_plans');
  if (hasDailyPlansInAssignments) {
    await knex.schema.alterTable('training_plan_assignments', (table) => {
      table.dropColumn('daily_plans');
    });
  }

  // Remove daily_plans column from training_plans table
  const hasDailyPlansInTrainingPlans = await knex.schema.hasColumn('training_plans', 'daily_plans');
  if (hasDailyPlansInTrainingPlans) {
    await knex.schema.alterTable('training_plans', (table) => {
      table.dropColumn('daily_plans');
    });
  }
};

