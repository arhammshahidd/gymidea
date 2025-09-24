exports.up = async function(knex) {
  await knex.schema.alterTable('app_manual_training_plans', (table) => {
    table.integer('web_plan_id').nullable().index();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('app_manual_training_plans', (table) => {
    table.dropColumn('web_plan_id');
  });
};


