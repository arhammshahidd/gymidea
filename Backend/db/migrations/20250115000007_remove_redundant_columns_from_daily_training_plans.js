/**
 * Remove redundant columns from daily_training_plans that can be calculated from exercises_details JSON
 * These columns consume unnecessary space and duplicate data already in exercises_details
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Remove redundant aggregated columns that can be calculated from exercises_details JSON
  // These are only needed for regular plan rows (not stats records)
  // Stats records use stats_* columns, and regular plans can calculate these from exercises_details
  return knex.schema.alterTable('daily_training_plans', (table) => {
    // Remove columns that duplicate data in exercises_details JSON
    // These can be calculated from exercises_details when needed
    table.dropColumn('total_exercises');
    table.dropColumn('total_sets');
    table.dropColumn('total_reps');
    table.dropColumn('total_weight_kg');
    table.dropColumn('training_minutes');
    
    // Remove completion_notes as it's not essential and can be stored in exercises_details if needed
    table.dropColumn('completion_notes');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Re-add the columns if rolling back
  return knex.schema.alterTable('daily_training_plans', (table) => {
    table.integer('total_exercises').defaultTo(0);
    table.integer('total_sets').defaultTo(0);
    table.integer('total_reps').defaultTo(0);
    table.decimal('total_weight_kg', 10, 2).defaultTo(0);
    table.integer('training_minutes').defaultTo(0);
    table.text('completion_notes').nullable();
  });
};

