exports.up = async function(knex) {
  await knex.schema.alterTable('training_approvals', (table) => {
    table.integer('minutes').defaultTo(0);
    table.string('exercise_types').nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('training_approvals', (table) => {
    table.dropColumn('minutes');
    table.dropColumn('exercise_types');
  });
};


