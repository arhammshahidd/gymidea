exports.up = async function(knex) {
  await knex.schema.createTable('app_manual_meal_plans', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('gym_id').nullable();
    table.string('meal_category').notNullable();
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.decimal('total_calories', 10, 2).defaultTo(0);
    table.decimal('total_proteins', 10, 2).defaultTo(0);
    table.decimal('total_fats', 10, 2).defaultTo(0);
    table.decimal('total_carbs', 10, 2).defaultTo(0);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('app_manual_meal_plan_items', (table) => {
    table.increments('id').primary();
    table.integer('plan_id').notNullable().references('id').inTable('app_manual_meal_plans').onDelete('CASCADE');
    table.date('date').nullable();
    table.enum('meal_type', ['Breakfast', 'Lunch', 'Dinner']).notNullable();
    table.string('food_item_name').notNullable();
    table.decimal('grams', 10, 2).notNullable();
    table.decimal('calories', 10, 2).defaultTo(0);
    table.decimal('proteins', 10, 2).defaultTo(0);
    table.decimal('fats', 10, 2).defaultTo(0);
    table.decimal('carbs', 10, 2).defaultTo(0);
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('app_manual_meal_plan_items');
  await knex.schema.dropTableIfExists('app_manual_meal_plans');
};

