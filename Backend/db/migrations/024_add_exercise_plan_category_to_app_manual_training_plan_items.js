exports.up = async function(knex) {
  await knex.schema.alterTable('app_manual_training_plan_items', (table) => {
    table.string('exercise_plan_category').nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('app_manual_training_plan_items', (table) => {
    table.dropColumn('exercise_plan_category');
  });
};


