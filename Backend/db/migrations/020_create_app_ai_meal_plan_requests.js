exports.up = async function(knex) {
  await knex.schema.createTable('app_ai_meal_plan_requests', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('gym_id').nullable();
    table.string('meal_plan').notNullable();
    table.integer('age').notNullable();
    table.decimal('height_cm', 6, 2).notNullable();
    table.decimal('weight_kg', 6, 2).notNullable();
    table.enum('gender', ['male', 'female', 'other']).notNullable();
    table.string('country').notNullable();
    table.string('illness').nullable();
    table.string('future_goal').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('app_ai_meal_plan_requests');
};

