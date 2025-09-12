const bcrypt = require('bcryptjs');
const db = require('../config/db');

// -------------------- List Trainers --------------------
exports.getTrainers = async (req, res, next) => {
  try {
    const rows = await db('trainers')
      .where({ gym_id: req.user.gym_id })
      .select('id', 'name', 'phone', 'email', 'permissions');

    const trainers = rows.map((t) => ({
      ...t,
      permissions: typeof t.permissions === 'string' ? safeParseJSON(t.permissions, []) : (t.permissions ?? []),
    }));

    res.json({ success: true, trainers });
  } catch (err) {
    next(err);
  }
};

function safeParseJSON(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

// -------------------- Add Trainer --------------------
exports.addTrainer = async (req, res, next) => {
  try {
    const { name, phone, email, password, permissions } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Name, phone, and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [trainer] = await db('trainers')
      .insert({
        gym_id: req.user.gym_id, // 🔑 gym_id comes from logged-in Gym Admin
        name,
        phone,
        email,
        password: hashedPassword,
        permissions: JSON.stringify(permissions || []),
      })
      .returning(['id', 'name', 'phone', 'email', 'permissions']);

    const normalized = {
      ...trainer,
      permissions: typeof trainer.permissions === 'string' ? safeParseJSON(trainer.permissions, []) : (trainer.permissions ?? []),
    };

    res.status(201).json({ success: true, trainer: normalized });
  } catch (err) {
    next(err);
  }
};

// -------------------- Update Trainer --------------------
exports.updateTrainer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, email, password, permissions } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (email) updateData.email = email;
    if (permissions) updateData.permissions = JSON.stringify(permissions);
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const [trainer] = await db('trainers')
      .where({ id, gym_id: req.user.gym_id })
      .update(updateData)
      .returning(['id', 'name', 'phone', 'email', 'permissions']);

    if (!trainer) {
      return res.status(404).json({ success: false, message: 'Trainer not found' });
    }

    const normalized = {
      ...trainer,
      permissions: typeof trainer.permissions === 'string' ? safeParseJSON(trainer.permissions, []) : (trainer.permissions ?? []),
    };

    res.json({ success: true, trainer: normalized });
  } catch (err) {
    next(err);
  }
};

// -------------------- Delete Trainer --------------------
exports.deleteTrainer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await db('trainers')
      .where({ id, gym_id: req.user.gym_id })
      .del();

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Trainer not found' });
    }

    res.json({ success: true, message: 'Trainer deleted successfully' });
  } catch (err) {
    next(err);
  }
};
