/**
 * Allow stats records in daily_training_plans by making plan_date nullable for stats records
 * and adjusting unique constraint to exclude stats records
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // First, make plan_date nullable (PostgreSQL specific - adjust for other DBs if needed)
  await knex.raw(`
    ALTER TABLE daily_training_plans 
    ALTER COLUMN plan_date DROP NOT NULL;
  `);
  
  // Drop the existing unique constraint
  await knex.schema.alterTable('daily_training_plans', (table) => {
    table.dropUnique(['user_id', 'plan_date', 'plan_type']);
  });
  
  // Add a new unique constraint that excludes stats records
  // Stats records can have NULL plan_date, so we use a partial unique index
  await knex.raw(`
    CREATE UNIQUE INDEX daily_training_plans_user_plan_unique 
    ON daily_training_plans (user_id, plan_date, plan_type) 
    WHERE is_stats_record = false;
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
  await knex.schema.alterTable('daily_training_plans', (table) => {
    table.unique(['user_id', 'plan_date', 'plan_type']);
  });
  
  // Make plan_date NOT NULL again (first update any NULL values)
  await knex.raw(`
    UPDATE daily_training_plans 
    SET plan_date = CURRENT_DATE 
    WHERE plan_date IS NULL;
  `);
  
  await knex.raw(`
    ALTER TABLE daily_training_plans 
    ALTER COLUMN plan_date SET NOT NULL;
  `);
};

