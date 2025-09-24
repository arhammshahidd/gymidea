exports.up = async function(knex) {
  await knex.schema.alterTable('training_approvals', (table) => {
    table.enum('user_level', ['Beginner', 'Intermediate', 'Expert']).defaultTo('Beginner');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('training_approvals', (table) => {
    table.dropColumn('user_level');
  });
};
