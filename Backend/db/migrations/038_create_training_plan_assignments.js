exports.up = function (knex) {
  return knex.schema.createTable('training_plan_assignments', (table) => {
    table.increments('id').primary();
    table.integer('gym_id').unsigned().index();
    table.integer('web_plan_id').unsigned().notNullable().index(); // references training_plans.id
    table.integer('trainer_id').unsigned().notNullable().index(); // assignee
    table.integer('user_id').unsigned().notNullable().index();

    table.date('start_date');
    table.date('end_date');
    table.string('category');
    table.string('user_level');
    table.string('status').defaultTo('PLANNED');

    table.integer('total_workouts').defaultTo(0);
    table.integer('total_exercises').defaultTo(0);
    table.integer('training_minutes').defaultTo(0);
    table.integer('sets').defaultTo(0);
    table.integer('reps').defaultTo(0);
    table.integer('weight_kg').defaultTo(0);

    table.text('exercises_details'); // JSON string snapshot for assignment

    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('training_plan_assignments');
};


