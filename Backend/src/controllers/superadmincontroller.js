const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.listGyms = async (req, res) => {
  const gyms = await db('gyms').select('*').orderBy('created_at', 'desc');
  res.json({ success: true, data: gyms });
};

exports.createGym = async (req, res) => {
  console.log('=== CREATE GYM ADMIN REQUEST ===');
  console.log('Request body:', req.body);
  
  const { 
    gym_name, 
    gym_contact, 
    gym_email, 
    name, 
    phone, 
    email, 
    password, 
    permissions = [] 
  } = req.body;

  console.log('Extracted fields:', {
    gym_name, gym_contact, gym_email, name, phone, email, 
    password: password ? '[HIDDEN]' : 'MISSING', permissions
  });
  console.log('Permissions type:', typeof permissions);
  console.log('Permissions value:', permissions);
  console.log('Permissions length:', permissions ? permissions.length : 'undefined');

  if (!gym_name || !gym_contact || !gym_email || !name || !phone || !email || !password) {
    console.log('Validation failed - missing required fields');
    return res.status(400).json({ 
      success: false,
      message: 'All fields are required (gym_name, gym_contact, gym_email, name, phone, email, password)' 
    });
  }

  try {
    console.log('Checking for existing gym with email:', gym_email);
    // Check if gym email already exists
    const existingGym = await db('gyms').where({ email: gym_email }).first();
    console.log('Existing gym check result:', existingGym);
    if (existingGym) {
      console.log('Gym email already exists, returning error');
      return res.status(400).json({ 
        success: false, 
        message: 'Gym with this email already exists' 
      });
    }

    console.log('Checking for existing admin with email/phone:', email, phone);
    // Check if admin email or phone already exists
    const existingAdmin = await db('gym_admins')
      .where({ email: email })
      .orWhere({ phone: phone })
      .first();
    console.log('Existing admin check result:', existingAdmin);
    
    if (existingAdmin) {
      console.log('Admin email/phone already exists, returning error');
      return res.status(400).json({ 
        success: false, 
        message: 'Admin with this email or phone already exists' 
      });
    }

    console.log('Starting database transaction...');
    const created = await db.transaction(async (trx) => {
      console.log('Inserting gym with data:', {
        name: gym_name,
        contact_number: gym_contact,
        email: gym_email
      });
      
      const [gym] = await trx('gyms').insert({
        name: gym_name,
        contact_number: gym_contact,
        email: gym_email
      }).returning('*');
      
      console.log('Gym created:', gym);

      console.log('Hashing password...');
      const hashed = await bcrypt.hash(password, 10);
      
      console.log('Inserting gym admin with data:', {
        gym_id: gym.id,
        name: name,
        phone: phone,
        email: email,
        password: '[HASHED]',
        permissions: JSON.stringify(permissions),
        permissions_raw: permissions,
        token_version: 1
      });
      
      const [gymAdmin] = await trx('gym_admins').insert({
        gym_id: gym.id,
        name: name,
        phone: phone,
        email: email,
        password: hashed,
        permissions: JSON.stringify(permissions),
        token_version: 1,
        is_blocked: false
      }).returning('*');
      
      console.log('Gym admin created:', gymAdmin);

      return { gym, gymAdmin };
    });

    console.log('Transaction completed successfully:', created);
    res.json({ success: true, data: created });
  } catch (err) {
    console.error('=== ERROR CREATING GYM AND ADMIN ===');
    console.error('Error details:', err);
    console.error('Error code:', err.code);
    console.error('Error constraint:', err.constraint);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    
    // Handle specific database errors
    if (err.code === '23505') { // PostgreSQL unique violation
      console.log('PostgreSQL unique violation detected');
      if (err.constraint === 'gyms_email_unique') {
        return res.status(400).json({ 
          success: false, 
          message: 'Gym with this email already exists' 
        });
      } else if (err.constraint === 'gym_admins_email_unique') {
        return res.status(400).json({ 
          success: false, 
          message: 'Admin with this email already exists' 
        });
      } else if (err.constraint === 'gym_admins_phone_unique') {
        return res.status(400).json({ 
          success: false, 
          message: 'Admin with this phone number already exists' 
        });
      }
    }
    
    console.log('Returning generic error response');
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create gym and admin: ' + err.message 
    });
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
        'gym_admins.is_blocked',
        'gym_admins.created_at',
        'gyms.name as gym_name',
        'gyms.id as gym_id'
      )
      .orderBy('gym_admins.created_at', 'desc');

    // Parse permissions from JSON string to array
    const adminsWithParsedPermissions = gymAdmins.map(admin => {
      console.log('Raw admin permissions:', admin.permissions, 'Type:', typeof admin.permissions);
      let parsedPermissions = [];
      try {
        if (admin.permissions) {
          if (typeof admin.permissions === 'string') {
            parsedPermissions = JSON.parse(admin.permissions);
          } else if (Array.isArray(admin.permissions)) {
            parsedPermissions = admin.permissions;
          } else {
            parsedPermissions = [];
          }
        } else {
          parsedPermissions = [];
        }
      } catch (err) {
        console.error('Error parsing permissions for admin', admin.id, ':', err);
        parsedPermissions = [];
      }
      console.log('Parsed permissions:', parsedPermissions);
      return {
        ...admin,
        permissions: parsedPermissions
      };
    });

    res.json({ success: true, data: adminsWithParsedPermissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch gym admins' });
  }
};

exports.createGymAdmin = async (req, res) => {
  try {
    const { gym_id, gym_name, name, email, phone, password, permissions = [] } = req.body;

    if ((!gym_id && !gym_name) || !name || !email || !phone || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Gym ID or Gym Name, name, email, phone, and password are required' 
      });
    }

    let gym;
    if (gym_id) {
      // If gym_id is provided, use it
      gym = await db('gyms').where({ id: gym_id }).first();
    } else if (gym_name) {
      // If gym_name is provided, find the gym by name
      gym = await db('gyms').where({ name: gym_name }).first();
    }

    if (!gym) {
      return res.status(404).json({ success: false, message: 'Gym not found' });
    }

    const actualGymId = gym.id;

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
        gym_id: actualGymId,
        name,
        email,
        phone,
        password: hashedPassword,
        permissions: JSON.stringify(permissions),
        token_version: 1,
        is_blocked: false
      })
      .returning(['id', 'name', 'email', 'phone', 'permissions', 'gym_id', 'is_blocked', 'created_at']);

    let parsedPermissions = [];
    try {
      if (gymAdmin.permissions) {
        if (typeof gymAdmin.permissions === 'string') {
          parsedPermissions = JSON.parse(gymAdmin.permissions);
        } else if (Array.isArray(gymAdmin.permissions)) {
          parsedPermissions = gymAdmin.permissions;
        } else {
          parsedPermissions = [];
        }
      } else {
        parsedPermissions = [];
      }
    } catch (err) {
      console.error('Error parsing permissions in createGymAdmin:', err);
      parsedPermissions = [];
    }

    const adminWithParsedPermissions = {
      ...gymAdmin,
      gym_name: gym.name,
      permissions: parsedPermissions
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
    const { name, email, phone, password, permissions, is_blocked } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (permissions) updateData.permissions = JSON.stringify(permissions);
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (typeof is_blocked === 'boolean') updateData.is_blocked = is_blocked;

    const [updatedAdmin] = await db('gym_admins')
      .where({ id })
      .update({ ...updateData, updated_at: db.fn.now() })
      .returning(['id', 'name', 'email', 'phone', 'permissions', 'gym_id', 'is_blocked', 'updated_at']);

    if (!updatedAdmin) {
      return res.status(404).json({ success: false, message: 'Gym admin not found' });
    }

    let parsedPermissions = [];
    try {
      if (updatedAdmin.permissions) {
        if (typeof updatedAdmin.permissions === 'string') {
          parsedPermissions = JSON.parse(updatedAdmin.permissions);
        } else if (Array.isArray(updatedAdmin.permissions)) {
          parsedPermissions = updatedAdmin.permissions;
        } else {
          parsedPermissions = [];
        }
      } else {
        parsedPermissions = [];
      }
    } catch (err) {
      console.error('Error parsing permissions in updateGymAdmin:', err);
      parsedPermissions = [];
    }

    const adminWithParsedPermissions = {
      ...updatedAdmin,
      permissions: parsedPermissions
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