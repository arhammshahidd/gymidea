/**
 * Add day_number to daily training and nutrition plans and set day_number for any rows without it,
 * and add unique indexes on (user_id, day_number, plan_type, source_plan_id) for non-stats plans.
 * For fresh installations, day_number is already created in the initial migration.
 * This migration ensures day_number exists and creates the necessary indexes.
 */

const TABLES = [
  { name: 'daily_training_plans', stats: { column: 'is_stats_record', value: false, hasStats: true } },
  { name: 'daily_nutrition_plans', stats: { column: null, value: null, hasStats: false } } // nutrition plans have no stats rows
];

exports.up = async function(knex) {
  for (const table of TABLES) {
    // Add day_number column if not exists
    const hasCol = await knex.schema.hasColumn(table.name, 'day_number');
    if (!hasCol) {
      await knex.schema.alterTable(table.name, (t) => {
        t.integer('day_number').nullable(); // stats rows can remain NULL
      });
    }

    // Set day_number for any rows that don't have it (sequential numbering by id)
    // For fresh installations, day_number should already be set during table creation
    const whereNonStats = table.stats.hasStats ? `${table.stats.column} = ${table.stats.value ? 'true' : 'false'}` : '1=1';
    await knex.raw(`
      UPDATE ${table.name} p
      SET day_number = sub.day_number
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, plan_type, COALESCE(source_plan_id, -1)
                 ORDER BY id ASC
               ) AS day_number
        FROM ${table.name}
        WHERE ${whereNonStats} AND day_number IS NULL
      ) AS sub
      WHERE p.id = sub.id;
    `);
    console.log(`✅ Set day_number for rows without it in ${table.name}`);

    // Add unique index on day_number for non-stats rows
    const partialIndexPredicate = table.stats.hasStats
      ? `${table.stats.column} = ${table.stats.value ? 'true' : 'false'} AND day_number IS NOT NULL`
      : `day_number IS NOT NULL`;

    await knex.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${table.name}_user_day_unique
      ON ${table.name} (user_id, day_number, plan_type, source_plan_id)
      WHERE ${partialIndexPredicate};
    `);

    // Helpful index for day lookups per source
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS ${table.name}_source_day_idx
      ON ${table.name} (source_plan_id, day_number)
      WHERE ${partialIndexPredicate};
    `);
  }
};

exports.down = async function(knex) {
  for (const table of TABLES) {
    // Drop day-based indexes
    await knex.raw(`DROP INDEX IF EXISTS ${table.name}_source_day_idx;`);
    await knex.raw(`DROP INDEX IF EXISTS ${table.name}_user_day_unique;`);

    // Keep day_number column to avoid data loss during rollback; callers may rely on it.
    // If you must drop, uncomment the block below, but note data loss risk.
    // await knex.schema.alterTable(table.name, (t) => {
    //   t.dropColumn('day_number');
    // });
  }
};

