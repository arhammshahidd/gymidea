exports.up = function (knex) {
  return knex.schema.createTable("gym_admins", (table) => {
    table.increments("id").primary();
    table
      .integer("gym_id")
      .unsigned()
      .references("id")
      .inTable("gyms")
      .onDelete("CASCADE");
    table.string("name").notNullable();
    table.string("email").unique().notNullable();
    table.string("phone").unique().notNullable();
    table.string("password").notNullable(); // store hashed password
    table.json("permissions").defaultTo(JSON.stringify([])); // permissions like modules access
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("gym_admins");
};
