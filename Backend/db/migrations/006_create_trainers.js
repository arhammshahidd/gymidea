exports.up = function (knex) {
  return knex.schema.createTable("trainers", (table) => {
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
    table.string("password").notNullable(); // hashed password
    table.json("permissions").defaultTo(JSON.stringify([])); // permissions like modules access
    table.integer("token_version").defaultTo(1).notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("trainers");
};
