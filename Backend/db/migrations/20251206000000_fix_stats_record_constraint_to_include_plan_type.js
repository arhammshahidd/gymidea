/**
 * Fix stats record constraint to allow one stats record per user per plan_type
 * Previously, the constraint was on user_id alone, causing stats records to be overwritten
 * when updating different plan types (web_assigned, ai_generated, manual)
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Drop the old constraint that only checks user_id
  await knex.raw(`
    DROP INDEX IF EXISTS daily_training_plans_stats_unique;
  `);
  
  // Add a new unique constraint that includes plan_type
  // This allows one stats record per user per plan_type
  await knex.raw(`
    CREATE UNIQUE INDEX daily_training_plans_stats_unique 
    ON daily_training_plans (user_id, plan_type) 
    WHERE is_stats_record = true;
  `);
  
  console.log('✅ Fixed stats record constraint to include plan_type');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop the new constraint
  await knex.raw(`
    DROP INDEX IF EXISTS daily_training_plans_stats_unique;
  `);
  
  // Restore the old constraint (user_id alone)
  await knex.raw(`
    CREATE UNIQUE INDEX daily_training_plans_stats_unique 
    ON daily_training_plans (user_id) 
    WHERE is_stats_record = true;
  `);
};

