const db = require('../config/db');
const axios = require('axios');

function sumMacros(items) {
  return items.reduce((acc, it) => {
    acc.total_calories += Number(it.calories || 0);
    acc.total_proteins += Number(it.proteins || 0);
    acc.total_fats += Number(it.fats || 0);
    acc.total_carbs += Number(it.carbs || 0);
    return acc;
  }, { total_calories: 0, total_proteins: 0, total_fats: 0, total_carbs: 0 });
}

function groupItemsByDateOrDistribute(items, start, end) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1)

  // If items already have a date, group by date
  const hasDate = items.some(it => it.date)
  if (hasDate) {
    const map = new Map()
    for (const it of items) {
      const key = (it.date ? new Date(it.date) : null)
      const d = key ? new Date(Date.UTC(key.getFullYear(), key.getMonth(), key.getDate())) : null
      const iso = d ? d.toISOString().split('T')[0] : null
      if (!iso) continue
      if (!map.has(iso)) map.set(iso, [])
      map.get(iso).push(it)
    }
    const days = []
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const iso = d.toISOString().split('T')[0]
      days.push({ date: iso, items: map.get(iso) || [] })
    }
    return days
  }

  // Otherwise distribute evenly across days
  const days = []
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    days.push({ date: d.toISOString().split('T')[0], items: [] })
  }
  for (let i = 0; i < items.length; i++) {
    const idx = i % days.length
    days[idx].items.push(items[i])
  }
  return days
}

// AI Meal Plan Requests
exports.createRequest = async (req, res) => {
  try {
    const { user_id, meal_plan, age, height_cm, weight_kg, gender, country, illness, future_goal } = req.body;
    const gymId = req.user?.gym_id ?? null;
    if (!user_id || !meal_plan || !age || !height_cm || !weight_kg || !gender || !country || !future_goal) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    }
    const [row] = await db('app_ai_meal_plan_requests').insert({ user_id, gym_id: gymId, meal_plan, age, height_cm, weight_kg, gender, country, illness: illness || null, future_goal }).returning('*');
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('Error creating AI meal plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to create AI meal plan request' });
  }
};

exports.updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { meal_plan, age, height_cm, weight_kg, gender, country, illness, future_goal } = req.body;
    const existing = await db('app_ai_meal_plan_requests').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
    const [updated] = await db('app_ai_meal_plan_requests').where({ id }).update({ meal_plan, age, height_cm, weight_kg, gender, country, illness: illness || null, future_goal, updated_at: new Date() }).returning('*');
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating AI meal plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to update AI meal plan request' });
  }
};

exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('app_ai_meal_plan_requests').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });
    await db('app_ai_meal_plan_requests').where({ id }).del();
    return res.json({ success: true, message: 'Request deleted' });
  } catch (err) {
    console.error('Error deleting AI meal plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete AI meal plan request' });
  }
};

exports.getRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await db('app_ai_meal_plan_requests').where({ id }).first();
    if (!row) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('Error getting AI meal plan request:', err);
    return res.status(500).json({ success: false, message: 'Failed to get AI meal plan request' });
  }
};

exports.listRequests = async (req, res) => {
  try {
    const { user_id } = req.query;
    const qb = db('app_ai_meal_plan_requests').select('*').orderBy('created_at', 'desc');
    if (user_id) qb.where({ user_id });
    const rows = await qb;
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing AI meal plan requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to list AI meal plan requests' });
  }
};

// AI Generated Meal Plans
exports.createGeneratedPlan = async (req, res) => {
  try {
    // Accept alternate field names from mobile clients
    const {
      request_id: rawRequestId,
      user_id,
      start_date,
      end_date,
      meal_category,
      meal_plan_category,
      menu_plan_category,
      meal_plan, // sometimes used as category name
      items = [],
      name,
      email,
      contact,
      description,
    } = req.body;

    const gymId = req.user?.gym_id ?? null;
    const resolvedCategory = (meal_category || meal_plan_category || menu_plan_category || meal_plan || '').toString().trim();
    const request_id = rawRequestId ?? null; // optional for direct posts

    if (!user_id || !start_date || !end_date || !resolvedCategory) {
      return res.status(400).json({ success: false, message: 'user_id, start_date, end_date, and meal_category are required' });
    }

    const macroTotals = sumMacros(Array.isArray(items) ? items : []);
    const dailyPlansArr = groupItemsByDateOrDistribute(Array.isArray(items) ? items : [], start_date, end_date);
    
    // Validate date format
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    if (startDate > endDate) {
      return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
    }

    const [plan] = await db('app_ai_generated_meal_plans').insert({
      request_id,
      user_id,
      gym_id: gymId,
      meal_category: resolvedCategory,
      start_date,
      end_date,
      // approval-like fields
      name: name || null,
      email: email || null,
      contact: contact || null,
      description: description || null,
      menu_plan_category: resolvedCategory, // alias for consistency
      total_days: Math.max(1, Math.ceil((new Date(end_date) - new Date(start_date)) / (1000*60*60*24)) + 1),
      approval_status: 'PENDING',
      // nutrition totals
      total_calories: macroTotals.total_calories,
      total_proteins: macroTotals.total_proteins,
      total_fats: macroTotals.total_fats,
      total_carbs: macroTotals.total_carbs,
      // new daily plans JSON
      daily_plans: JSON.stringify(dailyPlansArr),
    }).returning('*');

    if (Array.isArray(items) && items.length) {
      const rows = items.map((it) => {
        // Validate required fields for each item
        if (!it.meal_type || !it.food_item_name || it.grams === undefined || it.grams === null) {
          throw new Error(`Invalid meal item: missing required fields (meal_type, food_item_name, grams)`);
        }
        
        // Validate meal_type enum
        const validMealTypes = ['Breakfast', 'Lunch', 'Dinner'];
        if (!validMealTypes.includes(it.meal_type)) {
          throw new Error(`Invalid meal_type: ${it.meal_type}. Must be one of: ${validMealTypes.join(', ')}`);
        }
        
        return {
          plan_id: plan.id,
          date: it.date || null,
          meal_type: it.meal_type,
          food_item_name: it.food_item_name,
          grams: Number(it.grams) || 0,
          calories: Number(it.calories) || 0,
          proteins: Number(it.proteins) || 0,
          fats: Number(it.fats) || 0,
          carbs: Number(it.carbs) || 0,
          // extras
          notes: it.notes || null,
          raw_item: it.raw_item ? JSON.stringify(it.raw_item) : null,
        };
      });
      await db('app_ai_generated_meal_plan_items').insert(rows);
    }

    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    console.error('Error creating AI generated meal plan:', err);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    console.error('Error details:', err.message, err.code, err.constraint);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create AI generated meal plan',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.updateGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, meal_category, items, name, email, contact, description, approval_status, approval_notes, approved_by, approved_at } = req.body;
    const existing = await db('app_ai_generated_meal_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });

    let macroTotals = {
      total_calories: existing.total_calories,
      total_proteins: existing.total_proteins,
      total_fats: existing.total_fats,
      total_carbs: existing.total_carbs,
    };
    if (Array.isArray(items)) {
      macroTotals = sumMacros(items);
    }

    const totalDays = (start_date && end_date)
      ? Math.max(1, Math.ceil((new Date(end_date) - new Date(start_date)) / (1000*60*60*24)) + 1)
      : existing.total_days

    const dailyPlansArr = Array.isArray(items)
      ? groupItemsByDateOrDistribute(items, start_date || existing.start_date, end_date || existing.end_date)
      : undefined

    const updates = {
      start_date,
      end_date,
      meal_category,
      menu_plan_category: meal_category,
      name: name ?? existing.name,
      email: email ?? existing.email,
      contact: contact ?? existing.contact,
      description: description ?? existing.description,
      total_days: totalDays,
      approval_status: approval_status ?? existing.approval_status,
      approval_notes: approval_notes ?? existing.approval_notes,
      approved_by: approved_by ?? existing.approved_by,
      approved_at: approved_at ?? existing.approved_at,
      ...macroTotals,
      updated_at: new Date(),
    };

    if (dailyPlansArr) {
      updates.daily_plans = JSON.stringify(dailyPlansArr)
    }

    const [updated] = await db('app_ai_generated_meal_plans')
      .where({ id })
      .update(updates)
      .returning('*');

    if (Array.isArray(items)) {
      await db('app_ai_generated_meal_plan_items').where({ plan_id: id }).del();
      if (items.length) {
        const rows = items.map((it) => ({
          plan_id: id,
          date: it.date || null,
          meal_type: it.meal_type,
          food_item_name: it.food_item_name,
          grams: it.grams,
          calories: it.calories || 0,
          proteins: it.proteins || 0,
          fats: it.fats || 0,
          carbs: it.carbs || 0,
          notes: it.notes || null,
          raw_item: it.raw_item ? JSON.stringify(it.raw_item) : null,
        }));
        await db('app_ai_generated_meal_plan_items').insert(rows);
      }
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating AI generated meal plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to update AI generated meal plan' });
  }
};

exports.deleteGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('app_ai_generated_meal_plans').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, message: 'Plan not found' });
    await db('app_ai_generated_meal_plans').where({ id }).del();
    return res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    console.error('Error deleting AI generated meal plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete AI generated meal plan' });
  }
};

exports.getGeneratedPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    let query = db('app_ai_generated_meal_plans').where({ id });
    
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
    
    const items = await db('app_ai_generated_meal_plan_items').where({ plan_id: id }).orderBy(['date', 'id']);
    return res.json({ success: true, data: { ...plan, items } });
  } catch (err) {
    console.error('Error getting AI generated meal plan:', err);
    return res.status(500).json({ success: false, message: 'Failed to get AI generated meal plan' });
  }
};

exports.listGeneratedPlans = async (req, res) => {
  try {
    const { user_id } = req.query;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    let qb = db('app_ai_generated_meal_plans')
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
    console.error('Error listing AI generated meal plans:', err);
    return res.status(500).json({ success: false, message: 'Failed to list AI generated meal plans' });
  }
};


// Bulk insert items for an existing generated meal plan
exports.bulkInsertItems = async (req, res) => {
  try {
    const { items } = req.body || {};
    const authUser = req.user || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required' });
    }
    if (items.length > 200) {
      return res.status(400).json({ success: false, message: 'items chunk too large (max 200)' });
    }

    // Validate all items minimally and collect plan_ids
    const planIds = new Set();
    for (const it of items) {
      if (!it || typeof it !== 'object') {
        return res.status(400).json({ success: false, message: 'Each item must be an object' });
      }
      if (!it.plan_id) {
        return res.status(400).json({ success: false, message: 'Each item must include plan_id' });
      }
      if (!it.meal_type || !it.food_item_name || it.grams === undefined || it.grams === null) {
        return res.status(400).json({ success: false, message: 'Each item requires meal_type, food_item_name, grams' });
      }
      const validMealTypes = ['Breakfast', 'Lunch', 'Dinner'];
      if (!validMealTypes.includes(it.meal_type)) {
        return res.status(400).json({ success: false, message: `Invalid meal_type: ${it.meal_type}` });
      }
      planIds.add(it.plan_id);
    }

    // Ensure all referenced plans exist and belong to same gym (if applicable)
    const plans = await db('app_ai_generated_meal_plans').whereIn('id', Array.from(planIds));
    if (plans.length !== planIds.size) {
      return res.status(400).json({ success: false, message: 'One or more plan_id do not exist' });
    }
    if (authUser?.gym_id) {
      const allSameGym = plans.every(p => p.gym_id === authUser.gym_id);
      if (!allSameGym) {
        return res.status(403).json({ success: false, message: 'Forbidden: plan belongs to different gym' });
      }
    }

    const rows = items.map((it) => ({
      plan_id: it.plan_id,
      date: it.date || null,
      meal_type: it.meal_type,
      food_item_name: it.food_item_name,
      grams: Number(it.grams) || 0,
      calories: Number(it.calories) || 0,
      proteins: Number(it.proteins) || 0,
      fats: Number(it.fats) || 0,
      carbs: Number(it.carbs) || 0,
      notes: it.notes || null,
      raw_item: it.raw_item ? JSON.stringify(it.raw_item) : null,
    }));

    const inserted = await db('app_ai_generated_meal_plan_items').insert(rows);
    // Update aggregate nutrition totals per affected plan (simple re-sum)
    for (const p of plans) {
      const agg = await db('app_ai_generated_meal_plan_items')
        .where({ plan_id: p.id })
        .sum({ total_calories: 'calories', total_proteins: 'proteins', total_fats: 'fats', total_carbs: 'carbs' })
        .first();
      await db('app_ai_generated_meal_plans')
        .where({ id: p.id })
        .update({
          total_calories: Number(agg?.total_calories || 0),
          total_proteins: Number(agg?.total_proteins || 0),
          total_fats: Number(agg?.total_fats || 0),
          total_carbs: Number(agg?.total_carbs || 0),
          updated_at: new Date(),
        });
    }

    return res.status(201).json({ success: true, inserted: rows.length });
  } catch (err) {
    console.error('Error bulk inserting AI meal plan items:', err);
    return res.status(500).json({ success: false, message: 'Failed to bulk insert items' });
  }
};

// Gemini AI Meal Generation
async function generateMealItemsWithGemini(params) {
  const {
    meal_category,
    age,
    height_cm,
    weight_kg,
    gender,
    country,
    illness,
    future_goal,
    plan_duration_days = 7,
    dietary_restrictions = [],
    preferences = {}
  } = params;

  // Create a more focused prompt to avoid overly large responses
  const createPrompt = (isSimple = false) => {
    if (isSimple) {
      return `Generate a ${plan_duration_days}-day meal plan JSON for a ${age}-year-old ${gender} from ${country} with goal: ${future_goal}.

Schema:
{
  "items": [
    {
      "meal_type": "Breakfast|Lunch|Dinner",
      "food_item_name": "food name",
      "grams": number,
      "calories": number,
      "proteins": number,
      "fats": number,
      "carbs": number,
      "date": "YYYY-MM-DD",
      "notes": "preparation notes"
    }
  ]
}

Rules:
- 3 meals per day (Breakfast, Lunch, Dinner)
- Culturally appropriate for ${country}
- ${illness ? `Dietary restriction: ${illness}` : 'No restrictions'}
- Goal: ${future_goal}
- Return ONLY valid JSON, no markdown`;
    }

    return `
You are a nutrition planning assistant. This is NON-MEDICAL and NON-SEXUAL general nutrition guidance suitable for all audiences. Do not include medical advice.

TASK:
Generate a comprehensive meal plan JSON for a ${plan_duration_days}-day program strictly in this schema:
{
  "items": [
    {
      "meal_type": string,              // "Breakfast" | "Lunch" | "Dinner"
      "food_item_name": string,         // specific food name
      "grams": number,                  // serving size in grams
      "calories": number,               // calories per serving
      "proteins": number,               // protein in grams
      "fats": number,                   // fat in grams
      "carbs": number,                  // carbohydrates in grams
      "date": string,                   // YYYY-MM-DD format (optional, can be null)
      "notes": string                   // optional preparation notes
    }
  ]
}

USER PROFILE:
- Age: ${age} years
- Height: ${height_cm} cm
- Weight: ${weight_kg} kg
- Gender: ${gender}
- Country: ${country}
- Illness/Dietary Restrictions: ${illness || 'None'}
- Additional Dietary Restrictions: ${dietary_restrictions.length > 0 ? dietary_restrictions.join(', ') : 'None'}
- Goal: ${future_goal}
- Meal Category: ${meal_category}
- Duration: ${plan_duration_days} days

USER PREFERENCES:
${Object.keys(preferences).length > 0 ? Object.entries(preferences).map(([key, value]) => `- ${key}: ${value}`).join('\n') : '- No specific preferences provided'}

NUTRITION GUIDELINES:
- Ensure realistic serving sizes and accurate nutritional values
- Include culturally appropriate foods for ${country}
- Consider dietary restrictions: ${illness || 'None'}
- Respect additional restrictions: ${dietary_restrictions.length > 0 ? dietary_restrictions.join(', ') : 'None'}
- Focus on ${future_goal} goal with appropriate macro distribution

MEAL DISTRIBUTION RULES:
- Generate 3 meals per day (Breakfast, Lunch, Dinner)
- Total daily calories should be appropriate for ${future_goal}
- Protein: 20-30% of calories
- Carbs: 45-65% of calories  
- Fats: 20-35% of calories
- Include variety across days to prevent monotony

ABSOLUTE OUTPUT RULES:
- Output must be strictly JSON object as defined above.
- No preface, no explanation, no markdown code fences.
- Return ONLY the JSON object with the items array.

Return ONLY the JSON object with the items array.
`;
  };

  const prompt = createPrompt();

  // Aggressive parsing for very large responses that might have multiple JSON objects or formatting issues
  const parseLargeResponseAggressively = (text) => {
    console.log('🔍 Starting aggressive parsing...');
    
    // Strategy 1: Look for individual meal items scattered throughout the text
    const mealItemPattern = /\{[^}]*"meal_type"[^}]*"food_item_name"[^}]*\}/g;
    const matches = text.match(mealItemPattern) || [];
    console.log(`🔍 Found ${matches.length} potential meal items via regex`);
    
    const validItems = [];
    for (const match of matches) {
      try {
        const item = JSON.parse(match);
        if (item.meal_type && item.food_item_name && typeof item.grams === 'number') {
          validItems.push(item);
        }
      } catch (e) {
        // Skip malformed items
        continue;
      }
    }
    
    if (validItems.length > 0) {
      console.log(`✅ Aggressive parsing found ${validItems.length} valid items`);
      return validItems;
    }
    
    // Strategy 2: Look for JSON arrays containing meal items
    const arrayPattern = /\[[\s\S]*?\]/g;
    const arrays = text.match(arrayPattern) || [];
    
    for (const arrayStr of arrays) {
      try {
        const arr = JSON.parse(arrayStr);
        if (Array.isArray(arr)) {
          const items = arr.filter(item => 
            item && 
            typeof item === 'object' && 
            item.meal_type && 
            item.food_item_name && 
            typeof item.grams === 'number'
          );
          if (items.length > 0) {
            console.log(`✅ Found ${items.length} valid items in array`);
            return items;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Strategy 3: Split by common delimiters and try to parse chunks
    const chunks = text.split(/\n\s*\n|\}\s*\{/);
    for (const chunk of chunks) {
      try {
        const cleaned = chunk.trim();
        if (cleaned.startsWith('{') && cleaned.includes('meal_type')) {
          const item = JSON.parse(cleaned);
          if (item.meal_type && item.food_item_name && typeof item.grams === 'number') {
            validItems.push(item);
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (validItems.length > 0) {
      console.log(`✅ Chunk parsing found ${validItems.length} valid items`);
      return validItems;
    }
    
    throw new Error('Aggressive parsing found no valid meal items');
  };

  // Enhanced helper to safely parse JSON even if model returns extra text or incomplete responses
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
              if (item.meal_type && item.food_item_name) {
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
      item.meal_type && 
      item.food_item_name && 
      typeof item.grams === 'number'
    );
    
    if (validItems.length === 0) {
      throw new Error('No valid meal items found in Gemini response');
    }
    
    return validItems;
  };

  const callGemini = async (model, useSimplePrompt = false) => {
    const modelId = String(model).startsWith('models/') ? String(model).slice(7) : String(model);
    const url = `${process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com'}/${process.env.GEMINI_API_VERSION || 'v1'}/models/${modelId}:generateContent`;
    const currentPrompt = useSimplePrompt ? createPrompt(true) : prompt;
    
    console.log(`🔍 Using ${useSimplePrompt ? 'simple' : 'detailed'} prompt for ${model}`);
    
    const response = await axios.post(
      url,
      {
        contents: [{ role: 'user', parts: [{ text: currentPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: useSimplePrompt ? 8192 : 16384  // Use smaller limit for simple prompt
        },
        // keep default safety settings
      },
      { headers: { 'Content-Type': 'application/json' }, params: { key: process.env.GEMINI_API_KEY } }
    );
    const promptFeedback = response?.data?.promptFeedback;
    const candidate = response?.data?.candidates?.[0];
    if (!candidate || !candidate.content?.parts?.length) {
      const safetyRatings = candidate?.safetyRatings || promptFeedback?.safetyRatings;
      console.error(`Gemini returned no parts. promptFeedback: ${JSON.stringify(promptFeedback)} safetyRatings: ${JSON.stringify(safetyRatings)}`);
      throw new Error('Gemini returned empty content');
    }
    const rawText = candidate.content.parts.map(p => p.text).join('');
    
    // Enhanced logging for debugging
    console.log(`🔍 Gemini response length: ${rawText.length}`);
    console.log(`🔍 First 200 chars: ${rawText.substring(0, 200)}`);
    console.log(`🔍 Last 200 chars: ${rawText.substring(Math.max(0, rawText.length - 200))}`);
    
    try {
      return parseItemsFromText(rawText);
    } catch (e) {
      const preview = (rawText || '').slice(0, 1000);
      console.error('Gemini parse failure preview:', preview);
      console.error('Gemini response length:', rawText.length);
      console.error('Parse error:', e.message);
      
      // Try a more aggressive parsing approach for very large responses
      try {
        console.log('🔄 Attempting aggressive parsing for large response...');
        const aggressiveResult = parseLargeResponseAggressively(rawText);
        if (aggressiveResult && aggressiveResult.length > 0) {
          console.log(`✅ Aggressive parsing succeeded with ${aggressiveResult.length} items`);
          return aggressiveResult;
        }
      } catch (aggressiveError) {
        console.error('❌ Aggressive parsing also failed:', aggressiveError.message);
      }
      
      throw e;
    }
  };

  const modelsToTry = [
    process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash-001'
  ].filter(Boolean);

  for (const model of modelsToTry) {
    try {
      // Try with detailed prompt first
      const items = await callGemini(model, false);
      console.log(`✅ Gemini AI generated ${items.length} meal items`);
      return items;
    } catch (error) {
      console.error(`Gemini ${model} failed with detailed prompt`, { model, message: error.message });
      
      // Try with simple prompt as fallback
      try {
        console.log(`🔄 Retrying ${model} with simple prompt...`);
        const items = await callGemini(model, true);
        console.log(`✅ Gemini AI generated ${items.length} meal items with simple prompt`);
        return items;
      } catch (simpleError) {
        console.error(`Gemini ${model} also failed with simple prompt`, { model, message: simpleError.message });
        
        if (model === modelsToTry[modelsToTry.length - 1]) { // Last model failed
          throw new Error(`Failed to generate meal plan with Gemini AI: ${error.message}`);
        }
      }
    }
  }
}

// AI Generated Meal Plan with Gemini
exports.createGeneratedPlanWithAI = async (req, res) => {
  try {
    const {
      user_id,
      gym_id,
      meal_plan_category,
      meal_category, // fallback for backward compatibility
      start_date,
      end_date,
      total_days,
      age,
      height_cm,
      weight_kg,
      gender,
      country,
      illness,
      future_goal,
      dietary_restrictions = [],
      preferences = {},
      items = [],
      generate_items = true
    } = req.body;

    // Resolve meal category (prefer meal_plan_category from mobile app)
    const resolvedCategory = meal_plan_category || meal_category;
    
    // Validate required fields
    if (!user_id || !resolvedCategory || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id, meal_plan_category, start_date, end_date'
      });
    }

    let generatedItems = [];
    
    if (generate_items && items.length === 0) {
      console.log(`Generating meal items using Gemini AI for category: ${resolvedCategory}`);
      
      try {
        generatedItems = await generateMealItemsWithGemini({
          meal_category: resolvedCategory,
          age,
          height_cm,
          weight_kg,
          gender,
          country,
          illness,
          future_goal,
          plan_duration_days: total_days,
          dietary_restrictions,
          preferences
        });
      } catch (error) {
        console.error('❌ Gemini AI generation failed:', error.message);
        
        // Check if it's a server/API issue vs other errors
        const isServerIssue = error.message.includes('503') || 
                             error.message.includes('502') || 
                             error.message.includes('504') ||
                             error.message.includes('Service Unavailable') ||
                             error.message.includes('Bad Gateway') ||
                             error.message.includes('Gateway Timeout');
        
        if (isServerIssue) {
          return res.status(503).json({
            success: false,
            error: 'Try again later. Server is under repair.',
            error_code: 'SERVICE_UNAVAILABLE',
            retry_after: 300 // 5 minutes
          });
        } else {
          return res.status(500).json({
            success: false,
            error: `Failed to generate AI meal plan: ${error.message}`,
            error_code: 'GENERATION_FAILED'
          });
        }
      }
    } else if (items.length > 0) {
      generatedItems = items;
    } else {
      return res.status(400).json({
        success: false,
        error: 'No meal items provided and generate_items is false. Please provide items or set generate_items to true.'
      });
    }

    // Calculate totals
    const macroTotals = sumMacros(generatedItems);
    const dailyPlansArr = groupItemsByDateOrDistribute(generatedItems, start_date, end_date);

    // Create the plan in the database
    const [planRow] = await db('app_ai_generated_meal_plans')
      .insert({
        user_id,
        gym_id: gym_id || req.user?.gym_id,
        start_date,
        end_date,
        meal_category: resolvedCategory,
        total_days: total_days || Math.max(1, Math.ceil((new Date(end_date) - new Date(start_date)) / (1000*60*60*24)) + 1),
        total_calories: macroTotals.total_calories,
        total_proteins: macroTotals.total_proteins,
        total_fats: macroTotals.total_fats,
        total_carbs: macroTotals.total_carbs,
        daily_plans: JSON.stringify(dailyPlansArr),
        approval_status: 'PENDING',
      })
      .returning('*');

    // Insert the generated items into the database
    if (generatedItems.length > 0) {
      const rows = generatedItems.map((item) => {
        return {
          plan_id: planRow.id,
          date: item.date || null,
          meal_type: item.meal_type,
          food_item_name: item.food_item_name,
          grams: Number(item.grams) || 0,
          calories: Number(item.calories) || 0,
          proteins: Number(item.proteins) || 0,
          fats: Number(item.fats) || 0,
          carbs: Number(item.carbs) || 0,
          notes: item.notes || null,
          raw_item: item.raw_item ? JSON.stringify(item.raw_item) : null,
        };
      });
      
      await db('app_ai_generated_meal_plan_items').insert(rows);
    }

    // Return the response in the exact format expected by Flutter app
    return res.status(201).json({
      success: true,
      data: {
        id: planRow.id,
        user_id,
        gym_id: planRow.gym_id,
        meal_plan_category: resolvedCategory,
        start_date: new Date(planRow.start_date).toISOString(),
        end_date: new Date(planRow.end_date).toISOString(),
        total_days: planRow.total_days,
        total_calories: macroTotals.total_calories,
        total_proteins: macroTotals.total_proteins,
        total_fats: macroTotals.total_fats,
        total_carbs: macroTotals.total_carbs,
        items: generatedItems,
        daily_plans: dailyPlansArr,
        created_at: planRow.created_at,
        updated_at: planRow.updated_at
      }
    });

  } catch (err) {
    console.error('Error creating AI generated meal plan:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate AI meal plan'
    });
  }
};
