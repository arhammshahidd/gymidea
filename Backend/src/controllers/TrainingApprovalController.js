const db = require('../config/db');
const { createDistributedPlan } = require('../utils/exerciseDistribution');

// List approvals
exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, approval_status, category, user_id } = req.query;
    const query = db('training_approvals').where({ gym_id: req.user.gym_id }).orderBy('created_at', 'desc');
    if (approval_status) query.andWhere('approval_status', approval_status);
    if (category) query.andWhere('category', category);
    if (user_id) query.andWhere('user_id', user_id);
    const rows = await query.limit(limit).offset((page - 1) * limit);
    const [{ count }] = await db('training_approvals').where({ gym_id: req.user.gym_id }).count('* as count');
    res.json({ success: true, data: rows, pagination: { page: Number(page), limit: Number(limit), total: Number(count) } });
  } catch (err) { next(err); }
};

// Create approval record
exports.create = async (req, res, next) => {
  try {
    const body = req.body || {};
    
    // Check if this is an AI plan submission (has source: "ai" and data structure)
    const isAIPlanSubmission = body.source === 'ai' && body.data && body.data.plan_data;
    
    console.log('🔍 Submission detection:', {
      source: body.source,
      hasData: !!body.data,
      hasPlanData: !!(body.data && body.data.plan_data),
      isAIPlanSubmission,
      bodyKeys: Object.keys(body),
      dataKeys: body.data ? Object.keys(body.data) : null,
      planDataKeys: body.data && body.data.plan_data ? Object.keys(body.data.plan_data) : null
    });
    
    // Check if this is a mobile submission (has JWT token and is using mobile endpoint or has mobile-specific fields)
    // But exclude AI plan submissions
    const isMobileSubmission = req.user.id && !isAIPlanSubmission && (
      req.path.includes('/mobile/submit') || 
      (!body.user_id && !body.user_name && !body.user_phone) ||
      body.plan_category_name || 
      body.exercise_types
    );
    
    if (isAIPlanSubmission) {
      // Handle AI plan submission
      console.log('🤖 AI Plan submission detected - processing...');
      console.log('🤖 AI Plan submission received:', JSON.stringify(body, null, 2));
      
      const { data } = body;
      const { plan_id, plan_type, user_id, plan_data, requested_at } = data;
      
      // Validate required fields for AI plan
      if (!plan_id || !plan_type || !user_id || !plan_data) {
        console.error('❌ Missing required fields:', { plan_id, plan_type, user_id, plan_data: !!plan_data });
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: plan_id, plan_type, user_id, or plan_data'
        });
      }

      // Check if there's already a pending approval for this plan
      const existingApproval = await db('training_approvals')
        .where({ 
          plan_id: plan_id, 
          gym_id: req.user.gym_id,
          approval_status: 'PENDING'
        })
        .first();

      if (existingApproval) {
        console.log('📝 Found existing pending approval, creating new approval request for resubmission');
        // Mark existing approval as superseded
        await db('training_approvals')
          .where({ id: existingApproval.id })
          .update({ 
            approval_status: 'SUPERSEDED',
            notes: (existingApproval.notes || '') + ' [Superseded by resubmission]'
        });
      }
      
      // Extract plan data
      const {
        exercise_plan_category,
        start_date,
        end_date,
        total_workouts,
        training_minutes,
        user_level,
        items = []
      } = plan_data;
      
      // Validate plan data
      if (!exercise_plan_category || !start_date || !end_date) {
        console.error('❌ Missing required plan data:', { 
          exercise_plan_category, 
          start_date, 
          end_date,
          hasItems: items.length > 0 
        });
        return res.status(400).json({
          success: false,
          message: 'Missing required plan data: exercise_plan_category, start_date, or end_date'
        });
      }
      
      // Calculate total days
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
      // Create approval record for AI plan
      let row;
      try {
        [row] = await db('training_approvals')
          .insert({
            gym_id: req.user.gym_id,
            user_id: user_id,
            user_name: req.user.name || 'AI Generated User',
            user_phone: req.user.phone || '',
            start_date: start_date,
            end_date: end_date,
            workout_name: `${exercise_plan_category} Plan`,
            sets: 0, // Will be calculated from items
            reps: 0, // Will be calculated from items
            weight_kg: 0, // Will be calculated from items
            category: exercise_plan_category,
            plan_category_name: exercise_plan_category,
            total_days: totalDays,
            total_training_minutes: training_minutes || 0,
            total_workouts: total_workouts || 0,
            minutes: 0, // Will be calculated from items
            exercise_types: 'ai_generated',
            user_level: user_level || 'Beginner',
            approval_status: 'PENDING',
            notes: 'AI Generated Training Plan',
            // AI plan specific fields
            plan_id: plan_id,
            plan_type: plan_type,
            exercise_plan_category: exercise_plan_category,
            items: items.length > 0 ? JSON.stringify(items) : null,
            daily_plans: null, // Will be generated during approval
            total_exercises: items.length,
            exercises_details: items.length > 0 ? JSON.stringify(items) : null,
            source: 'ai',
            requested_at: requested_at || new Date().toISOString()
          })
          .returning('*');

        console.log('✅ AI Plan approval record created successfully:', row.id);
      } catch (dbError) {
        console.error('❌ Database error creating AI plan approval:', dbError);
        return res.status(500).json({
          success: false,
          message: 'Failed to create approval record: ' + dbError.message
        });
      }

      // Emit realtime event
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:created', { ...row, source: 'ai' });
          if (row.user_id) io.to(`user:${row.user_id}`).emit('trainingApproval:created', { ...row, source: 'ai' });
        }
      } catch (e) {}
      
      res.status(201).json({ 
        success: true, 
        message: 'AI plan sent for approval successfully',
        data: {
          id: row.id,
          plan_id: plan_id,
          plan_type: plan_type,
          source: 'ai',
          user_id: user_id,
          status: row.approval_status,
          requested_at: row.requested_at,
          created_at: row.created_at
        }
      });
      return;
    }
    
    if (isMobileSubmission) {
      // Handle mobile submission through web portal endpoint
      const required = ['start_date', 'end_date', 'workout_name', 'category'];
      for (const field of required) {
        if (!body[field]) {
          return res.status(400).json({ 
            success: false, 
            message: `${field} is required` 
          });
        }
      }

      // Validate date format
      const startDate = new Date(body.start_date);
      const endDate = new Date(body.end_date);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid date format. Use YYYY-MM-DD' 
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'Start date cannot be after end date' 
        });
      }

      // Calculate total days
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      const [row] = await db('training_approvals')
        .insert({
          gym_id: req.user.gym_id,
          user_id: req.user.id,
          user_name: req.user.name || req.user.user_name || body.user_name || 'Mobile User',
          user_phone: req.user.phone || req.user.user_phone || body.user_phone || '',
          start_date: body.start_date,
          end_date: body.end_date,
          workout_name: body.workout_name,
          sets: body.sets ?? 0,
          reps: body.reps ?? 0,
          weight_kg: body.weight_kg === '' ? 0 : (parseFloat(body.weight_kg) || 0),
          category: body.category,
          plan_category_name: body.plan_category_name || body.category,
          total_days: totalDays,
          total_training_minutes: body.total_training_minutes ?? 0,
          total_workouts: body.total_workouts ?? 0,
          minutes: body.minutes ?? 0,
          exercise_types: body.exercise_types || null,
          user_level: body.user_level ?? 'Beginner',
          approval_status: 'PENDING',
          notes: body.notes || null,
          // New fields for enhanced data structure
          plan_id: body.plan_id || null,
          plan_type: body.plan_type || 'manual',
          exercise_plan_category: body.exercise_plan_category || body.category,
          items: body.items ? JSON.stringify(body.items) : null,
          daily_plans: body.daily_plans ? JSON.stringify(body.daily_plans) : null,
          total_exercises: body.total_exercises || (body.items ? body.items.length : 0),
          exercises_details: body.exercises_details || (body.items ? JSON.stringify(body.items) : null),
        })
        .returning('*');

      // Emit realtime event
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:created', { ...row, source: 'mobile_app' });
          if (row.user_id) io.to(`user:${row.user_id}`).emit('trainingApproval:created', { ...row, source: 'mobile_app' });
        }
      } catch (e) {}
      
      res.status(201).json({ 
        success: true, 
        message: 'Training approval submitted successfully',
        data: {
          id: row.id,
          approval_status: row.approval_status,
          created_at: row.created_at
        }
      });
    } else {
      // Handle web portal submission
      const required = ['user_id', 'user_name', 'user_phone', 'start_date', 'end_date', 'workout_name', 'category'];
      for (const f of required) {
        if (!body[f]) return res.status(400).json({ success: false, message: `${f} is required` });
      }
      
      const [row] = await db('training_approvals')
        .insert({
          gym_id: req.user.gym_id,
          user_id: body.user_id,
          user_name: body.user_name,
          user_phone: body.user_phone,
          start_date: body.start_date,
          end_date: body.end_date,
          workout_name: body.workout_name,
          sets: body.sets ?? 0,
          reps: body.reps ?? 0,
          weight_kg: body.weight_kg === '' ? 0 : (parseFloat(body.weight_kg) || 0),
          category: body.category,
          plan_category_name: body.plan_category_name || body.category,
          total_days: body.total_days || Math.ceil((new Date(body.end_date) - new Date(body.start_date)) / (1000 * 60 * 60 * 24)) + 1,
          total_training_minutes: body.total_training_minutes ?? 0,
          total_workouts: body.total_workouts ?? 0,
          minutes: body.minutes ?? 0,
          exercise_types: (body.exercise_types !== undefined && body.exercise_types !== null && body.exercise_types !== '') ? body.exercise_types : null,
          user_level: body.user_level ?? 'Beginner',
          approval_status: body.approval_status ?? 'PENDING',
          notes: body.notes ?? null,
          // New fields for enhanced data structure
          plan_id: body.plan_id || null,
          plan_type: body.plan_type || 'manual',
          exercise_plan_category: body.exercise_plan_category || body.category,
          items: body.items ? JSON.stringify(body.items) : null,
          daily_plans: body.daily_plans ? JSON.stringify(body.daily_plans) : null,
          total_exercises: body.total_exercises || (body.items ? body.items.length : 0),
          exercises_details: body.exercises_details || (body.items ? JSON.stringify(body.items) : null),
        })
        .returning('*');
      
      // Emit realtime event
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:created', row);
          if (row.user_id) io.to(`user:${row.user_id}`).emit('trainingApproval:created', row);
        }
      } catch (e) {}
      
      res.status(201).json({ success: true, data: row });
    }
  } catch (err) { next(err); }
};

// Get single
exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = await db('training_approvals').where({ id, gym_id: req.user.gym_id }).first();
    if (!row) return res.status(404).json({ success: false, message: 'Approval not found' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

// Update
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const update = { ...req.body };
    delete update.gym_id;
    const [row] = await db('training_approvals')
      .where({ id, gym_id: req.user.gym_id })
      .update(update)
      .returning('*');
    if (!row) return res.status(404).json({ success: false, message: 'Approval not found' });
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:updated', row);
        if (row.user_id) io.to(`user:${row.user_id}`).emit('trainingApproval:updated', row);
      }
    } catch (e) {}
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

// Delete
exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await db('training_approvals').where({ id, gym_id: req.user.gym_id }).del();
    if (!deleted) return res.status(404).json({ success: false, message: 'Approval not found' });
    try {
      const io = req.app.get('io');
      if (io) io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:deleted', { id });
    } catch (e) {}
    res.json({ success: true, message: 'Approval deleted' });
  } catch (err) { next(err); }
};

// Update approval status explicitly
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approval_status } = req.body;
    if (!approval_status) return res.status(400).json({ success: false, message: 'approval_status is required' });
    
    const [row] = await db('training_approvals')
      .where({ id, gym_id: req.user.gym_id })
      .update({ approval_status })
      .returning('*');
    if (!row) return res.status(404).json({ success: false, message: 'Approval not found' });

    // If approved, ensure daily_plans JSON is generated and stored on the approval for full [start..end]
    if (approval_status === 'APPROVED') {
      try {
        // Prefer items; fallback to exercises_details
        let items = [];
        if (row.items) {
          try { items = JSON.parse(row.items) || []; } catch (_) { items = []; }
        } else if (row.exercises_details) {
          try { items = JSON.parse(row.exercises_details) || []; } catch (_) { items = []; }
        }

        if (Array.isArray(items) && row.start_date && row.end_date) {
          const startDate = new Date(row.start_date);
          const endDate = new Date(row.end_date);
          const distributed = createDistributedPlan({ items }, startDate, endDate);
          await db('training_approvals')
            .where({ id: row.id })
            .update({ daily_plans: JSON.stringify(distributed.daily_plans), total_days: distributed.total_days });
          row.daily_plans = JSON.stringify(distributed.daily_plans);
          row.total_days = distributed.total_days;

          // Create daily plans for mobile app (for both AI and Manual plans)
          if (row.user_id) {
            try {
              const { createDailyTrainingPlansFromPlan } = require('./AppManualTrainingController');
              await createDailyTrainingPlansFromPlan(
                {
                  id: row.id,
                  start_date: row.start_date,
                  end_date: row.end_date,
                  exercise_plan_category: row.exercise_plan_category || row.category
                },
                items,
                row.user_id,
                row.gym_id
              );
              console.log('✅ Daily plans created for mobile app');
              
              // Update AI plan with exercises_details if it's an AI plan
              if (row.source === 'ai' && row.plan_id) {
                try {
                  await db('app_ai_generated_plans')
                    .where({ id: row.plan_id })
                    .update({ 
                      exercises_details: JSON.stringify(items),
                      updated_at: new Date()
                    });
                  console.log('✅ Updated AI plan with exercises_details');
                } catch (aiUpdateError) {
                  console.error('❌ Error updating AI plan exercises_details:', aiUpdateError);
                }
              }
            } catch (dailyPlanError) {
              console.error('❌ Error creating daily plans for mobile app:', dailyPlanError);
              // Don't fail the approval if daily plan creation fails
            }
          }
        }
      } catch (genErr) {
        console.error('Failed to generate daily_plans on approval:', genErr?.message || genErr);
      }
    }

    // Update original plan status based on source/type
    if (row.plan_id) {
      try {
        const isAI = row.source === 'ai' || row.plan_type === 'ai_generated' || row.exercise_types === 'ai_generated';
        const isManual = row.source === 'manual' || row.plan_type === 'manual';

        if (isAI) {
          console.log('🤖 Syncing AI plan status for plan_id:', row.plan_id, '→', approval_status);
          await db('app_ai_generated_plans')
            .where({ id: row.plan_id })
            .update({
              approval_status: approval_status,
              approved_by: req.user.id,
              approved_at: new Date()
            });
          console.log('✅ AI plan status synced');
        } else if (isManual) {
          console.log('📱 Syncing manual plan status for plan_id:', row.plan_id, '→', approval_status);
          await db('app_manual_training_plans')
            .where({ id: row.plan_id })
            .update({
              approval_status: approval_status,
              approved_by: req.user.id,
              approved_at: new Date()
            });
          console.log('✅ Manual plan status synced');
        } else {
          // Fallback: if plan_type indicates AI, still sync to AI table
          if (row.plan_type === 'ai_generated') {
            console.log('🤖 Fallback sync (plan_type=ai_generated) for plan_id:', row.plan_id, '→', approval_status);
            await db('app_ai_generated_plans')
              .where({ id: row.plan_id })
              .update({
                approval_status: approval_status,
                approved_by: req.user.id,
                approved_at: new Date()
              });
          }
        }
      } catch (planUpdateError) {
        console.error('❌ Error updating linked plan status:', planUpdateError);
        // Don't fail the approval if linked plan update fails
      }
    }

    // Note: Removed automatic assignment creation - approved plans stay in Training Approval section

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:status', row);
        if (row.user_id) io.to(`user:${row.user_id}`).emit('trainingApproval:status', row);
      }
    } catch (e) {}
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

// Mobile app specific endpoint for training approval submission
exports.mobileSubmit = async (req, res, next) => {
  try {
    const body = req.body || {};
    
    // Handle AI plan submission coming from mobile app (same structure as web create)
    const isAIPlanSubmission = body.source === 'ai' && body.data && body.data.plan_data;
    if (isAIPlanSubmission) {
      try {
        const { data } = body;
        const { plan_id, plan_type, user_id, user_name, user_phone, plan_data, requested_at } = data;

        if (!plan_id || !plan_type || !user_id || !plan_data) {
          return res.status(400).json({ success: false, message: 'Missing required fields: plan_id, plan_type, user_id, or plan_data' });
        }

        const {
          exercise_plan_category,
          start_date,
          end_date,
          total_workouts,
          training_minutes,
          user_level,
          items = []
        } = plan_data;

        if (!exercise_plan_category || !start_date || !end_date) {
          return res.status(400).json({ success: false, message: 'Missing required plan data: exercise_plan_category, start_date, or end_date' });
        }

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        const [row] = await db('training_approvals')
          .insert({
            gym_id: req.user.gym_id,
            user_id: user_id,
            user_name: user_name || req.user.name || 'AI Generated User',
            user_phone: user_phone || req.user.phone || '',
            start_date: start_date,
            end_date: end_date,
            workout_name: `${exercise_plan_category} Plan`,
            sets: 0,
            reps: 0,
            weight_kg: 0,
            category: exercise_plan_category,
            plan_category_name: exercise_plan_category,
            total_days: totalDays,
            total_training_minutes: training_minutes || 0,
            total_workouts: total_workouts || 0,
            minutes: 0,
            exercise_types: 'ai_generated',
            user_level: user_level || 'Beginner',
            approval_status: 'PENDING',
            notes: 'AI Generated Training Plan',
            source: 'ai',
            plan_id: plan_id,
            plan_type: plan_type,
            exercise_plan_category: exercise_plan_category,
            items: Array.isArray(items) && items.length ? JSON.stringify(items) : null,
            daily_plans: null,
            total_exercises: Array.isArray(items) ? items.length : 0,
            exercises_details: Array.isArray(items) && items.length ? JSON.stringify(items) : null,
            requested_at: requested_at ? new Date(requested_at) : new Date()
          })
          .returning('*');

        try {
          const io = req.app.get('io');
          if (io) {
            io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:created', { ...row, source: 'ai' });
            if (row.user_id) io.to(`user:${row.user_id}`).emit('trainingApproval:created', { ...row, source: 'ai' });
          }
        } catch (e) {}

        return res.status(201).json({
          success: true,
          message: 'AI plan sent for approval successfully',
          data: {
            id: row.id,
            plan_id: plan_id,
            plan_type: plan_type,
            source: 'ai',
            user_id: user_id,
            status: row.approval_status,
            requested_at: row.requested_at,
            created_at: row.created_at
          }
        });
      } catch (err) {
        return next(err);
      }
    }

    // Check if this is a manual plan submission (has source: "manual" and data structure)
    const isManualPlanSubmission = body.source === 'manual' && body.data && body.data.plan_data;
    
    if (isManualPlanSubmission) {
      // Handle manual plan submission (similar to AI plan format)
      console.log('📱 Manual Plan submission received:', JSON.stringify(body, null, 2));
      
      const { data } = body;
      const { plan_id, plan_type, user_id, plan_data, requested_at } = data;
      
      // Validate required fields for manual plan
      if (!plan_id || !plan_type || !user_id || !plan_data) {
        console.error('❌ Missing required fields:', { plan_id, plan_type, user_id, plan_data: !!plan_data });
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: plan_id, plan_type, user_id, or plan_data'
        });
      }

      // Check if there's already a pending approval for this manual plan
      const existingApproval = await db('training_approvals')
        .where({ 
          plan_id: plan_id, 
          gym_id: req.user.gym_id,
          source: 'manual',
          approval_status: 'PENDING'
        })
        .first();

      if (existingApproval) {
        console.log('📝 Found existing pending manual plan approval, creating new approval request for resubmission');
        // Mark existing approval as superseded
        await db('training_approvals')
          .where({ id: existingApproval.id })
          .update({ 
            approval_status: 'SUPERSEDED',
            notes: (existingApproval.notes || '') + ' [Superseded by resubmission]'
          });
      }
      
      // Extract plan data
      const {
        exercise_plan_category,
        start_date,
        end_date,
        total_workouts,
        training_minutes,
        user_level,
        items = []
      } = plan_data;
      
      // Validate plan data
      if (!exercise_plan_category || !start_date || !end_date) {
        console.error('❌ Missing required plan data:', { 
          exercise_plan_category, 
          start_date, 
          end_date,
          hasItems: items.length > 0 
        });
        return res.status(400).json({
          success: false,
          message: 'Missing required plan data: exercise_plan_category, start_date, or end_date'
        });
      }
      
      // Calculate total days
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
      // Create training approval record for manual plan
      const [row] = await db('training_approvals')
        .insert({
          gym_id: req.user.gym_id,
          user_id: user_id,
          user_name: req.user.name || req.user.user_name || 'Mobile User',
          user_phone: req.user.phone || req.user.user_phone || '',
          start_date: start_date,
          end_date: end_date,
          workout_name: `${exercise_plan_category} Plan`,
          sets: 0,
          reps: 0,
          weight_kg: 0,
          category: exercise_plan_category,
          plan_category_name: exercise_plan_category,
          total_days: totalDays,
          total_training_minutes: training_minutes || 0,
          total_workouts: total_workouts || 0,
          minutes: training_minutes || 0,
          exercise_types: null,
          user_level: user_level || 'Beginner',
          approval_status: 'PENDING',
          notes: `Manual plan submitted from mobile app`,
          // Manual plan specific fields
          source: 'manual',
          plan_id: plan_id,
          requested_at: requested_at ? new Date(requested_at) : new Date(),
          exercise_plan_category: exercise_plan_category,
          items: items ? JSON.stringify(items) : null,
          total_exercises: items ? items.length : 0,
          exercises_details: items ? JSON.stringify(items) : null,
        })
        .returning('*');
      
      // Emit realtime event
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:created', {
            ...row,
            source: 'manual'
          });
          if (row.user_id) io.to(`user:${row.user_id}`).emit('trainingApproval:created', {
            ...row,
            source: 'manual'
          });
        }
      } catch (e) {}
      
      res.status(201).json({ 
        success: true, 
        message: 'Manual training plan submitted successfully',
        data: {
          id: row.id,
          approval_status: row.approval_status,
          created_at: row.created_at
        }
      });
      return;
    }
    
    // Handle simple mobile submission format
    console.log('📱 Handling simple mobile submission format - this should NOT happen for AI plans!');
    const required = ['start_date', 'end_date', 'workout_name', 'category'];
    for (const field of required) {
      if (!body[field]) {
        console.error(`❌ Missing required field: ${field}`, { body: Object.keys(body) });
        return res.status(400).json({ 
          success: false, 
          message: `${field} is required` 
        });
      }
    }

    // Validate date format
    const startDate = new Date(body.start_date);
    const endDate = new Date(body.end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Start date cannot be after end date' 
      });
    }

    // Validate user_level if provided
    if (body.user_level && !['Beginner', 'Intermediate', 'Expert'].includes(body.user_level)) {
      return res.status(400).json({ 
        success: false, 
        message: 'user_level must be one of: Beginner, Intermediate, Expert' 
      });
    }

    // Calculate total days
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Create training approval record
    const [row] = await db('training_approvals')
      .insert({
        gym_id: req.user.gym_id,
        user_id: req.user.id,
        user_name: req.user.name || req.user.user_name || 'Mobile User',
        user_phone: req.user.phone || req.user.user_phone || '',
        start_date: body.start_date,
        end_date: body.end_date,
        workout_name: body.workout_name,
        sets: body.sets ?? 0,
        reps: body.reps ?? 0,
        weight_kg: body.weight_kg ?? 0,
        category: body.category,
        plan_category_name: body.plan_category_name || body.category,
        total_days: totalDays,
        total_training_minutes: body.total_training_minutes ?? 0,
        total_workouts: body.total_workouts ?? 0,
        minutes: body.minutes ?? 0,
        exercise_types: body.exercise_types || null,
        user_level: body.user_level ?? 'Beginner',
        approval_status: 'PENDING',
        notes: body.notes || null,
      })
      .returning('*');

    // Emit realtime event for web portal
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`gym:${req.user.gym_id}`).emit('trainingApproval:created', {
          ...row,
          source: 'mobile_app'
        });
      }
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Training approval submitted successfully',
      data: {
        id: row.id,
        approval_status: row.approval_status,
        created_at: row.created_at
      }
    });
  } catch (err) { 
    next(err); 
  }
};

// Get detailed training approval with workout plan breakdown
exports.getDetailed = async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = await db('training_approvals').where({ id, gym_id: req.user.gym_id }).first();
    
    if (!row) {
      return res.status(404).json({ success: false, message: 'Approval not found' });
    }

    // Parse items (all exercises) if available
    let items = [];
    if (row.items) {
      try {
        items = JSON.parse(row.items);
      } catch (e) {
        console.error('Error parsing items:', e);
        items = [];
      }
    }

    // Parse daily plans if available
    let dailyPlans = [];
    if (row.daily_plans) {
      try {
        dailyPlans = JSON.parse(row.daily_plans);
      } catch (e) {
        console.error('Error parsing daily plans:', e);
        dailyPlans = [];
      }
    }

    // Parse exercises details if available (backward compatibility)
    let workoutPlan = [];
    if (row.exercises_details) {
      try {
        workoutPlan = JSON.parse(row.exercises_details);
      } catch (e) {
        console.error('Error parsing exercises details:', e);
        workoutPlan = [];
      }
    }

    // If no items but we have exercises_details, use that
    if (items.length === 0 && workoutPlan.length > 0) {
      items = workoutPlan;
    }

    // If no items or exercises_details, create a basic workout plan from the main record
    if (items.length === 0 && row.workout_name) {
      items = [{
        name: row.workout_name,
        workout_name: row.workout_name,
        sets: row.sets || 0,
        reps: row.reps || 0,
        weight: row.weight_kg || 0,
        weight_kg: row.weight_kg || 0,
        exercise_types: row.exercise_types || '',
        training_minutes: row.minutes || 0,
        minutes: row.minutes || 0
      }];
    }

    // Calculate total days if not set
    if (!row.total_days) {
      const startDate = new Date(row.start_date);
      const endDate = new Date(row.end_date);
      row.total_days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    const detailedData = {
      ...row,
      items: items,
      daily_plans: dailyPlans,
      workout_plan: items, // For backward compatibility
      total_exercises: items.length
    };

    res.json({ success: true, data: detailedData });
  } catch (err) { 
    next(err); 
  }
};

// Get daily plans for a training approval
exports.getDailyPlans = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;
    
    // First, verify the training approval exists and belongs to this gym
    const approval = await db('training_approvals')
      .where({ id, gym_id: req.user.gym_id })
      .first();
    
    if (!approval) {
      return res.status(404).json({ success: false, message: 'Training approval not found' });
    }
    
    // Get daily plans for this approval
    let query = db('daily_training_plans')
      .where({ 
        source_plan_id: id,
        gym_id: req.user.gym_id 
      })
      .orderBy('plan_date', 'asc');
    
    // If user_id is specified, filter by user
    if (user_id) {
      query = query.andWhere({ user_id: parseInt(user_id) });
    }
    
    const dailyPlans = await query;
    
    // Get plan items for each daily plan
    for (let plan of dailyPlans) {
      const items = await db('daily_training_plan_items')
        .where({ daily_plan_id: plan.id })
        .orderBy('id', 'asc');
      plan.items = items;
    }
    
    res.json({ 
      success: true, 
      data: {
        approval_id: id,
        daily_plans: dailyPlans,
        total_days: dailyPlans.length
      }
    });
  } catch (err) {
    console.error('Error getting daily plans for training approval:', err);
    next(err);
  }
};

// Delete daily plans for a training approval
exports.deleteDailyPlans = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, confirm_delete } = req.body;
    
    // Require confirmation for safety
    if (confirm_delete !== true) {
      return res.status(400).json({ 
        success: false, 
        message: 'confirmation required: set confirm_delete to true' 
      });
    }
    
    // First, verify the training approval exists and belongs to this gym
    const approval = await db('training_approvals')
      .where({ id, gym_id: req.user.gym_id })
      .first();
    
    if (!approval) {
      return res.status(404).json({ success: false, message: 'Training approval not found' });
    }
    
    // Get daily plans to delete
    let query = db('daily_training_plans')
      .where({ 
        source_plan_id: id,
        gym_id: req.user.gym_id 
      });
    
    // If user_id is specified, filter by user
    if (user_id) {
      query = query.andWhere({ user_id: parseInt(user_id) });
    }
    
    const dailyPlans = await query;
    
    if (dailyPlans.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No daily plans found to delete',
        deleted_count: 0
      });
    }
    
    // Delete plan items first
    for (let plan of dailyPlans) {
      await db('daily_training_plan_items')
        .where({ daily_plan_id: plan.id })
        .del();
    }
    
    // Delete daily plans
    const deletedCount = await query.del();
    
    res.json({ 
      success: true, 
      message: `Successfully deleted ${deletedCount} daily plans`,
      deleted_count: deletedCount,
      approval_id: id
    });
  } catch (err) {
    console.error('Error deleting daily plans for training approval:', err);
    next(err);
  }
};


