const db = require('../config/db');
const { getUserProgressForPlan, smartUpdateMobilePlanItems, smartUpdateAIPlanItems } = require('../utils/smartPlanUpdates');
const axios = require('axios');

// Gemini runtime config (override via env without code edits)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com';
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1';
const GEMINI_PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash-001';

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

// Generate workout items using Gemini AI via REST API
async function generateWorkoutItemsWithGemini(params) {
  const {
    exercise_plan_category,
    start_date,
    end_date,
    age,
    height_cm,
    weight_kg,
    gender,
    future_goal,
    user_level,
    plan_duration_days
  } = params;

  const prompt = `
You are a fitness planning assistant. This is NON-MEDICAL and NON-SEXUAL general fitness guidance suitable for all audiences. Do not include medical advice.

TASK:
Generate a comprehensive training plan JSON for a ${plan_duration_days}-day program strictly in this schema (include progressive weight ranges):
{
  "items": [
    {
      "workout_name": string,            // primary muscle group: Chest | Back | Shoulders | Legs | Arms | Core
      "exercise_types": number,          // count of distinct exercise types for this workout (6-12)
      "sets": number,
      "reps": number,
      "weight_min_kg": number,           // lower bound suitable for the user's level
      "weight_max_kg": number,           // upper bound suitable for the user's level
      "weight_kg": number,               // optional: average between min and max (will be ignored if range provided)
      "minutes": number
    }
  ]
}

Rules:
- Generate a comprehensive ${plan_duration_days}-day training plan with multiple workout variations
- Create at least ${Math.ceil(plan_duration_days / 7) * 2} workout items to cover the full duration
- Ensure realistic volumes for age ${age}, height ${height_cm} cm, weight ${weight_kg} kg, gender ${gender}
- Goal: ${future_goal}
- Category: ${exercise_plan_category}
- User Level: ${user_level || 'Not specified'}
- Dates: ${start_date} to ${end_date}
- Use meaningful workout_name values like Chest, Back, Shoulders, Legs, Arms, Core (no placeholders like "Test Workout").
- Set exercise_types as an integer count (6-12) representing the number of different exercises (for GIF selection).
- Vary workout types throughout the plan (strength, cardio, flexibility, etc.)
- Return ONLY valid JSON, no markdown, no commentary.
- minutes must be realistic (30-90 minutes per workout)

WEIGHT RANGE RULES:
- Beginner: use conservative ranges (e.g., 5-20 kg upper body, 10-30 kg lower body)
- Intermediate: moderate ranges (e.g., 15-40 kg upper body, 25-70 kg lower body)
- Advanced: challenging ranges tailored to stats
- Ensure weight_max_kg ≥ weight_min_kg. If unsure, set both to the same safe value.

ABSOLUTE OUTPUT RULES:
- Output must be strictly JSON object as defined above.
- No preface, no explanation, no markdown code fences.

Return ONLY the JSON object with the items array.
`;

  // helper to safely parse JSON even if model returns extra text
  const parseItemsFromText = (text) => {
    const tryParse = (candidate) => {
      try {
        return JSON.parse(candidate);
      } catch (_err) {
        return null;
      }
    };

    // 1) Direct parse
    let parsed = tryParse(text);

    // 2) Remove code fences ```json ... ``` and retry (handle both complete and incomplete fences)
    if (!parsed) {
      // Try complete code fence first
      const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
      if (fenced && fenced[1]) {
        parsed = tryParse(fenced[1]);
      }
      
      // If still no parse, try incomplete code fence (common when response is cut off)
      if (!parsed) {
        const incompleteFence = /```(?:json)?\s*([\s\S]*?)(?:\n|$)/i.exec(text);
        if (incompleteFence && incompleteFence[1]) {
          // Try to fix incomplete JSON by adding missing closing braces
          let jsonText = incompleteFence[1].trim();
          if (jsonText.startsWith('{') && !jsonText.endsWith('}')) {
            // Count opening and closing braces to estimate what's missing
            const openBraces = (jsonText.match(/\{/g) || []).length;
            const closeBraces = (jsonText.match(/\}/g) || []).length;
            const missingBraces = openBraces - closeBraces;
            
            // Add missing closing braces and brackets
            if (jsonText.includes('"items": [')) {
              jsonText += ']'.repeat(missingBraces > 1 ? missingBraces - 1 : 0);
              jsonText += '}'.repeat(missingBraces);
            } else {
              jsonText += '}'.repeat(missingBraces);
            }
          }
          parsed = tryParse(jsonText);
        }
      }
    }

    // 3) Extract the first JSON object block via regex (greedy, multiline)
    if (!parsed) {
      const objectMatch = /\{[\s\S]*\}/m.exec(text);
      if (objectMatch) parsed = tryParse(objectMatch[0]);
    }

    // 4) If it returned an array at top-level (rare), wrap
    if (!parsed) {
      const arrayMatch = /\[[\s\S]*\]/m.exec(text);
      if (arrayMatch) {
        const arr = tryParse(arrayMatch[0]);
        if (Array.isArray(arr)) parsed = { items: arr };
      }
    }

    // 5) Try to extract partial items from incomplete JSON
    if (!parsed) {
      const itemsMatch = /"items"\s*:\s*\[([\s\S]*?)(?:\]|$)/i.exec(text);
      if (itemsMatch && itemsMatch[1]) {
        try {
          // Try to parse individual items from the array
          const itemsText = itemsMatch[1];
          const itemMatches = itemsText.match(/\{[^}]*\}/g) || [];
          const items = [];
          
          for (const itemText of itemMatches) {
            try {
              const item = JSON.parse(itemText);
              if (item.workout_name && typeof item.sets === 'number') {
                items.push(item);
              }
            } catch (e) {
              // Skip malformed items
              continue;
            }
          }
          
          if (items.length > 0) {
            parsed = { items };
          }
        } catch (e) {
          // Continue to next fallback
        }
      }
    }

    if (!parsed) throw new Error('Gemini returned non-JSON content');
    if (!parsed.items || !Array.isArray(parsed.items)) throw new Error('Invalid response format from Gemini');
    
    // Validate that we have at least some valid items
    const validItems = parsed.items.filter(item => 
      item && 
      typeof item === 'object' && 
      item.workout_name && 
      typeof item.sets === 'number' &&
      typeof item.reps === 'number'
    );
    
    if (validItems.length === 0) {
      throw new Error('No valid workout items found in Gemini response');
    }
    
    return validItems;
  };

  const callGemini = async (model) => {
    const modelId = String(model).startsWith('models/') ? String(model).slice(7) : String(model);
    const url = `${GEMINI_API_BASE}/${GEMINI_API_VERSION}/models/${modelId}:generateContent`;
    
    // IMPORTANT: Add timeout to prevent connection resets
    // Set timeout to 60 seconds (60000ms) for AI generation
    const timeout = 60000;
    
    try {
      const response = await axios.post(
        url,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 16384  // Increased from 8192 to handle larger responses
          },
          // keep default safety settings
        },
        { 
          headers: { 'Content-Type': 'application/json' }, 
          params: { key: GEMINI_API_KEY },
          timeout: timeout  // Add timeout to prevent hanging requests
        }
      );
      
      const promptFeedback = response?.data?.promptFeedback;
      const candidates = response?.data?.candidates || [];
      const content = candidates?.[0]?.content || {};
      const parts = content?.parts || [];
      if (!parts.length) {
        console.error('Gemini returned no parts. promptFeedback:', promptFeedback, 'safetyRatings:', candidates?.[0]?.safetyRatings);
        throw new Error('Gemini returned empty content');
      }
      const text = parts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('\n');
      try {
        return parseItemsFromText(text);
      } catch (e) {
        const preview = (text || '').slice(0, 500);
        const shape = {
          hasCandidates: Array.isArray(response?.data?.candidates),
          numParts: parts.length,
          partTypes: parts.map(p => (p && Object.keys(p)) || [])
        };
        console.error('Gemini parse failure preview:', preview);
        console.error('Gemini response shape:', shape);
        console.error('Gemini response length:', text.length);
        console.error('Parse error:', e.message);
        throw e;
      }
    } catch (axiosError) {
      // Handle timeout and connection errors specifically
      if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
        console.error(`❌ Gemini API timeout after ${timeout}ms for model: ${modelId}`);
        throw new Error(`AI generation timed out. Please try again with a shorter plan duration.`);
      } else if (axiosError.code === 'ECONNRESET' || axiosError.code === 'ETIMEDOUT') {
        console.error(`❌ Gemini API connection error for model: ${modelId}`, axiosError.message);
        throw new Error(`Connection to AI service was reset. Please try again.`);
      } else if (axiosError.response) {
        // HTTP error response from Gemini
        const status = axiosError.response.status;
        const data = axiosError.response.data;
        console.error(`❌ Gemini API HTTP error ${status} for model: ${modelId}`, data);
        throw new Error(`AI service returned error: HTTP ${status}`);
      } else {
        // Other axios errors
        console.error(`❌ Gemini API request error for model: ${modelId}`, axiosError.message);
        throw new Error(`Failed to connect to AI service: ${axiosError.message}`);
      }
    }
  };

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing');
  }

  try {
    return await callGemini(GEMINI_PRIMARY_MODEL);
  } catch (err1) {
    const status = err1?.response?.status;
    const data = err1?.response?.data;
    console.error('Gemini primary model failed', { model: GEMINI_PRIMARY_MODEL, status, data, message: err1.message });
    // Retry with fallback model for 404/400
    try {
      return await callGemini(GEMINI_FALLBACK_MODEL);
    } catch (err2) {
      const status2 = err2?.response?.status;
      const data2 = err2?.response?.data;
      console.error('Gemini fallback model failed', { model: GEMINI_FALLBACK_MODEL, status: status2, data: data2, message: err2.message });
      const reason = status2 || status || 'unknown error';
      throw new Error(`Failed to generate workout plan with Gemini AI: HTTP ${reason}`);
    }
  }
}

// No hardcoded templates - Gemini AI is the only source for workout generation

// Ensure workout_name is a single primary muscle group. If the model
// returns combined names like "Chest & Triceps", expand into multiple
// items (one per muscle) to keep names singular and consistent.
function normalizeAndExpandWorkoutItems(items) {
  const allowed = [
    'chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'biceps', 'triceps',
    'cardio', 'pilates', 'stretching', 'abs', 'calves', 'forearms', 'traps', 'lats', 'delts', 'quads',
    'hamstrings', 'obliques', 'full body', 'upper body', 'lower body', 'squat', 'deadlift'
  ];
  const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const detectMuscles = (name) => {
    const lower = String(name || '').toLowerCase();
    const hits = allowed.filter((m) => lower.includes(m));
    if (hits.length) return [...new Set(hits)];
    // Fallback: split on common delimiters and take first token
    const first = lower.split(/[,/&\-]+/)[0].trim();
    return first ? [first] : [];
  };
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    const muscles = detectMuscles(item.workout_name);
    if (muscles.length <= 1) {
      const name = muscles[0] ? title(muscles[0]) : (item.workout_name || 'Workout');
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ ...item, workout_name: name });
      }
    } else {
      for (const m of muscles) {
        const name = title(m);
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ ...item, workout_name: name });
        }
      }
    }
  }
  return result;
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
        // Generate daily plans if items are provided
        let dailyPlans = null;
        if (Array.isArray(items) && items.length > 0) {
          try {
            const { createDistributedPlan } = require('../utils/exerciseDistribution');
            const distributedPlan = createDistributedPlan(
              { items },
              new Date(startDate),
              new Date(endDate)
            );
            dailyPlans = distributedPlan.daily_plans;
            console.log(`✅ Generated ${dailyPlans?.length || 0} daily plans for AI plan request`);
          } catch (distError) {
            console.error('❌ Failed to generate daily plans for AI plan request:', distError);
            // Continue without daily_plans if generation fails
          }
        }

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
            exercises_details: Array.isArray(items) && items.length > 0 ? JSON.stringify(items) : null,
            daily_plans: Array.isArray(dailyPlans) && dailyPlans.length > 0 ? JSON.stringify(dailyPlans) : null,
          })
          .returning('*');

        // Only insert items if they are provided - no hardcoded generation here
        if (Array.isArray(items) && items.length) {
          const rows = items.map((it) => {
            const workoutName = coerceString(it.workout_name || it.name, 'Workout');
            const minutes = coerceNumber(it.minutes ?? it.training_minutes, 0);
            const exerciseTypes = Array.isArray(it.exercise_types)
              ? it.exercise_types.map(String).join(', ')
              : coerceString(it.exercise_types, undefined);
            
            // Handle weight ranges: calculate average if both min and max are provided
            const min = coerceNumber(it.weight_min_kg, undefined);
            const max = coerceNumber(it.weight_max_kg, undefined);
            const avg = Number.isFinite(min) && Number.isFinite(max)
              ? Math.round(((min + max) / 2) * 100) / 100
              : coerceNumber(it.weight_kg ?? it.weight, 0);
            
            const row = {
              plan_id: planRow.id,
              workout_name: workoutName,
              sets: coerceNumber(it.sets, 0),
              reps: coerceNumber(it.reps, 0),
              weight_kg: avg,
              minutes,
              user_level: it.user_level || 'Beginner',
            };
            if (exerciseTypes !== undefined) row.exercise_types = exerciseTypes;
            // Include weight ranges if provided
            if (Number.isFinite(min)) row.weight_min_kg = min;
            if (Number.isFinite(max)) row.weight_max_kg = max;
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
    const { exercise_plan, age, height_cm, weight_kg, gender, future_goal, user_level } = req.body;
    const existing = await db('app_ai_plan_requests').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
    const [updated] = await db('app_ai_plan_requests').where({ id }).update({ exercise_plan, age, height_cm, weight_kg, gender, future_goal, user_level, updated_at: new Date() }).returning('*');
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
    // Handle the exact Flutter app payload structure
    const {
      user_id,
      gym_id,
      exercise_plan_category,
      start_date,
      end_date,
      age,
      height_cm,
      weight_kg,
      gender,
      future_goal,
      user_level,
      plan_duration_days,
      total_workouts,
      training_minutes,
      items = [],
      generate_items = true
    } = req.body;

    // Validate required fields
    if (!user_id || !exercise_plan_category || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id, exercise_plan_category, start_date, end_date'
      });
    }

    let generatedItems = [];
    
    if (generate_items && items.length === 0) {
      console.log(`Generating workout items using Gemini AI for category: ${exercise_plan_category}`);
      
      try {
        // Generate items using Gemini AI - this is the only method
        // Wrap in try-catch with timeout handling
        generatedItems = await Promise.race([
          generateWorkoutItemsWithGemini({
            exercise_plan_category,
            start_date,
            end_date,
            age,
            height_cm,
            weight_kg,
            gender,
            future_goal,
            user_level,
            plan_duration_days
          }),
          // Add an additional timeout wrapper (70 seconds, slightly longer than axios timeout)
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI generation timed out after 70 seconds')), 70000)
          )
        ]);
        
        // Enforce single-muscle workout_name and expand combined labels
        generatedItems = normalizeAndExpandWorkoutItems(generatedItems);
        
        console.log(`✅ Gemini AI generated ${generatedItems.length} workout items`);
      } catch (geminiError) {
        console.error('❌ Gemini AI generation failed:', geminiError.message);
        console.error('❌ Full error:', geminiError);
        
        // Check if it's a timeout or connection error
        const isTimeout = geminiError.message?.includes('timeout') || 
                         geminiError.message?.includes('timed out') ||
                         geminiError.code === 'ECONNABORTED' ||
                         geminiError.code === 'ETIMEDOUT';
        
        const isConnectionError = geminiError.message?.includes('Connection') ||
                                 geminiError.message?.includes('reset') ||
                                 geminiError.code === 'ECONNRESET' ||
                                 geminiError.code === 'ECONNREFUSED';
        
        // Check if it's a server/API issue vs other errors
        const isServerIssue = geminiError.message?.includes('503') || 
                             geminiError.message?.includes('502') || 
                             geminiError.message?.includes('504') ||
                             geminiError.message?.includes('Service Unavailable') ||
                             geminiError.message?.includes('Bad Gateway') ||
                             geminiError.message?.includes('Gateway Timeout');
        
        if (isTimeout) {
          return res.status(504).json({
            success: false,
            error: 'AI generation timed out. The plan duration may be too long. Please try with a shorter duration (30-60 days).',
            error_code: 'GENERATION_TIMEOUT',
            retry_after: 60
          });
        } else if (isConnectionError) {
          return res.status(503).json({
            success: false,
            error: 'Connection to AI service was reset. Please try again in a moment.',
            error_code: 'CONNECTION_ERROR',
            retry_after: 30
          });
        } else if (isServerIssue) {
          return res.status(503).json({
            success: false,
            error: 'AI service is temporarily unavailable. Please try again later.',
            error_code: 'SERVICE_UNAVAILABLE',
            retry_after: 300 // 5 minutes
          });
        } else {
          return res.status(500).json({
            success: false,
            error: `Failed to generate AI workout plan: ${geminiError.message || 'Unknown error'}`,
            error_code: 'GENERATION_FAILED'
          });
        }
      }
    } else if (items.length > 0) {
      generatedItems = items;
    } else {
      return res.status(400).json({
        success: false,
        error: 'No workout items provided and generate_items is false. Please provide items or set generate_items to true.'
      });
    }

    // Calculate totals
    const calculatedTotalWorkouts = generatedItems.length;
    const calculatedTrainingMinutes = generatedItems.reduce((sum, item) => sum + (item.minutes || 0), 0);

    // Use provided values or calculated values
    const finalTotalWorkouts = total_workouts > 0 ? total_workouts : calculatedTotalWorkouts;
    const finalTrainingMinutes = training_minutes > 0 ? training_minutes : calculatedTrainingMinutes;

    // Generate daily plans using distribution logic and store in daily_plans column
    let dailyPlans = null;
    try {
      const { createDistributedPlan } = require('../utils/exerciseDistribution');
      const distributedPlan = createDistributedPlan(
        { items: generatedItems },
        new Date(start_date),
        new Date(end_date)
      );
      dailyPlans = distributedPlan.daily_plans;
      console.log(`✅ Generated ${dailyPlans?.length || 0} daily plans for AI plan`);
    } catch (distError) {
      console.error('❌ Failed to generate daily plans for AI plan:', distError);
      // Continue without daily_plans if generation fails
    }

    // Create the plan in the database
    const [planRow] = await db('app_ai_generated_plans')
      .insert({
        user_id,
        gym_id: gym_id || req.user?.gym_id,
        start_date,
        end_date,
        exercise_plan_category,
        user_level: user_level || 'Beginner',
        total_workouts: finalTotalWorkouts,
        training_minutes: finalTrainingMinutes,
        exercises_details: generatedItems.length > 0 ? JSON.stringify(generatedItems) : null,
        daily_plans: Array.isArray(dailyPlans) && dailyPlans.length > 0 ? JSON.stringify(dailyPlans) : null,
      })
      .returning('*');

    // Insert the generated items into the database
    if (generatedItems.length > 0) {
      const rows = generatedItems.map((item) => {
        const min = coerceNumber(item.weight_min_kg, undefined);
        const max = coerceNumber(item.weight_max_kg, undefined);
        const avg = Number.isFinite(min) && Number.isFinite(max)
          ? Math.round(((min + max) / 2) * 100) / 100
          : coerceNumber(item.weight_kg, 0);
        return {
          plan_id: planRow.id,
          workout_name: item.workout_name,
          sets: coerceNumber(item.sets, 0),
          reps: coerceNumber(item.reps, 0),
          weight_kg: avg,
          minutes: coerceNumber(item.minutes, 0),
          exercise_types: coerceNumber(item.exercise_types, 0),
          user_level: user_level || 'Beginner',
          // persist range if present (requires columns; otherwise just return in API)
          weight_min_kg: min,
          weight_max_kg: max,
        };
      });
      
      await db('app_ai_generated_plan_items').insert(rows);
    }

    // Sync daily plans from AI plan to daily_training_plans (similar to assigned plans)
    try {
      const { syncDailyPlansFromAIPlanHelper } = require('./DailyTrainingController');
      await syncDailyPlansFromAIPlanHelper(planRow.id);
    } catch (syncError) {
      console.error('Failed to sync daily plans from AI plan:', syncError);
      // Don't fail the main request if sync fails
    }

    // Return the response in the exact format expected by Flutter app
    return res.status(201).json({
      success: true,
      data: {
        id: planRow.id,
        user_id,
        gym_id: planRow.gym_id,
        exercise_plan_category,
        user_level: planRow.user_level || user_level || 'Beginner',
        start_date: new Date(planRow.start_date).toISOString(),
        end_date: new Date(planRow.end_date).toISOString(),
        total_workouts: finalTotalWorkouts,
        training_minutes: finalTrainingMinutes,
        items: generatedItems,
        created_at: planRow.created_at,
        updated_at: planRow.updated_at
      }
    });

  } catch (err) {
    console.error('Error creating AI generated plan:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate AI plan'
    });
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
      .update({ 
        start_date, 
        end_date, 
        exercise_plan_category: resolvedCategory, 
        total_workouts, 
        training_minutes: resolvedTrainingMinutes,
        exercises_details: Array.isArray(items) && items.length > 0 ? JSON.stringify(items) : existing.exercises_details,
        updated_at: new Date() 
      })
      .returning('*');
    if (Array.isArray(items)) {
      console.log(`🤖 Smart updating AI Generated Plan ${id} with ${items.length} exercises`);
      
      // Get user's progress to determine which workouts are completed
      const userProgress = await getUserProgressForPlan(existing.user_id, id);
      const today = new Date().toISOString().split('T')[0];
      
      console.log(`📊 AI Plan user progress: ${userProgress.completedDays} completed days, today: ${today}`);
      
      // Only update future workouts, preserve completed ones
      await smartUpdateAIPlanItems(id, items, userProgress, today);
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
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    let query = db('app_ai_generated_plans').where({ id });
    
    // SECURITY: Ensure proper user isolation
    if (requestingUserRole !== 'gym_admin' && requestingUserRole !== 'trainer') {
      // Regular users can only access their own plans
      query = query.andWhere({ user_id: requestingUserId, gym_id: req.user.gym_id });
    } else {
      // Admin/trainer can access any plan in their gym
      query = query.andWhere({ gym_id: req.user.gym_id });
    }
    
    const plan = await query.first();
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
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    let qb = db('app_ai_generated_plans')
      .select('*')
      .orderBy('created_at', 'desc');
    
    // SECURITY: Ensure proper user isolation
    if (requestingUserRole === 'gym_admin' || requestingUserRole === 'trainer') {
      // Admin/trainer can see plans for specific users or all users in their gym
      if (user_id) {
        qb = qb.where({ user_id: Number(user_id), gym_id: req.user.gym_id });
      } else {
        qb = qb.where({ gym_id: req.user.gym_id });
      }
    } else {
      // Regular users can only see their own plans
      qb = qb.where({ user_id: requestingUserId, gym_id: req.user.gym_id });
    }
    
    const rows = await qb;
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing AI generated plans:', err);
    return res.status(500).json({ success: false, message: 'Failed to list AI generated plans' });
  }
};


