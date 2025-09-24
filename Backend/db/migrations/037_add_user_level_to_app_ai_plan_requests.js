exports.up = async function(knex) {
  await knex.schema.alterTable('app_ai_plan_requests', (table) => {
    table.enum('user_level', ['Beginner', 'Intermediate', 'Expert']).defaultTo('Beginner');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('app_ai_plan_requests', (table) => {
    table.dropColumn('user_level');
  });
};
