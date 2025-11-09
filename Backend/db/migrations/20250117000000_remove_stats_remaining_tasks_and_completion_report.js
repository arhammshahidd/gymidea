/**
 * Remove stats_remaining_tasks and stats_task_completion_report columns from daily_training_plans
 * These columns are no longer needed as per user request
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('daily_training_plans', (table) => {
    table.dropColumn('stats_remaining_tasks');
    table.dropColumn('stats_task_completion_report');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('daily_training_plans', (table) => {
    table.text('stats_remaining_tasks').nullable();
    table.text('stats_task_completion_report').nullable();
  });
};

