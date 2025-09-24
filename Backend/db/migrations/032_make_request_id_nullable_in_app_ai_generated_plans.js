exports.up = async function(knex) {
  await knex.schema.alterTable('app_ai_generated_plans', (table) => {
    table.dropForeign(['request_id']);
  });
  await knex.schema.alterTable('app_ai_generated_plans', (table) => {
    table.integer('request_id').nullable().alter();
  });
  await knex.schema.alterTable('app_ai_generated_plans', (table) => {
    table.foreign('request_id').references('id').inTable('app_ai_plan_requests').onDelete('SET NULL');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('app_ai_generated_plans', (table) => {
    table.dropForeign(['request_id']);
  });
  await knex.schema.alterTable('app_ai_generated_plans', (table) => {
    table.integer('request_id').notNullable().alter();
  });
  await knex.schema.alterTable('app_ai_generated_plans', (table) => {
    table.foreign('request_id').references('id').inTable('app_ai_plan_requests').onDelete('CASCADE');
  });
};


