const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.listGyms = async (req, res) => {
  const gyms = await db('gyms').select('*').orderBy('created_at', 'desc');
  res.json({ success: true, data: gyms });
};

exports.createGym = async (req, res) => {
  const { name, contact_number, email, admin, permissions = {} } = req.body;
  // admin: {name, phone, email, password}
  if (!admin || !admin.password || !admin.phone) {
    return res.status(400).json({ message: 'Admin credentials required (phone, password)' });
  }

  try {
    const created = await db.transaction(async (trx) => {
      const [gym] = await trx('gyms').insert({
        name,
        contact_number,
        email,
        permissions
      }).returning('*');

      const hashed = await bcrypt.hash(admin.password, 10);
      const [gymAdmin] = await trx('gym_admins').insert({
        gym_id: gym.id,
        name: admin.name || admin.phone,
        phone: admin.phone,
        email: admin.email,
        password: hashed,
        permissions: JSON.stringify(admin.permissions || []),
        token_version: 1
      }).returning('*');

      return { gym, gymAdmin };
    });

    res.json({ success: true, data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create gym' });
  }
};

exports.getGym = async (req, res) => {
  const id = req.params.id;
  const gym = await db('gyms').where({ id }).first();
  if (!gym) return res.status(404).json({ message: 'Not found' });
  res.json({ success: true, data: gym });
};

exports.updateGym = async (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  const [updated] = await db('gyms').where({ id }).update({ ...updates, updated_at: db.fn.now() }).returning('*');
  res.json({ success: true, data: updated });
};

exports.deleteGym = async (req, res) => {
  const id = req.params.id;
  await db('gyms').where({ id }).del();
  res.json({ success: true, message: 'Gym deleted' });
};

// ==================== GYM ADMIN MANAGEMENT ====================

exports.listGymAdmins = async (req, res) => {
  try {
    const gymAdmins = await db('gym_admins')
      .join('gyms', 'gym_admins.gym_id', 'gyms.id')
      .select(
        'gym_admins.id',
        'gym_admins.name',
        'gym_admins.email',
        'gym_admins.phone',
        'gym_admins.permissions',
        'gym_admins.created_at',
        'gyms.name as gym_name',
        'gyms.id as gym_id'
      )
      .orderBy('gym_admins.created_at', 'desc');

    // Parse permissions from JSON string to array
    const adminsWithParsedPermissions = gymAdmins.map(admin => ({
      ...admin,
      permissions: typeof admin.permissions === 'string' 
        ? JSON.parse(admin.permissions) 
        : admin.permissions || []
    }));

    res.json({ success: true, data: adminsWithParsedPermissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch gym admins' });
  }
};

exports.createGymAdmin = async (req, res) => {
  try {
    const { gym_id, name, email, phone, password, permissions = [] } = req.body;

    if (!gym_id || !name || !email || !phone || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Gym ID, name, email, phone, and password are required' 
      });
    }

    // Validate gym exists
    const gym = await db('gyms').where({ id: gym_id }).first();
    if (!gym) {
      return res.status(404).json({ success: false, message: 'Gym not found' });
    }

    // Check if email or phone already exists
    const existingAdmin = await db('gym_admins')
      .where({ email })
      .orWhere({ phone })
      .first();
    
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email or phone already exists' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [gymAdmin] = await db('gym_admins')
      .insert({
        gym_id,
        name,
        email,
        phone,
        password: hashedPassword,
        permissions: JSON.stringify(permissions),
        token_version: 1
      })
      .returning(['id', 'name', 'email', 'phone', 'permissions', 'gym_id', 'created_at']);

    const adminWithParsedPermissions = {
      ...gymAdmin,
      permissions: typeof gymAdmin.permissions === 'string' 
        ? JSON.parse(gymAdmin.permissions) 
        : gymAdmin.permissions || []
    };

    res.status(201).json({ success: true, data: adminWithParsedPermissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create gym admin' });
  }
};

exports.getGymAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    const gymAdmin = await db('gym_admins')
      .join('gyms', 'gym_admins.gym_id', 'gyms.id')
      .where('gym_admins.id', id)
      .select(
        'gym_admins.id',
        'gym_admins.name',
        'gym_admins.email',
        'gym_admins.phone',
        'gym_admins.permissions',
        'gym_admins.created_at',
        'gyms.name as gym_name',
        'gyms.id as gym_id'
      )
      .first();

    if (!gymAdmin) {
      return res.status(404).json({ success: false, message: 'Gym admin not found' });
    }

    const adminWithParsedPermissions = {
      ...gymAdmin,
      permissions: typeof gymAdmin.permissions === 'string' 
        ? JSON.parse(gymAdmin.permissions) 
        : gymAdmin.permissions || []
    };

    res.json({ success: true, data: adminWithParsedPermissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch gym admin' });
  }
};

exports.updateGymAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password, permissions } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (permissions) updateData.permissions = JSON.stringify(permissions);
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const [updatedAdmin] = await db('gym_admins')
      .where({ id })
      .update({ ...updateData, updated_at: db.fn.now() })
      .returning(['id', 'name', 'email', 'phone', 'permissions', 'gym_id', 'updated_at']);

    if (!updatedAdmin) {
      return res.status(404).json({ success: false, message: 'Gym admin not found' });
    }

    const adminWithParsedPermissions = {
      ...updatedAdmin,
      permissions: typeof updatedAdmin.permissions === 'string' 
        ? JSON.parse(updatedAdmin.permissions) 
        : updatedAdmin.permissions || []
    };

    res.json({ success: true, data: adminWithParsedPermissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update gym admin' });
  }
};

exports.deleteGymAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await db('gym_admins').where({ id }).del();
    
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Gym admin not found' });
    }

    res.json({ success: true, message: 'Gym admin deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete gym admin' });
  }
};

exports.logoutGymAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Increment token version to invalidate all existing tokens for this admin
    const [updated] = await db('gym_admins')
      .where({ id })
      .increment('token_version', 1)
      .returning(['id', 'name', 'token_version']);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Gym admin not found' });
    }

    res.json({ 
      success: true, 
      message: 'Gym admin logged out successfully. All existing tokens are now invalid.',
      data: { admin_id: updated.id, token_version: updated.token_version }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to logout gym admin' });
  }
};

exports.logoutGymUsers = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get gym_id from gym admin
    const gymAdmin = await db('gym_admins').where({ id }).select('gym_id').first();
    if (!gymAdmin) {
      return res.status(404).json({ success: false, message: 'Gym admin not found' });
    }

    // Increment token version for all users in this gym
    const updatedUsers = await db('users')
      .where({ gym_id: gymAdmin.gym_id })
      .increment('token_version', 1)
      .returning(['id', 'name', 'token_version']);

    // Also logout the gym admin
    await db('gym_admins')
      .where({ id })
      .increment('token_version', 1);

    res.json({ 
      success: true, 
      message: `Logged out gym admin and ${updatedUsers.length} users. All existing tokens are now invalid.`,
      data: { 
        gym_admin_id: id,
        logged_out_users: updatedUsers.length,
        user_ids: updatedUsers.map(u => u.id)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to logout gym users' });
  }
};