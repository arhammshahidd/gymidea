const db = require('../config/db');

// View stats: ongoing and completed workouts
exports.view = async (req, res, next) => {
  try {
    const { user_id, from, to } = req.query;
    const base = db('training_plans').where({ gym_id: req.user.gym_id });
    if (user_id) base.andWhere('user_id', user_id);
    if (from) base.andWhere('start_date', '>=', from);
    if (to) base.andWhere('end_date', '<=', to);

    const rows = await base.select(
      'id',
      'category',
      'workout_name',
      'status',
      'start_date',
      'end_date',
      'training_minutes',
      'sets',
      'reps',
      'weight_kg'
    ).orderBy('created_at', 'desc');

    const ongoing = [];
    const completed = [];

    for (const r of rows) {
      if (r.status === 'ACTIVE' || r.status === 'PLANNED') {
        ongoing.push({
          id: r.id,
          category: r.category,
          workout_name: r.workout_name,
          status: r.status === 'ACTIVE' ? 'Ongoing' : 'Scheduled',
          start_date: r.start_date,
          end_date: r.end_date,
        });
      } else if (r.status === 'COMPLETED') {
        completed.push({
          id: r.id,
          category: r.category,
          workout_name: r.workout_name,
          date: r.end_date || r.start_date,
          duration_minutes: r.training_minutes,
          results: { sets: r.sets, reps: r.reps, weight_kg: r.weight_kg }
        });
      }
    }

    res.json({ success: true, data: { ongoing, completed } });
  } catch (err) { next(err); }
};


