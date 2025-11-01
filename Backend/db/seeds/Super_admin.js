const bcrypt = require('bcrypt');

// For Web App

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('super_admins').del();

  const password = 'admin123'; // change in production
  const hash = await bcrypt.hash(password, 10);

  await knex('super_admins').insert([
    { name: 'Root Admin', phone: '+10000000000', email: 'admin@example.com', password: hash }
  ]);

  
};

