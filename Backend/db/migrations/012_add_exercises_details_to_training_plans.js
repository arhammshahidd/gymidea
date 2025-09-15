/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    table.text('exercises_details').nullable(); // Store exercise details as JSON string
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('training_plans', (table) => {
    table.dropColumn('exercises_details');
  });
};
