/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('payment_status', function(table) {
    table.increments('id').primary();
    table.integer('user_id').notNullable();
    table.integer('gym_id').notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.string('payment_status', 20).notNullable().checkIn(['Paid', 'Unpaid']);
    table.timestamp('payment_date').nullable();
    table.date('due_date').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Foreign key constraints
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('gym_id').references('id').inTable('gyms').onDelete('CASCADE');
    
    // Indexes for better performance
    table.index('gym_id', 'idx_payment_status_gym_id');
    table.index('user_id', 'idx_payment_status_user_id');
    table.index('payment_status', 'idx_payment_status_status');
    table.index('due_date', 'idx_payment_status_due_date');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('payment_status');
};
