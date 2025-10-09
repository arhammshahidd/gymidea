exports.up = async function(knex) {
  // Align app_ai_generated_meal_plans with approval_food_menu
  const addPlanColIfMissing = async (col, builder) => {
    const has = await knex.schema.hasColumn('app_ai_generated_meal_plans', col)
    if (!has) {
      await knex.schema.alterTable('app_ai_generated_meal_plans', (t) => builder(t))
    }
  }

  await addPlanColIfMissing('name', (t) => t.string('name', 100).nullable())
  await addPlanColIfMissing('email', (t) => t.string('email', 100).nullable().index())
  await addPlanColIfMissing('contact', (t) => t.string('contact', 20).nullable().index())
  await addPlanColIfMissing('menu_plan_category', (t) => t.string('menu_plan_category', 50).nullable().index())
  await addPlanColIfMissing('total_days', (t) => t.integer('total_days').defaultTo(30))
  await addPlanColIfMissing('description', (t) => t.text('description').nullable())
  await addPlanColIfMissing('food_items', (t) => t.json('food_items').nullable())
  await addPlanColIfMissing('approval_status', (t) => t.string('approval_status', 20).defaultTo('PENDING').index())
  await addPlanColIfMissing('approval_notes', (t) => t.text('approval_notes').nullable())
  await addPlanColIfMissing('approved_by', (t) => t.integer('approved_by').nullable().index())
  await addPlanColIfMissing('approved_at', (t) => t.timestamp('approved_at').nullable())
  await addPlanColIfMissing('total_protein', (t) => t.decimal('total_protein', 10, 2).defaultTo(0))
  await addPlanColIfMissing('total_fats', (t) => t.decimal('total_fats', 10, 2).defaultTo(0))
  await addPlanColIfMissing('total_carbs', (t) => t.decimal('total_carbs', 10, 2).defaultTo(0))

  // Align app_ai_generated_meal_plan_items with approval-level fields that are item-specific
  const addItemColIfMissing = async (col, builder) => {
    const has = await knex.schema.hasColumn('app_ai_generated_meal_plan_items', col)
    if (!has) {
      await knex.schema.alterTable('app_ai_generated_meal_plan_items', (t) => builder(t))
    }
  }

  // Ensure items can carry macros and optional JSON of raw item
  await addItemColIfMissing('notes', (t) => t.text('notes').nullable())
  await addItemColIfMissing('raw_item', (t) => t.json('raw_item').nullable())
};

exports.down = async function(knex) {
  const dropPlanCols = [
    'name','email','contact','menu_plan_category','total_days','description','food_items',
    'approval_status','approval_notes','approved_by','approved_at','total_protein','total_fats','total_carbs'
  ]
  await knex.schema.alterTable('app_ai_generated_meal_plans', (t) => {
    dropPlanCols.forEach((c) => { try { t.dropColumn(c) } catch (e) {} })
  })

  const dropItemCols = ['notes','raw_item']
  await knex.schema.alterTable('app_ai_generated_meal_plan_items', (t) => {
    dropItemCols.forEach((c) => { try { t.dropColumn(c) } catch (e) {} })
  })
};


