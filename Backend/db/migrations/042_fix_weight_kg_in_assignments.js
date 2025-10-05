exports.up = function (knex) {
  return knex.schema.alterTable('training_plan_assignments', (table) => {
    table.text('weight_kg').alter(); // Change from integer to text to support ranges like "20-40"
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('training_plan_assignments', (table) => {
    table.integer('weight_kg').alter(); // Revert back to integer if needed
  });
};
