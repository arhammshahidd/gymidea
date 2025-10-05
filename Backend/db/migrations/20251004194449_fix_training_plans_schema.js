/**
 * Fix training_plans table schema to ensure all fields are properly configured
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    // Ensure weight_kg can handle text values (for ranges like "20-40")
    table.text('weight_kg').alter();
    
    // Ensure exercise_types can handle text values
    table.text('exercise_types').alter();
    
    // Ensure all required fields are properly set
    table.string('workout_name', 200).notNullable().alter();
    table.string('category', 50).notNullable().alter();
    
    // Ensure exercises_details can handle large JSON strings
    table.text('exercises_details').alter();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    // Revert weight_kg back to decimal
    table.decimal('weight_kg', 8, 2).defaultTo(0).alter();
    
    // Revert exercise_types back to string
    table.string('exercise_types', 64).alter();
    
    // Revert workout_name back to original size
    table.string('workout_name', 120).notNullable().alter();
    
    // Revert category back to original size
    table.string('category', 32).notNullable().alter();
  });
};