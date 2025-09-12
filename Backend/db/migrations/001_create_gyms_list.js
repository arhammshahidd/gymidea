exports.up = function (knex) {
  return knex.schema.createTable("gyms", (table) => {
    table.increments("id").primary();
    table.string("name").notNullable();
    table.string("email").unique();
    table.string("contact_number"); // ✅ add this
    table.json("permissions").defaultTo(JSON.stringify({}));
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("gyms");
};
