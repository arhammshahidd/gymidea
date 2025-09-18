exports.up = async function(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.integer('age').nullable();
    table.decimal('height_cm', 6, 2).nullable();
    table.decimal('weight_kg', 6, 2).nullable();
    table.boolean('pref_workout_alerts').notNullable().defaultTo(true);
    table.boolean('pref_meal_reminders').notNullable().defaultTo(true);
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('age');
    table.dropColumn('height_cm');
    table.dropColumn('weight_kg');
    table.dropColumn('pref_workout_alerts');
    table.dropColumn('pref_meal_reminders');
  });
};

