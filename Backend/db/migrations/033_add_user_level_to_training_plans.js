exports.up = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    table.enum('user_level', ['Beginner', 'Intermediate', 'Expert']).defaultTo('Beginner');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    table.dropColumn('user_level');
  });
};
