exports.up = function(knex) {
  return knex.schema.alterTable('app_ai_generated_plans', function(table) {
    table.text('exercises_details').nullable(); // Store JSON string of exercise details
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('app_ai_generated_plans', function(table) {
    table.dropColumn('exercises_details');
  });
};
