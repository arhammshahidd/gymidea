/**
 * Revert stats consolidation - restore individual stats columns
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Re-add individual stats columns
  await knex.schema.alterTable('daily_training_plans', (table) => {
    table.timestamp('stats_date_updated').nullable().after('updated_at');
    table.text('stats_daily_workouts').nullable();
    table.integer('stats_total_workouts').nullable().defaultTo(0);
    table.integer('stats_total_minutes').nullable().defaultTo(0);
    table.integer('stats_longest_streak').nullable().defaultTo(0);
    table.text('stats_recent_workouts').nullable();
    table.text('stats_weekly_progress').nullable();
    table.text('stats_monthly_progress').nullable();
    table.text('stats_remaining_tasks').nullable();
    table.text('stats_task_completion_report').nullable();
    table.text('stats_items').nullable();
  });
  
  // Migrate data back from stats_data to individual columns
  const statsRecords = await knex('daily_training_plans')
    .where('is_stats_record', true)
    .whereNotNull('stats_data')
    .select('*');
  
  for (const record of statsRecords) {
    try {
      const statsData = typeof record.stats_data === 'string' 
        ? JSON.parse(record.stats_data) 
        : record.stats_data;
      
      await knex('daily_training_plans')
        .where('id', record.id)
        .update({
          stats_date_updated: statsData.date_updated,
          stats_daily_workouts: JSON.stringify(statsData.daily_workouts || {}),
          stats_total_workouts: statsData.total_workouts || 0,
          stats_total_minutes: statsData.total_minutes || 0,
          stats_longest_streak: statsData.longest_streak || 0,
          stats_recent_workouts: JSON.stringify(statsData.recent_workouts || []),
          stats_weekly_progress: JSON.stringify(statsData.weekly_progress || {}),
          stats_monthly_progress: JSON.stringify(statsData.monthly_progress || {}),
          stats_remaining_tasks: JSON.stringify(statsData.remaining_tasks || {}),
          stats_task_completion_report: JSON.stringify(statsData.task_completion_report || {}),
          stats_items: JSON.stringify(statsData.items || [])
        });
    } catch (e) {
      console.error('Error migrating stats data back:', e);
    }
  }
  
  // Drop the consolidated stats_data column
  await knex.schema.alterTable('daily_training_plans', (table) => {
    table.dropColumn('stats_data');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Re-add stats_data column
  await knex.schema.alterTable('daily_training_plans', (table) => {
    table.jsonb('stats_data').nullable().after('is_stats_record');
  });
  
  // Migrate data back to consolidated column
  const statsRecords = await knex('daily_training_plans')
    .where('is_stats_record', true)
    .select('*');
  
  for (const record of statsRecords) {
    const statsData = {
      date_updated: record.stats_date_updated,
      daily_workouts: record.stats_daily_workouts ? JSON.parse(record.stats_daily_workouts) : {},
      total_workouts: record.stats_total_workouts || 0,
      total_minutes: record.stats_total_minutes || 0,
      longest_streak: record.stats_longest_streak || 0,
      recent_workouts: record.stats_recent_workouts ? JSON.parse(record.stats_recent_workouts) : [],
      weekly_progress: record.stats_weekly_progress ? JSON.parse(record.stats_weekly_progress) : {},
      monthly_progress: record.stats_monthly_progress ? JSON.parse(record.stats_monthly_progress) : {},
      remaining_tasks: record.stats_remaining_tasks ? JSON.parse(record.stats_remaining_tasks) : {},
      task_completion_report: record.stats_task_completion_report ? JSON.parse(record.stats_task_completion_report) : {},
      items: record.stats_items ? JSON.parse(record.stats_items) : []
    };
    
    await knex('daily_training_plans')
      .where('id', record.id)
      .update({ stats_data: JSON.stringify(statsData) });
  }
  
  // Drop individual columns
  await knex.schema.alterTable('daily_training_plans', (table) => {
    table.dropColumn('stats_date_updated');
    table.dropColumn('stats_daily_workouts');
    table.dropColumn('stats_total_workouts');
    table.dropColumn('stats_total_minutes');
    table.dropColumn('stats_longest_streak');
    table.dropColumn('stats_recent_workouts');
    table.dropColumn('stats_weekly_progress');
    table.dropColumn('stats_monthly_progress');
    table.dropColumn('stats_remaining_tasks');
    table.dropColumn('stats_task_completion_report');
    table.dropColumn('stats_items');
  });
};

