exports.up = async function(knex) {
  await knex.schema.alterTable('app_ai_generated_plan_items', (table) => {
    table.enum('user_level', ['Beginner', 'Intermediate', 'Expert']).defaultTo('Beginner');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('app_ai_generated_plan_items', (table) => {
    table.dropColumn('user_level');
  });
};
