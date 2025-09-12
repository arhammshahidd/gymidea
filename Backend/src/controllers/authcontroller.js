const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('../utils/jwt');

exports.superAdminLogin = async (req, res) => {
  const rawPhone = req.body.phone ?? req.body.contact_number;
  const { password } = req.body;
  const user = await db('super_admins').where({ phone: rawPhone }).first();
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.signToken({ 
    id: user.id, 
    role: 'SUPER_ADMIN',
    token_version: user.token_version || 1
  });
  res.json({ token, user: { id: user.id, name: user.name, phone: user.phone } });
};

exports.gymAdminLogin = async (req, res) => {
  const rawPhone = req.body.phone ?? req.body.contact_number;
  const { password } = req.body;
  
  console.log('=== GYM ADMIN LOGIN ATTEMPT ===');
  console.log('Phone:', rawPhone);
  console.log('Password provided:', password ? '[PROVIDED]' : '[MISSING]');
  
  const admin = await db('gym_admins').where({ phone: rawPhone }).first();
  console.log('Admin found:', admin ? 'YES' : 'NO');
  if (admin) {
    console.log('Admin details:', {
      id: admin.id,
      name: admin.name,
      phone: admin.phone,
      gym_id: admin.gym_id,
      permissions_raw: admin.permissions
    });
  }
  
  if (!admin) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, admin.password);
  console.log('Password match:', ok ? 'YES' : 'NO');
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  
  // Parse permissions from JSON string or use as array
  let permissions = [];
  try {
    if (admin.permissions) {
      if (typeof admin.permissions === 'string') {
        permissions = JSON.parse(admin.permissions);
      } else if (Array.isArray(admin.permissions)) {
        permissions = admin.permissions;
      } else {
        permissions = [];
      }
    } else {
      permissions = [];
    }
    console.log('Parsed permissions:', permissions);
  } catch (err) {
    console.error('Error parsing permissions:', err);
    permissions = [];
  }
  
  const token = jwt.signToken({ 
    id: admin.id, 
    role: 'GYM_ADMIN', 
    gymId: admin.gym_id,
    token_version: admin.token_version || 1
  });
  
  const responseData = { 
    token, 
    admin: { 
      id: admin.id, 
      name: admin.name, 
      gym_id: admin.gym_id,
      permissions: permissions
    } 
  };
  
  console.log('Login response data:', responseData);
  res.json(responseData);
};

exports.userLogin = async (req, res) => {
  const rawPhone = req.body.phone ?? req.body.contact_number;
  const { password } = req.body;
  try {
    const user = await db('users').where({ phone: rawPhone }).first();
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    // Generate JWT with role USER
    const token = jwt.signToken({
      id: user.id,
      role: 'USER',
      gymId: user.gym_id,
      token_version: user.token_version || 1
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        gym_id: user.gym_id,
        membership_tier: user.membership_tier,
        status: user.status
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed' });
  }
};

function safeParseJSON(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

exports.trainerLogin = async (req, res, next) => {
  try {
    const rawPhone = req.body.phone ?? req.body.contact_number;
    const { password } = req.body;
    
    console.log('=== TRAINER LOGIN ATTEMPT ===');
    console.log('Phone:', rawPhone);
    console.log('Password provided:', password ? '[PROVIDED]' : '[MISSING]');
    
    const trainer = await db('trainers').where({ phone: rawPhone }).first();
    console.log('Trainer found:', trainer ? 'YES' : 'NO');
    
    if (trainer) {
      console.log('Trainer details:', {
        id: trainer.id,
        name: trainer.name,
        phone: trainer.phone,
        gym_id: trainer.gym_id,
        permissions_raw: trainer.permissions
      });
    }

    if (!trainer) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, trainer.password);
    console.log('Password match:', validPassword ? 'YES' : 'NO');
    
    if (!validPassword) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.signToken({
        id: trainer.id,
        gym_id: trainer.gym_id,
        role: 'trainer',
        permissions: trainer.permissions,
      token_version: trainer.token_version || 1
    }, '1d');

    const normalizedPermissions = typeof trainer.permissions === 'string'
      ? safeParseJSON(trainer.permissions, [])
      : (trainer.permissions ?? []);
    
    console.log('Normalized permissions:', normalizedPermissions);

    const responseData = {
      success: true,
      token,
      user: {
        id: trainer.id,
        name: trainer.name,
        phone: trainer.phone,
        email: trainer.email,
        role: 'trainer',
        permissions: normalizedPermissions,
      },
    };
    
    console.log('Trainer login response data:', responseData);
    res.json(responseData);
  } catch (err) {
    console.error('Trainer login error:', err);
    next(err);
  }
};
