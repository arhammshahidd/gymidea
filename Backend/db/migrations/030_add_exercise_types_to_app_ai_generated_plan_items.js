exports.up = async function(knex) {
  await knex.schema.alterTable('app_ai_generated_plan_items', (table) => {
    table.string('exercise_types').nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('app_ai_generated_plan_items', (table) => {
    table.dropColumn('exercise_types');
  });
};


