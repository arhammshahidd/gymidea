const db = require('../config/db');

exports.getProfile = async (req, res) => {
  try {
    const userId = req.params.user_id || req.user?.id;
    const user = await db('users')
      .where({ id: userId })
      .select('id', 'name', 'email', 'phone', 'age', 'height_cm', 'weight_kg', 'pref_workout_alerts', 'pref_meal_reminders')
      .first();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error('Error getting profile:', err);
    return res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.params.user_id || req.user?.id;
    const { name, email, phone, age, height_cm, weight_kg, pref_workout_alerts, pref_meal_reminders } = req.body;
    const existing = await db('users').where({ id: userId }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });
    const [updated] = await db('users')
      .where({ id: userId })
      .update({ name, email, phone, age, height_cm, weight_kg, pref_workout_alerts, pref_meal_reminders, updated_at: new Date() })
      .returning(['id', 'name', 'email', 'phone', 'age', 'height_cm', 'weight_kg', 'pref_workout_alerts', 'pref_meal_reminders']);
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating profile:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

exports.listNotifications = async (req, res) => {
  try {
    const userId = req.params.user_id || req.user?.id;
    const rows = await db('app_notifications').where({ user_id: userId }).orderBy('created_at', 'desc');
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing notifications:', err);
    return res.status(500).json({ success: false, message: 'Failed to list notifications' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params; // notification id
    const userId = req.user?.id;
    const notif = await db('app_notifications').where({ id }).first();
    if (!notif || notif.user_id !== Number(userId)) return res.status(404).json({ success: false, message: 'Notification not found' });
    const [updated] = await db('app_notifications').where({ id }).update({ is_read: true, updated_at: new Date() }).returning('*');
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error marking notification read:', err);
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
};


