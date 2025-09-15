/**
 * Create table: training_plans
 * Scopes rows by gym_id so each gym/admin sees their own plans.
 */

exports.up = async function(knex) {
  await knex.schema.createTable('training_plans', (table) => {
    table.increments('id').primary();
    table.integer('gym_id').notNullable().index();
    table.integer('trainer_id').nullable().index();
    table.integer('user_id').nullable().index();

    // Date range for the plan
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();

    // Category: Muscle Gain, Muscle Lose, Strength
    table.string('category', 32).notNullable();

    // Workout details
    table.string('workout_name', 120).notNullable();
    table.integer('total_workouts').defaultTo(0);
    table.integer('training_minutes').defaultTo(0);
    table.integer('sets').defaultTo(0);
    table.integer('reps').defaultTo(0);
    table.decimal('weight_kg', 8, 2).defaultTo(0);

    // Optional status for schedule lifecycle
    table.string('status', 24).notNullable().defaultTo('PLANNED'); // PLANNED | ACTIVE | COMPLETED | CANCELLED

    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('training_plans');
};


