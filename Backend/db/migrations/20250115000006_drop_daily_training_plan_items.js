/**
 * Drop daily_training_plan_items table
 * All items data is now stored in daily_training_plans stats record as JSON
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.dropTableIfExists('daily_training_plan_items');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // Recreate daily_training_plan_items table if needed to rollback
  return knex.schema.createTable('daily_training_plan_items', (table) => {
    table.increments('id').primary();
    table.integer('daily_plan_id').notNullable().references('id').inTable('daily_training_plans').onDelete('CASCADE');
    table.string('exercise_name').notNullable();
    table.integer('sets').defaultTo(0);
    table.integer('reps').defaultTo(0);
    table.decimal('weight_kg', 10, 2).defaultTo(0);
    table.decimal('weight_min_kg', 10, 2).nullable();
    table.decimal('weight_max_kg', 10, 2).nullable();
    table.integer('minutes').defaultTo(0);
    table.string('exercise_type').nullable();
    table.text('notes').nullable();
    table.boolean('is_completed').defaultTo(false);
    table.timestamp('completed_at').nullable();
    table.timestamps(true, true);
    table.index(['daily_plan_id', 'is_completed']);
  });
};

