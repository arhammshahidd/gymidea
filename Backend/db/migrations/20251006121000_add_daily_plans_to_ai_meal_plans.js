exports.up = async function(knex) {
  const has = await knex.schema.hasColumn('app_ai_generated_meal_plans', 'daily_plans')
  if (!has) {
    await knex.schema.alterTable('app_ai_generated_meal_plans', (t) => {
      t.json('daily_plans').nullable(); // JSON array of per-day meals
    })
  }
};

exports.down = async function(knex) {
  await knex.schema.alterTable('app_ai_generated_meal_plans', (t) => {
    try { t.dropColumn('daily_plans') } catch (e) {}
  })
};


