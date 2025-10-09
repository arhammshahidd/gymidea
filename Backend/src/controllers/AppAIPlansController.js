const db = require('../config/db');

function coerceNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coerceString(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s.length ? s : fallback;
}

// AI Plan Requests (input parameters)
exports.createRequest = async (req, res) => {
  try {
    // Accept alternate mobile field names and coerce values
    const body = req.body || {};
    const user_id = body.user_id ?? body.userId ?? body.uid;
    const exercise_plan = body.exercise_plan ?? body.exercise_plan_category ?? body.plan_category ?? body.exercise_category;
    const age = body.age ?? body.user_age;
    const height_cm = body.height_cm ?? body.height ?? body.height_in_cm;
    const weight_kg = body.weight_kg ?? body.weight ?? body.weight_in_kg;
    const gender = body.gender ?? body.sex;
    const future_goal = body.future_goal ?? body.goal ?? body.future_goals;
    const user_level = body.user_level ?? body.level;
    const gymId = req.user?.gym_id ?? null;

    const missing = [];
    if (!user_id) missing.push('user_id');
    if (!exercise_plan) missing.push('exercise_plan');
    if (!age && age !== 0) missing.push('age');
    if (!height_cm && height_cm !== 0) missing.push('height_cm');
    if (!weight_kg && weight_kg !== 0) missing.push('weight_kg');
    if (!gender) missing.push('gender');
    if (!future_goal) missing.push('future_goal');
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    const normalizedGender = String(gender).toLowerCase();
    const allowed = ['male', 'female', 'other'];
    const genderValue = allowed.includes(normalizedGender) ? normalizedGender : 'other';
    const [request] = await db('app_ai_plan_requests').insert({ user_id, gym_id: gymId, exercise_plan, age, height_cm, weight_kg, gender: genderValue, future_goal, user_level: user_level || 'Beginner' }).returning('*');

    // Optional auto-generate a plan if plan fields are provided in the same payload
    try {
      const startDate = req.body.start_date || req.body.plan?.start_date;
      const endDate = req.body.end_date || req.body.plan?.end_date;
      const category = req.body.exercise_plan_category || req.body.plan?.exercise_plan_category || exercise_plan;
      const totalWorkouts = req.body.total_workouts ?? req.body.plan?.total_workouts;
      const totalMinutes = req.body.training_minutes ?? req.body.total_training_minutes ?? req.body.plan?.training_minutes ?? req.body.plan?.total_training_minutes;
      const items = Array.isArray(req.body.items) ? req.body.items : (Array.isArray(req.body.plan?.items) ? req.body.plan.items : []);

      if (startDate && endDate && category) {
        const [planRow] = await db('app_ai_generated_plans')
          .insert({
            request_id: request.id,
            user_id,
            gym_id: gymId,
            start_date: startDate,
            end_date: endDate,
            exercise_plan_category: category,
            total_workouts: coerceNumber(totalWorkouts, 0),
            training_minutes: coerceNumber(totalMinutes, 0),
          })
          .returning('*');

        if (Array.isArray(items) && items.length) {
          const rows = items.map((it) => {
            const workoutName = coerceString(it.workout_name || it.name, 'Workout');
            const weight = coerceNumber(it.weight_kg ?? it.weight, 0);
            const minutes = coerceNumber(it.minutes ?? it.training_minutes, 0);
            const exerciseTypes = Array.isArray(it.exercise_types)
              ? it.exercise_types.map(String).join(', ')
              : coerceString(it.exercise_types, undefined);
            const row = {
              plan_id: planRow.id,
              workout_name: workoutName,
              sets: coerceNumber(it.sets, 0),
              reps: coerceNumber(it.reps, 0),
              weight_kg: weight,
              minutes,
              user_level: it.user_level || 'Beginner',
            };
            if (exerciseTypes !== undefined) row.exercise_types = exerciseTypes;
            return row;
          });
          if (rows.length) await db('app_ai_generated_plan_items').insert(rows);
        }
      }
    } catch (e) {
      console.error('Optional auto-generate plan failed:', e?.message || e);
    }

    return res.status(201).json({ success: true, data: request });
  } catch (err) {
    console.error('Error creating AI plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to create AI plan request' });
  }
};

exports.updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { exercise_plan, age, height_cm, weight_kg, gender, future_goal } = req.body;
    const existing = await db('app_ai_plan_requests').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
    const [updated] = await db('app_ai_plan_requests').where({ id }).update({ exercise_plan, age, height_cm, weight_kg, gender, future_goal, updated_at: new Date() }).returning('*');
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating AI plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to update AI plan request' });
  }
};

exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('app_ai_plan_requests').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
    await db('app_ai_plan_requests').where({ id }).del();
    return res.json({ success: true, message: 'Request deleted' });
  } catch (err) {
    console.error('Error deleting AI plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete AI plan request' });
  }
};

exports.getRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await db('app_ai_plan_requests').where({ id }).first();
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, data: request });
  } catch (err) {
    console.error('Error getting AI plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to get AI plan request' });
  }
};

exports.listRequests = async (req, res) => {
  try {
    const { user_id } = req.query;
    const qb = db('app_ai_plan_requests').select('*').orderBy('created_at', 'desc');
    if (user_id) qb.where({ user_id });
    const rows = await qb;
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing AI plan requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to list AI plan requests' });
  }
};

// AI Generated Plans (received plan)
exports.createGeneratedPlan = async (req, res) => {
  try {
    // Accept alternate field names from mobile to avoid 400s
    const {
      request_id: rawRequestId,
      user_id,
      start_date: rawStart,
      end_date: rawEnd,
      exercise_plan_category,
      exercise_plan, // fallback name
      total_workouts,
      training_minutes,
      total_training_minutes, // fallback name
      items = [],
      plan: planPayload // support a nested { plan: {...} }
    } = req.body;

    const payload = planPayload && typeof planPayload === 'object' ? { ...planPayload, ...req.body } : req.body;
    const gymId = req.user?.gym_id ?? null;
    const resolvedCategory = coerceString(exercise_plan_category || exercise_plan || payload.exercise_plan_category || payload.exercise_plan);
    const resolvedTrainingMinutes =
      (typeof training_minutes === 'number' ? training_minutes : undefined) ??
      (typeof total_training_minutes === 'number' ? total_training_minutes : undefined) ??
      coerceNumber(payload.training_minutes ?? payload.total_training_minutes, 0);
    const request_id = rawRequestId ?? null; // request_id is optional when posting generated plans directly

    const start_date = coerceString(rawStart || payload.start_date);
    const end_date = coerceString(rawEnd || payload.end_date);

    if (!user_id || !start_date || !end_date || !resolvedCategory) {
      return res.status(400).json({ success: false, message: 'user_id, start_date, end_date, and exercise_plan_category (or exercise_plan) are required' });
    }

    const [planRow] = await db('app_ai_generated_plans')
      .insert({
        request_id,
        user_id,
        gym_id: gymId,
        start_date,
        end_date,
        exercise_plan_category: resolvedCategory,
        total_workouts: coerceNumber(total_workouts ?? payload.total_workouts, 0),
        training_minutes: coerceNumber(resolvedTrainingMinutes, 0),
      })
      .returning('*');

    const itemArray = Array.isArray(items) && items.length ? items : (Array.isArray(payload.items) ? payload.items : []);
    if (itemArray.length) {
      const rows = itemArray.map((it) => {
        // Normalize common alternate item keys
        const workoutName = coerceString(it.workout_name || it.name, 'Workout');
        const weight = coerceNumber(it.weight_kg ?? it.weight, 0);
        const minutes = coerceNumber(it.minutes ?? it.training_minutes, 0);
        const exerciseTypes = Array.isArray(it.exercise_types)
          ? it.exercise_types.map(String).join(', ')
          : coerceString(it.exercise_types, undefined);
          const row = {
            plan_id: planRow.id,
            workout_name: workoutName,
            sets: coerceNumber(it.sets, 0),
            reps: coerceNumber(it.reps, 0),
            weight_kg: weight,
            minutes,
            user_level: it.user_level || 'Beginner',
          };
          if (exerciseTypes !== undefined) {
            row.exercise_types = exerciseTypes;
          }
        return row;
      });
      if (rows.length) await db('app_ai_generated_plan_items').insert(rows);
    }
    return res.status(201).json({ success: true, data: planRow });
  } catch (err) {
    console.error('Error creating AI generated plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to create AI generated plan' });
  }
};

exports.updateGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      start_date,
      end_date,
      exercise_plan_category,
      exercise_plan, // fallback
      total_workouts,
      training_minutes,
      total_training_minutes, // fallback
      items
    } = req.body;
    const existing = await db('app_ai_generated_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });
    const resolvedCategory = exercise_plan_category || exercise_plan || existing.exercise_plan_category;
    const resolvedTrainingMinutes =
      (typeof training_minutes === 'number' ? training_minutes : undefined) ??
      (typeof total_training_minutes === 'number' ? total_training_minutes : existing.training_minutes);
    const [updated] = await db('app_ai_generated_plans')
      .where({ id })
      .update({ start_date, end_date, exercise_plan_category: resolvedCategory, total_workouts, training_minutes: resolvedTrainingMinutes, updated_at: new Date() })
      .returning('*');
    if (Array.isArray(items)) {
      await db('app_ai_generated_plan_items').where({ plan_id: id }).del();
      if (items.length) {
        const rows = items.map((it) => {
          const workoutName = it.workout_name || it.name;
          const weight = it.weight_kg ?? it.weight ?? 0;
          const minutes = it.minutes ?? it.training_minutes ?? 0;
          const row = { plan_id: id, workout_name: workoutName, sets: it.sets || 0, reps: it.reps || 0, weight_kg: weight, minutes, user_level: it.user_level || 'Beginner' };
          if (it.exercise_types !== undefined && it.exercise_types !== null && it.exercise_types !== '') {
            row.exercise_types = it.exercise_types;
          }
          return row;
        });
        await db('app_ai_generated_plan_items').insert(rows);
      }
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating AI generated plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to update AI generated plan' });
  }
};

exports.deleteGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('app_ai_generated_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });
    await db('app_ai_generated_plans').where({ id }).del();
    return res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    console.error('Error deleting AI generated plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete AI generated plan' });
  }
};

exports.getGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await db('app_ai_generated_plans').where({ id }).first();
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    const items = await db('app_ai_generated_plan_items').where({ plan_id: id }).orderBy('id', 'asc');
    return res.json({ success: true, data: { ...plan, items } });
  } catch (err) {
    console.error('Error getting AI generated plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to get AI generated plan' });
  }
};

exports.listGeneratedPlans = async (req, res) => {
  try {
    const { user_id } = req.query;
    const qb = db('app_ai_generated_plans').select('*').orderBy('created_at', 'desc');
    if (user_id) qb.where({ user_id });
    const rows = await qb;
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing AI generated plans:', err);
    return res.status(500).json({ success: false, message: 'Failed to list AI generated plans' });
  }
};


