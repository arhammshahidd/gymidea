const db = require('../config/db');
const bcrypt = require('bcrypt');

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const gymId = req.user.gym_id;
    
    console.log('=== GETTING USER STATS ===');
    console.log('Gym ID:', gymId);

    // Get total users
    const totalUsers = await db('users')
      .where({ gym_id: gymId })
      .count('id as count')
      .first();

    // Get active users
    const activeUsers = await db('users')
      .where({ gym_id: gymId, status: 'ACTIVE' })
      .count('id as count')
      .first();

    // Get inactive users
    const inactiveUsers = await db('users')
      .where({ gym_id: gymId, status: 'INACTIVE' })
      .count('id as count')
      .first();

    // Get basic membership users
    const basicMembers = await db('users')
      .where({ gym_id: gymId, membership_tier: 'BASIC' })
      .count('id as count')
      .first();

    // Get premium membership users
    const premiumMembers = await db('users')
      .where({ gym_id: gymId, membership_tier: 'PREMIUM' })
      .count('id as count')
      .first();

    const stats = {
      totalUsers: parseInt(totalUsers.count),
      totalActiveUsers: parseInt(activeUsers.count),
      totalInactiveUsers: parseInt(inactiveUsers.count),
      totalBasicMemberships: parseInt(basicMembers.count),
      totalPremiumMemberships: parseInt(premiumMembers.count)
    };

    console.log('User stats:', stats);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get user statistics' });
  }
};

// Get all users for the gym (with latest payment status)
exports.getAllUsers = async (req, res) => {
  try {
    const gymId = req.user.gym_id;
    
    console.log('=== GETTING ALL USERS ===');
    console.log('Gym ID:', gymId);

    // Join latest payment status per user (based on most recent payment-related timestamp)
    const users = await db('users as u')
      .where({ 'u.gym_id': gymId })
      .leftJoin(
        db.raw(`LATERAL (
          SELECT ps.payment_status
          FROM payment_status ps
          WHERE ps.user_id = u.id AND ps.gym_id = ?
          ORDER BY COALESCE(ps.payment_date, ps.created_at, ps.updated_at) DESC, ps.id DESC
          LIMIT 1
        ) latest`, [gymId]),
        db.raw('TRUE'),
        db.raw('TRUE')
      )
      .select(
        'u.id',
        'u.name',
        'u.email',
        'u.phone',
        'u.status',
        'u.membership_tier',
        'u.is_paid',
        'u.created_at',
        'u.updated_at',
        db.raw('latest.payment_status as latest_payment_status')
      )
      .orderBy('u.created_at', 'desc');

    console.log('Found users:', users.length);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Failed to get users' });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id;
    
    console.log('=== GETTING USER BY ID ===');
    console.log('User ID:', id, 'Gym ID:', gymId);

    const user = await db('users')
      .where({ id, gym_id: gymId })
      .select('id', 'name', 'email', 'phone', 'status', 'membership_tier', 'is_paid', 'created_at', 'updated_at')
      .first();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('User found:', user);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, message: 'Failed to get user' });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const gymId = req.user.gym_id;
    const { name, email, phone, password, status = 'ACTIVE', membership_tier = 'BASIC' } = req.body;
    
    console.log('=== CREATING USER ===');
    console.log('Gym ID:', gymId);
    console.log('User data:', { name, email, phone, status, membership_tier });

    // Validate required fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, phone, and password are required' 
      });
    }

    // Check if email already exists
    const existingEmail = await db('users').where({ email }).first();
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already exists' 
      });
    }

    // Check if phone already exists
    const existingPhone = await db('users').where({ phone }).first();
    if (existingPhone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [newUser] = await db('users').insert({
      gym_id: gymId,
      name,
      email,
      phone,
      password: hashedPassword,
      status,
      membership_tier,
      is_paid: membership_tier === 'PREMIUM',
      token_version: 1
    }).returning(['id', 'name', 'email', 'phone', 'status', 'membership_tier', 'is_paid', 'created_at']);

    console.log('User created successfully:', newUser);
    res.status(201).json({ success: true, data: newUser, message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id;
    const { name, email, phone, password, status, membership_tier } = req.body;
    
    console.log('=== UPDATING USER ===');
    console.log('User ID:', id, 'Gym ID:', gymId);
    console.log('Update data:', { name, email, phone, status, membership_tier });

    // Check if user exists
    const existingUser = await db('users').where({ id, gym_id: gymId }).first();
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (status) updateData.status = status;
    if (membership_tier) {
      updateData.membership_tier = membership_tier;
      updateData.is_paid = membership_tier === 'PREMIUM';
    }
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Check for email conflicts (if email is being changed)
    if (email && email !== existingUser.email) {
      const emailExists = await db('users').where({ email }).andWhere('id', '!=', id).first();
      if (emailExists) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email already exists' 
        });
      }
    }

    // Check for phone conflicts (if phone is being changed)
    if (phone && phone !== existingUser.phone) {
      const phoneExists = await db('users').where({ phone }).andWhere('id', '!=', id).first();
      if (phoneExists) {
        return res.status(400).json({ 
          success: false, 
          message: 'Phone number already exists' 
        });
      }
    }

    // Update user
    const [updatedUser] = await db('users')
      .where({ id, gym_id: gymId })
      .update(updateData)
      .returning(['id', 'name', 'email', 'phone', 'status', 'membership_tier', 'is_paid', 'updated_at']);

    console.log('User updated successfully:', updatedUser);
    res.json({ success: true, data: updatedUser, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id;
    
    console.log('=== DELETING USER ===');
    console.log('User ID:', id, 'Gym ID:', gymId);

    // Check if user exists
    const existingUser = await db('users').where({ id, gym_id: gymId }).first();
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete user
    await db('users').where({ id, gym_id: gymId }).del();

    console.log('User deleted successfully');
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

// Logout user from mobile app
exports.logoutUser = async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id;
    
    console.log('=== LOGGING OUT USER ===');
    console.log('User ID:', id, 'Gym ID:', gymId);

    // Check if user exists
    const existingUser = await db('users').where({ id, gym_id: gymId }).first();
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Increment token version to invalidate all existing tokens
    await db('users')
      .where({ id, gym_id: gymId })
      .update({ 
        token_version: db.raw('token_version + 1'),
        updated_at: new Date()
      });

    console.log('User logged out successfully');
    res.json({ success: true, message: 'User logged out successfully from mobile app' });
  } catch (error) {
    console.error('Error logging out user:', error);
    res.status(500).json({ success: false, message: 'Failed to logout user' });
  }
};
