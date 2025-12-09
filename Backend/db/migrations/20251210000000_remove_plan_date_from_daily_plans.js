/**
 * Remove plan_date column from daily_training_plans and daily_nutrition_plans tables
 * All functionality now uses day_number instead of plan_date
 * 
 * This migration:
 * 1. Drops unique constraints/indexes that include plan_date
 * 2. Drops regular indexes that include plan_date
 * 3. Drops the plan_date column from both tables
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const TABLES = [
    { name: 'daily_training_plans', hasStats: true },
    { name: 'daily_nutrition_plans', hasStats: false }
  ];

  for (const table of TABLES) {
    console.log(`🔄 Removing plan_date from ${table.name}...`);
    
    // Drop unique constraint/index that includes plan_date
    // This was created in 20251207000000_fix_unique_constraint_to_include_source_plan_id.js
    await knex.raw(`DROP INDEX IF EXISTS ${table.name}_user_plan_unique CASCADE;`);
    
    // Drop indexes that include plan_date (created in initial migration)
    // Knex creates indexes with pattern: table_column1_column2_index
    const knownIndexes = [
      `${table.name}_user_id_plan_date_idx`,
      `${table.name}_user_id_plan_date_index`,
      `${table.name}_gym_id_plan_date_idx`,
      `${table.name}_gym_id_plan_date_index`
    ];
    
    for (const indexName of knownIndexes) {
      await knex.raw(`DROP INDEX IF EXISTS ${indexName} CASCADE;`);
    }
    
    // Drop the plan_date column (CASCADE will handle any remaining dependencies)
    const hasPlanDateColumn = await knex.schema.hasColumn(table.name, 'plan_date');
    if (hasPlanDateColumn) {
      // Use raw SQL to drop column with CASCADE to handle any remaining dependencies
      await knex.raw(`ALTER TABLE ${table.name} DROP COLUMN IF EXISTS plan_date CASCADE;`);
      console.log(`✅ Dropped plan_date column from ${table.name}`);
    } else {
      console.log(`⚠️ plan_date column does not exist in ${table.name}, skipping`);
    }
  }
  
  console.log('✅ Successfully removed plan_date column from daily plans tables');
  console.log('   All functionality now uses day_number');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const TABLES = [
    { name: 'daily_training_plans', hasStats: true },
    { name: 'daily_nutrition_plans', hasStats: false }
  ];

  for (const table of TABLES) {
    // Re-add plan_date column (nullable, since we can't backfill dates from day_number)
    const hasPlanDateColumn = await knex.schema.hasColumn(table.name, 'plan_date');
    if (!hasPlanDateColumn) {
      await knex.schema.alterTable(table.name, (table) => {
        table.date('plan_date').nullable();
      });
    }
    
    // Re-create indexes (if needed for rollback)
    // Note: We can't fully restore the unique constraint since we don't have the original plan_date values
    // The unique constraint on (user_id, day_number, plan_type, source_plan_id) should remain
  }
  
  console.log('⚠️ Rolled back plan_date column addition (column is nullable, no data backfilled)');
  console.log('   Note: plan_date values cannot be restored from day_number');
};

