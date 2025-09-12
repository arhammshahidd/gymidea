exports.up = function (knex) {
  return knex.schema
    .alterTable('gym_admins', (table) => {
      table.integer('token_version').defaultTo(1).notNullable();
    })
    .alterTable('users', (table) => {
      table.integer('token_version').defaultTo(1).notNullable();
    })
    .alterTable('super_admins', (table) => {
      table.integer('token_version').defaultTo(1).notNullable();
    });
};

exports.down = function (knex) {
  return knex.schema
    .alterTable('gym_admins', (table) => {
      table.dropColumn('token_version');
    })
    .alterTable('users', (table) => {
      table.dropColumn('token_version');
    })
    .alterTable('super_admins', (table) => {
      table.dropColumn('token_version');
    });
};
