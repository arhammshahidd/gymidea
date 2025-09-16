exports.up = async function(knex) {
  await knex.schema.createTable('food_menu_assignments', (table) => {
    table.increments('id').primary()
    table.integer('gym_id').notNullable().index()
    table.integer('food_menu_id').notNullable().index()
    table.integer('user_id').notNullable().index()
    table.date('start_date').nullable()
    table.date('end_date').nullable()
    table.string('status', 24).notNullable().defaultTo('ASSIGNED')
    table.text('notes').nullable()
    table.timestamps(true, true)
  })
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('food_menu_assignments')
}

