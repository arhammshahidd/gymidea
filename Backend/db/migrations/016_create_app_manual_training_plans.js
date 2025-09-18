exports.up = async function(knex) {
  await knex.schema.createTable('app_manual_training_plans', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('gym_id').nullable();
    table.string('exercise_plan_category').notNullable();
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.integer('total_workouts').defaultTo(0);
    table.integer('training_minutes').defaultTo(0);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('app_manual_training_plan_items', (table) => {
    table.increments('id').primary();
    table.integer('plan_id').notNullable().references('id').inTable('app_manual_training_plans').onDelete('CASCADE');
    table.string('workout_name').notNullable();
    table.integer('sets').defaultTo(0);
    table.integer('reps').defaultTo(0);
    table.decimal('weight_kg', 8, 2).defaultTo(0);
    table.integer('minutes').defaultTo(0);
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('app_manual_training_plan_items');
  await knex.schema.dropTableIfExists('app_manual_training_plans');
};

