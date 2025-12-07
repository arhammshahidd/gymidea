/**
 * Fix unique constraint to include source_plan_id
 * This allows users to have multiple plans of the same type on the same date
 * if they come from different assignments (different source_plan_id)
 * 
 * Example: User can have 2 "web_assigned" plans on 2025-12-07:
 * - One from assignment_id=87 (Muscle Gain)
 * - One from assignment_id=88 (Weight Loss)
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Drop the existing unique constraint
  await knex.raw(`
    DROP INDEX IF EXISTS daily_training_plans_user_plan_unique;
  `);
  
  // Create a new unique constraint that includes source_plan_id
  // This allows multiple plans with same (user_id, plan_date, plan_type) 
  // if they have different source_plan_id values
  // 
  // IMPORTANT: In PostgreSQL unique constraints:
  // - NULL values are considered distinct (multiple NULLs don't conflict)
  // - But we want to ensure plans with different source_plan_id don't conflict
  // - We use a functional unique index that handles NULLs properly
  // 
  // Strategy: Use source_plan_id directly in the constraint
  // - Plans with different source_plan_id values: Won't conflict ✓
  // - Plans with NULL source_plan_id: Each NULL is distinct, so they won't conflict ✓
  // - This allows: 2 "web_assigned" plans on same date from different assignments
  await knex.raw(`
    CREATE UNIQUE INDEX daily_training_plans_user_plan_unique 
    ON daily_training_plans (user_id, plan_date, plan_type, source_plan_id) 
    WHERE is_stats_record = false;
  `);
  
  console.log('✅ Updated unique constraint to include source_plan_id');
  console.log('   Users can now have multiple plans of the same type on the same date');
  console.log('   if they come from different assignments (different source_plan_id)');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop the new index
  await knex.raw(`DROP INDEX IF EXISTS daily_training_plans_user_plan_unique;`);
  
  // Restore the original unique constraint (without source_plan_id)
  await knex.raw(`
    CREATE UNIQUE INDEX daily_training_plans_user_plan_unique 
    ON daily_training_plans (user_id, plan_date, plan_type) 
    WHERE is_stats_record = false;
  `);
  
  console.log('✅ Reverted to original unique constraint (without source_plan_id)');
};

