/**
 * Remove workout_name column from daily_training_plans table
 * Workout name can be derived from exercises_details JSON if needed
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('daily_training_plans', (table) => {
    table.dropColumn('workout_name');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('daily_training_plans', (table) => {
    table.string('workout_name').nullable();
  });
};

