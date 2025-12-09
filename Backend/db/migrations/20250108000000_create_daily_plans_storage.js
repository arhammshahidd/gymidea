exports.up = async function(knex) {
  // Create daily training plans table
  await knex.schema.createTable('daily_training_plans', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('gym_id').nullable();
    table.integer('day_number').nullable(); // Day number (1, 2, 3, etc.) - nullable for stats records
    
    // Plan source information
    table.string('plan_type').notNullable(); // 'manual', 'ai_generated', 'web_assigned'
    table.integer('source_plan_id').nullable(); // ID of the original plan
    table.string('plan_category').notNullable(); // 'Weight Loss', 'Muscle Building', etc.
    
    // Daily plan details
    table.string('workout_name').nullable();
    table.integer('total_exercises').defaultTo(0);
    table.integer('training_minutes').defaultTo(0);
    table.integer('total_sets').defaultTo(0);
    table.integer('total_reps').defaultTo(0);
    table.decimal('total_weight_kg', 10, 2).defaultTo(0);
    table.string('user_level').defaultTo('Beginner');
    
    // Exercise details as JSON
    table.text('exercises_details').nullable(); // JSON string with exercise details
    
    // Status tracking
    table.boolean('is_completed').defaultTo(false);
    table.timestamp('completed_at').nullable();
    table.text('completion_notes').nullable();
    table.boolean('is_stats_record').defaultTo(false); // Flag for stats records
    
    // Metadata
    table.timestamps(true, true);
    
    // Indexes for performance
    table.index(['user_id', 'day_number']);
    table.index(['user_id', 'plan_type']);
    table.index(['gym_id', 'day_number']);
    table.index(['source_plan_id', 'day_number']);
  });

  // Create unique constraint for daily_training_plans (partial index for non-stats records)
  await knex.raw(`
    CREATE UNIQUE INDEX daily_training_plans_user_day_unique 
    ON daily_training_plans (user_id, day_number, plan_type, source_plan_id) 
    WHERE is_stats_record = false AND day_number IS NOT NULL;
  `);

  // Create daily nutrition plans table
  await knex.schema.createTable('daily_nutrition_plans', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('gym_id').nullable();
    table.integer('day_number').nullable(); // Day number (1, 2, 3, etc.)
    
    // Plan source information
    table.string('plan_type').notNullable(); // 'manual', 'ai_generated', 'web_assigned'
    table.integer('source_plan_id').nullable(); // ID of the original plan
    table.string('plan_category').notNullable(); // 'Weight Loss', 'Muscle Building', etc.
    
    // Daily nutrition totals
    table.decimal('total_calories', 10, 2).defaultTo(0);
    table.decimal('total_proteins', 10, 2).defaultTo(0);
    table.decimal('total_fats', 10, 2).defaultTo(0);
    table.decimal('total_carbs', 10, 2).defaultTo(0);
    
    // Meal details as JSON
    table.text('meal_details').nullable(); // JSON string with meal details
    
    // Status tracking
    table.boolean('is_completed').defaultTo(false);
    table.timestamp('completed_at').nullable();
    table.text('completion_notes').nullable();
    
    // Metadata
    table.timestamps(true, true);
    
    // Indexes for performance
    table.index(['user_id', 'day_number']);
    table.index(['user_id', 'plan_type']);
    table.index(['gym_id', 'day_number']);
    table.index(['source_plan_id', 'day_number']);
  });

  // Create unique constraint for daily_nutrition_plans
  await knex.raw(`
    CREATE UNIQUE INDEX daily_nutrition_plans_user_day_unique 
    ON daily_nutrition_plans (user_id, day_number, plan_type, source_plan_id) 
    WHERE day_number IS NOT NULL;
  `);

  // Create daily plan items for detailed tracking
  await knex.schema.createTable('daily_training_plan_items', (table) => {
    table.increments('id').primary();
    table.integer('daily_plan_id').notNullable().references('id').inTable('daily_training_plans').onDelete('CASCADE');
    table.string('exercise_name').notNullable();
    table.integer('sets').defaultTo(0);
    table.integer('reps').defaultTo(0);
    table.decimal('weight_kg', 10, 2).defaultTo(0);
    table.integer('minutes').defaultTo(0);
    table.string('exercise_type').nullable();
    table.text('notes').nullable();
    table.boolean('is_completed').defaultTo(false);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('daily_nutrition_plan_items', (table) => {
    table.increments('id').primary();
    table.integer('daily_plan_id').notNullable().references('id').inTable('daily_nutrition_plans').onDelete('CASCADE');
    table.enum('meal_type', ['Breakfast', 'Lunch', 'Dinner', 'Snack']).notNullable();
    table.string('food_item_name').notNullable();
    table.decimal('grams', 10, 2).notNullable();
    table.decimal('calories', 10, 2).defaultTo(0);
    table.decimal('proteins', 10, 2).defaultTo(0);
    table.decimal('fats', 10, 2).defaultTo(0);
    table.decimal('carbs', 10, 2).defaultTo(0);
    table.text('notes').nullable();
    table.boolean('is_completed').defaultTo(false);
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('daily_nutrition_plan_items');
  await knex.schema.dropTableIfExists('daily_training_plan_items');
  await knex.schema.dropTableIfExists('daily_nutrition_plans');
  await knex.schema.dropTableIfExists('daily_training_plans');
};
