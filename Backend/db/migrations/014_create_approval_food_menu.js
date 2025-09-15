/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('approval_food_menu', (table) => {
    table.increments('id').primary();
    table.integer('gym_id').notNullable().index();
    table.integer('user_id').nullable().index(); // Reference to appusers_login if user is registered
    
    // User Information
    table.string('name', 100).notNullable();
    table.string('email', 100).notNullable();
    table.string('contact', 20).notNullable();
    
    // Menu Plan Details
    table.string('menu_plan_category', 50).notNullable(); // Weight Gain, Weight Lose, Muscle building
    table.integer('total_days').notNullable().defaultTo(30);
    table.text('description').nullable(); // Small description
    
    // Food Item Details (JSON array of food items)
    table.json('food_items').notNullable(); // Array of food items with name, grams, protein, fats, carbs, calories
    
    // Approval Status
    table.string('approval_status', 20).notNullable().defaultTo('PENDING'); // PENDING | APPROVED | REJECTED
    table.text('approval_notes').nullable(); // Notes from admin when approving/rejecting
    table.integer('approved_by').nullable().index(); // Reference to gym_admins who approved
    table.timestamp('approved_at').nullable();
    
    // Total nutrition calculations
    table.decimal('total_protein', 8, 2).defaultTo(0);
    table.decimal('total_fats', 8, 2).defaultTo(0);
    table.decimal('total_carbs', 8, 2).defaultTo(0);
    table.decimal('total_calories', 8, 2).defaultTo(0);
    
    table.timestamps(true, true);
    
    // Indexes for better performance
    table.index(['gym_id', 'approval_status']);
    table.index(['gym_id', 'menu_plan_category']);
    table.index(['gym_id', 'created_at']);
    table.index(['email']);
    table.index(['contact']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('approval_food_menu');
};
