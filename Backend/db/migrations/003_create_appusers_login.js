exports.up = function (knex) {
  return knex.schema.createTable("users", (table) => {
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

    table.boolean("is_paid").defaultTo(false);

    // Membership tier (Basic, Premium, etc.)
    table.string("membership_tier").defaultTo("BASIC");

    // User status (ACTIVE, INACTIVE, SUSPENDED, etc.)
    table.string("status").defaultTo("ACTIVE");

    table.timestamps(true, true); // created_at, updated_at
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("users");
};
