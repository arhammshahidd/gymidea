/**
 * Add items JSON column to daily_training_plans stats record
 * This will store aggregated items data from daily_training_plan_items
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Add items JSON column to store all items data
  await knex.schema.alterTable('daily_training_plans', (table) => {
    table.text('stats_items').nullable().after('stats_task_completion_report');
  });
  
  // Migrate existing items data to stats records
  // For each user, aggregate all items from daily_training_plan_items into their stats record
  const users = await knex('daily_training_plans')
    .select('user_id')
    .where('is_stats_record', true)
    .groupBy('user_id');
  
  for (const user of users) {
    // Get all items for this user from daily_training_plan_items
    const allItems = await knex('daily_training_plan_items')
      .join('daily_training_plans', 'daily_training_plan_items.daily_plan_id', 'daily_training_plans.id')
      .where('daily_training_plans.user_id', user.user_id)
      .select(
        'daily_training_plan_items.*',
        'daily_training_plans.day_number',
        'daily_training_plans.workout_name'
      )
      .orderBy('daily_training_plans.day_number', 'desc')
      .orderBy('daily_training_plan_items.id', 'asc');
    
    if (allItems.length > 0) {
      // Format items for storage
      const itemsData = allItems.map(item => ({
        id: item.id,
        exercise_name: item.exercise_name,
        sets: item.sets,
        reps: item.reps,
        weight_kg: item.weight_kg,
        weight_min_kg: item.weight_min_kg,
        weight_max_kg: item.weight_max_kg,
        minutes: item.minutes,
        exercise_type: item.exercise_type,
        notes: item.notes,
        is_completed: item.is_completed,
        completed_at: item.completed_at,
        day_number: item.day_number,
        workout_name: item.workout_name,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));
      
      // Update stats record with items
      await knex('daily_training_plans')
        .where({ user_id: user.user_id, is_stats_record: true })
        .update({ stats_items: JSON.stringify(itemsData) });
    }
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('daily_training_plans', (table) => {
    table.dropColumn('stats_items');
  });
};

