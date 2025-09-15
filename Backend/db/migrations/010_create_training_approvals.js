/**
 * Create table: training_approvals
 * Holds per-user training approval detail records.
 */

exports.up = async function(knex) {
  await knex.schema.createTable('training_approvals', (table) => {
    table.increments('id').primary();
    table.integer('gym_id').notNullable().index();
    table.integer('user_id').notNullable().index();
    table.string('user_name', 120).notNullable();
    table.string('user_phone', 32).notNullable();

    table.date('start_date').notNullable();
    table.date('end_date').notNullable();

    table.string('workout_name', 120).notNullable();
    table.integer('sets').defaultTo(0);
    table.integer('reps').defaultTo(0);
    table.decimal('weight_kg', 8, 2).defaultTo(0);

    table.string('category', 32).notNullable();
    table.integer('total_training_minutes').defaultTo(0);
    table.integer('total_workouts').defaultTo(0);

    table.string('approval_status', 24).notNullable().defaultTo('PENDING'); // PENDING | APPROVED | REJECTED
    table.text('notes');

    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('training_approvals');
};


