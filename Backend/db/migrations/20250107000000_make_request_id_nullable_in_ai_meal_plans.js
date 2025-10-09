exports.up = async function(knex) {
  // Make request_id nullable in app_ai_generated_meal_plans to allow direct plan submission
  await knex.schema.alterTable('app_ai_generated_meal_plans', (table) => {
    table.dropForeign(['request_id']);
  });
  await knex.schema.alterTable('app_ai_generated_meal_plans', (table) => {
    table.integer('request_id').nullable().alter();
  });
  await knex.schema.alterTable('app_ai_generated_meal_plans', (table) => {
    table.foreign('request_id').references('id').inTable('app_ai_meal_plan_requests').onDelete('SET NULL');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('app_ai_generated_meal_plans', (table) => {
    table.dropForeign(['request_id']);
  });
  await knex.schema.alterTable('app_ai_generated_meal_plans', (table) => {
    table.integer('request_id').notNullable().alter();
  });
  await knex.schema.alterTable('app_ai_generated_meal_plans', (table) => {
    table.foreign('request_id').references('id').inTable('app_ai_meal_plan_requests').onDelete('CASCADE');
  });
};
