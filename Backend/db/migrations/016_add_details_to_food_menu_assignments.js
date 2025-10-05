exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('food_menu_assignments')
  if (!hasTable) return

  const addIfMissing = async (col, builder) => {
    const has = await knex.schema.hasColumn('food_menu_assignments', col)
    if (!has) {
      await knex.schema.alterTable('food_menu_assignments', (t) => {
        builder(t)
      })
    }
  }

  // Copy of important fields from food_menu for denormalized assignments
  await addIfMissing('menu_plan_category', (t) => t.string('menu_plan_category', 128).nullable().index())
  await addIfMissing('breakfast', (t) => t.text('breakfast').nullable())
  await addIfMissing('lunch', (t) => t.text('lunch').nullable())
  await addIfMissing('dinner', (t) => t.text('dinner').nullable())
  await addIfMissing('total_daily_protein', (t) => t.decimal('total_daily_protein', 10, 2).defaultTo(0))
  await addIfMissing('total_daily_fats', (t) => t.decimal('total_daily_fats', 10, 2).defaultTo(0))
  await addIfMissing('total_daily_carbs', (t) => t.decimal('total_daily_carbs', 10, 2).defaultTo(0))
  await addIfMissing('total_daily_calories', (t) => t.decimal('total_daily_calories', 10, 2).defaultTo(0))
}

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('food_menu_assignments')
  if (!hasTable) return
  await knex.schema.alterTable('food_menu_assignments', (t) => {
    ['menu_plan_category','breakfast','lunch','dinner','total_daily_protein','total_daily_fats','total_daily_carbs','total_daily_calories'].forEach((c)=>{
      try { t.dropColumn(c) } catch (e) {}
    })
  })
}

