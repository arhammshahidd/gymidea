exports.up = function (knex) {
  return knex.schema.alterTable('gym_admins', (table) => {
    table.boolean('is_blocked').defaultTo(false).notNullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('gym_admins', (table) => {
    table.dropColumn('is_blocked');
  });
};
