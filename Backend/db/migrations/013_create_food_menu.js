/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('food_menu', (table) => {
    table.increments('id').primary();
    table.integer('gym_id').notNullable().index();
    table.string('menu_plan_category', 50).notNullable(); // Weight Gain, Weight Lose, Muscle building
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    
    // Breakfast details
    table.json('breakfast').nullable(); // Array of food items with name, grams, protein, fats, carbs, total_calories
    
    // Lunch details  
    table.json('lunch').nullable(); // Array of food items with name, grams, protein, fats, carbs, total_calories
    
    // Dinner details
    table.json('dinner').nullable(); // Array of food items with name, grams, protein, fats, carbs, total_calories
    
    // Total daily nutrition (calculated from all meals)
    table.decimal('total_daily_protein', 8, 2).defaultTo(0);
    table.decimal('total_daily_fats', 8, 2).defaultTo(0);
    table.decimal('total_daily_carbs', 8, 2).defaultTo(0);
    table.decimal('total_daily_calories', 8, 2).defaultTo(0);
    
    table.string('status', 24).notNullable().defaultTo('ACTIVE'); // ACTIVE | INACTIVE
    table.timestamps(true, true);
    
    // Indexes for better performance
    table.index(['gym_id', 'menu_plan_category']);
    table.index(['gym_id', 'start_date', 'end_date']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('food_menu');
};
