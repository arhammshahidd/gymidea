exports.up = function (knex) {
  return knex.schema.alterTable('training_plan_assignments', (table) => {
    table.decimal('weight_kg', 10, 2).alter(); // Change from integer to decimal(10,2)
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('training_plan_assignments', (table) => {
    table.integer('weight_kg').alter(); // Revert back to integer
  });
};
