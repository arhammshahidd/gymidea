const express = require('express');
const router = express.Router();
const knex = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

// Middleware to check if user is GYM_ADMIN or SUPER_ADMIN
const checkAdminRole = (req, res, next) => {
  if (req.user.role !== 'GYM_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Access denied. Only Gym Admins and Super Admins can perform this action.' });
  }
  next();
};

// Get payment status overview (Total Amount, Paid/Unpaid counts)
router.get('/overview', authMiddleware(), checkAdminRole, async (req, res) => {
  try {
    const gymId = req.user.gym_id || req.user.gymId;
    
    // Get total amount
    const totalAmountResult = await knex('payment_status')
      .where({ gym_id: gymId })
      .sum('amount as total_amount')
      .first();
    
    // Get paid members count
    const paidMembersResult = await knex('payment_status')
      .where({ gym_id: gymId, payment_status: 'Paid' })
      .count('* as paid_count')
      .first();
    
    // Get unpaid members count
    const unpaidMembersResult = await knex('payment_status')
      .where({ gym_id: gymId, payment_status: 'Unpaid' })
      .count('* as unpaid_count')
      .first();
    
    // Get all payment records with user details
    const allPaymentsResult = await knex('payment_status as ps')
      .leftJoin('users as u', 'ps.user_id', 'u.id')
      .where('ps.gym_id', gymId)
      .select(
        'ps.id',
        'ps.user_id',
        'ps.amount',
        'ps.payment_status',
        'ps.payment_date',
        'ps.due_date',
        'ps.created_at',
        'ps.updated_at',
        'u.name as user_name',
        'u.email as user_email',
        'u.phone as user_phone'
      )
      .orderBy('ps.created_at', 'desc');
    
    res.json({
      success: true,
      data: {
        total_amount: parseFloat(totalAmountResult.total_amount || 0),
        paid_members: parseInt(paidMembersResult.paid_count || 0),
        unpaid_members: parseInt(unpaidMembersResult.unpaid_count || 0),
        payments: allPaymentsResult
      }
    });
  } catch (error) {
    console.error('Payment overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment overview'
    });
  }
});

// Get payment history for a specific user
router.get('/history/:userId', authMiddleware(), checkAdminRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const gymId = req.user.gym_id || req.user.gymId;
    
    // Get all payments for the user with user details
    const payments = await knex('payment_status as ps')
      .leftJoin('users as u', 'ps.user_id', 'u.id')
      .where({
        'ps.user_id': userId,
        'ps.gym_id': gymId
      })
      .select(
        'ps.id',
        'ps.user_id',
        'ps.amount',
        'ps.payment_status',
        'ps.payment_date',
        'ps.due_date',
        'ps.created_at',
        'ps.updated_at',
        'u.name as user_name',
        'u.email as user_email',
        'u.phone as user_phone'
      )
      .orderBy('ps.created_at', 'desc');
    
    // Get last payment details
    const lastPayment = payments.length > 0 ? payments[0] : null;
    
    // Calculate total amount paid and unpaid
    const totalPaid = payments
      .filter(p => p.payment_status === 'Paid')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    const totalUnpaid = payments
      .filter(p => p.payment_status === 'Unpaid')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    res.json({
      success: true,
      data: {
        payments,
        lastPayment,
        summary: {
          totalPayments: payments.length,
          totalPaid,
          totalUnpaid,
          totalAmount: totalPaid + totalUnpaid
        }
      }
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
});

// Get all payment records
router.get('/', authMiddleware(), checkAdminRole, async (req, res) => {
  try {
    const gymId = req.user.gym_id || req.user.gymId;
    const { page = 1, limit = 10, status, search, user_id } = req.query;
    const offset = (page - 1) * limit;
    
    let query = knex('payment_status as ps')
      .leftJoin('users as u', 'ps.user_id', 'u.id')
      .where('ps.gym_id', gymId)
      .select(
        'ps.id',
        'ps.user_id',
        'ps.amount',
        'ps.payment_status',
        'ps.payment_date',
        'ps.due_date',
        'ps.created_at',
        'ps.updated_at',
        'u.name as user_name',
        'u.email as user_email',
        'u.phone as user_phone'
      );
    
    // Add user_id filter
    if (user_id) {
      query = query.where('ps.user_id', user_id);
    }
    
    // Add status filter
    if (status && (status === 'Paid' || status === 'Unpaid')) {
      query = query.where('ps.payment_status', status);
    }
    
    // Add search filter
    if (search) {
      query = query.where((builder) => {
        builder.where('u.name', 'ilike', `%${search}%`)
          .orWhere('u.email', 'ilike', `%${search}%`)
          .orWhere('u.phone', 'ilike', `%${search}%`);
      });
    }
    
    // Get total count for pagination
    let countQuery = knex('payment_status as ps')
      .leftJoin('users as u', 'ps.user_id', 'u.id')
      .where('ps.gym_id', gymId);
    
    // Apply same filters to count query
    if (user_id) {
      countQuery = countQuery.where('ps.user_id', user_id);
    }
    if (status && (status === 'Paid' || status === 'Unpaid')) {
      countQuery = countQuery.where('ps.payment_status', status);
    }
    if (search) {
      countQuery = countQuery.where((builder) => {
        builder.where('u.name', 'ilike', `%${search}%`)
          .orWhere('u.email', 'ilike', `%${search}%`)
          .orWhere('u.phone', 'ilike', `%${search}%`);
      });
    }
    
    const totalCount = await countQuery.count('ps.id as count').first();
    
    // Get paginated results
    const payments = await query
      .orderBy('ps.created_at', 'desc')
      .limit(limit)
      .offset(offset);
    
    res.json({
      success: true,
      payments,
      pagination: {
        total_records: parseInt(totalCount.count),
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_pages: Math.ceil(totalCount.count / limit)
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment records'
    });
  }
});

// Get single payment record
router.get('/:id', authMiddleware(), checkAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id || req.user.gymId;
    
    const payment = await knex('payment_status as ps')
      .leftJoin('users as u', 'ps.user_id', 'u.id')
      .where('ps.id', id)
      .where('ps.gym_id', gymId)
      .select(
        'ps.id',
        'ps.user_id',
        'ps.amount',
        'ps.payment_status',
        'ps.payment_date',
        'ps.due_date',
        'ps.created_at',
        'ps.updated_at',
        'u.name as user_name',
        'u.email as user_email',
        'u.phone as user_phone'
      )
      .first();
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }
    
    res.json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment record'
    });
  }
});

// Create new payment record
router.post('/', authMiddleware(), checkAdminRole, async (req, res) => {
  try {
    const gymId = req.user.gym_id || req.user.gymId;
    const { user_id, amount, payment_status, due_date } = req.body;
    
    if (!user_id || !amount || !payment_status || !due_date) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    const newPayment = {
      user_id,
      gym_id: gymId,
      amount,
      payment_status,
      due_date,
      payment_date: payment_status === 'Paid' ? new Date() : null,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const [createdPayment] = await knex('payment_status')
      .insert(newPayment)
      .returning('*');
    
    res.status(201).json({
      success: true,
      message: 'Payment record created successfully',
      payment: createdPayment
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment record'
    });
  }
});

// Update payment record
router.put('/:id', authMiddleware(), checkAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id || req.user.gymId;
    const { user_id, amount, payment_status, due_date } = req.body;
    
    const updatedPayment = {
      user_id,
      amount,
      payment_status,
      due_date,
      payment_date: payment_status === 'Paid' ? new Date() : null,
      updated_at: new Date()
    };
    
    const [updated] = await knex('payment_status')
      .where({ id, gym_id: gymId })
      .update(updatedPayment)
      .returning('*');
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found or not authorized'
      });
    }
    
    res.json({
      success: true,
      message: 'Payment record updated successfully',
      payment: updated
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment record'
    });
  }
});

// Delete payment record
router.delete('/:id', authMiddleware(), checkAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id || req.user.gymId;
    
    const deletedCount = await knex('payment_status')
      .where({ id, gym_id: gymId })
      .del();
    
    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found or not authorized'
      });
    }
    
    res.json({
      success: true,
      message: 'Payment record deleted successfully'
    });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment record'
    });
  }
});

// Send WhatsApp reminders to all unpaid members
router.post('/whatsapp-reminder', authMiddleware(), checkAdminRole, async (req, res) => {
  try {
    const gymId = req.user.gym_id || req.user.gymId;
    
    const unpaidMembers = await knex('payment_status as ps')
      .leftJoin('users as u', 'ps.user_id', 'u.id')
      .where('ps.gym_id', gymId)
      .where('ps.payment_status', 'Unpaid')
      .select('u.phone', 'u.name', 'ps.amount', 'ps.due_date');
    
    if (unpaidMembers.length === 0) {
      return res.json({
        success: true,
        message: 'No unpaid members to send reminders to'
      });
    }
    
    // Simulate sending WhatsApp messages
    for (const member of unpaidMembers) {
      const message = `Hi ${member.name}, this is a reminder that your gym payment of $${member.amount} is due on ${member.due_date}. Please make your payment soon.`;
      console.log(`Sending WhatsApp reminder to ${member.name} (${member.phone}): ${message}`);
      // TODO: Integrate with actual WhatsApp API
    }
    
    res.json({
      success: true,
      message: `WhatsApp reminders sent to ${unpaidMembers.length} unpaid members`
    });
  } catch (error) {
    console.error('WhatsApp reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send WhatsApp reminders'
    });
  }
});

// Send WhatsApp reminder to specific member
router.post('/whatsapp-reminder/:id', authMiddleware(), checkAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id || req.user.gymId;
    
    const payment = await knex('payment_status as ps')
      .leftJoin('users as u', 'ps.user_id', 'u.id')
      .where('ps.id', id)
      .where('ps.gym_id', gymId)
      .where('ps.payment_status', 'Unpaid')
      .select('u.phone', 'u.name', 'ps.amount', 'ps.due_date')
      .first();
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Unpaid payment record not found for this user'
      });
    }
    
    const message = `Hi ${payment.name}, this is a reminder that your gym payment of $${payment.amount} is due on ${payment.due_date}. Please make your payment soon.`;
    console.log(`Sending individual WhatsApp reminder to ${payment.name} (${payment.phone}): ${message}`);
    // TODO: Integrate with actual WhatsApp API
    
    res.json({
      success: true,
      message: `WhatsApp reminder sent to ${payment.name}`
    });
  } catch (error) {
    console.error('Individual WhatsApp reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send individual WhatsApp reminder'
    });
  }
});

module.exports = router;