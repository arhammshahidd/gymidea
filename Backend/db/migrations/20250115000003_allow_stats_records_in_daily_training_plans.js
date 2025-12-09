/**
 * Allow stats records in daily_training_plans by making day_number nullable for stats records
 * and adjusting unique constraint to exclude stats records
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // First, make day_number nullable (PostgreSQL specific - adjust for other DBs if needed)
  // Note: day_number should already be nullable, but ensure it is
  await knex.raw(`
    ALTER TABLE daily_training_plans 
    ALTER COLUMN day_number DROP NOT NULL;
  `);
  
  // Drop the existing unique constraint (if it exists with old column names)
  await knex.raw(`
    DROP INDEX IF EXISTS daily_training_plans_user_plan_unique;
  `);
  
  // Add a new unique constraint that excludes stats records
  // Stats records can have NULL day_number, so we use a partial unique index
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS daily_training_plans_user_plan_unique 
    ON daily_training_plans (user_id, day_number, plan_type, source_plan_id) 
    WHERE is_stats_record = false AND day_number IS NOT NULL;
  `);
  
  // Add a unique constraint for stats records (one per user)
  await knex.raw(`
    CREATE UNIQUE INDEX daily_training_plans_stats_unique 
    ON daily_training_plans (user_id) 
    WHERE is_stats_record = true;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop the new indexes
  await knex.raw(`DROP INDEX IF EXISTS daily_training_plans_stats_unique;`);
  await knex.raw(`DROP INDEX IF EXISTS daily_training_plans_user_plan_unique;`);
  
  // Restore the original unique constraint
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS daily_training_plans_user_plan_unique 
    ON daily_training_plans (user_id, day_number, plan_type, source_plan_id) 
    WHERE is_stats_record = false AND day_number IS NOT NULL;
  `);
  
  // Make day_number NOT NULL again (first update any NULL values for non-stats records)
  await knex.raw(`
    UPDATE daily_training_plans 
    SET day_number = 1 
    WHERE day_number IS NULL AND is_stats_record = false;
  `);
  
  await knex.raw(`
    ALTER TABLE daily_training_plans 
    ALTER COLUMN day_number SET NOT NULL;
  `);
};

