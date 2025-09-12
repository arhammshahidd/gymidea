exports.up = function(knex) {
  return knex.schema.createTable('super_admins', table => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('phone').notNullable().unique();
    table.string('email').unique();
    table.string('password').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('super_admins');
};
