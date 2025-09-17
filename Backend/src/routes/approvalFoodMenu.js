const express = require('express');
const router = express.Router();
const approvalFoodMenuController = require('../controllers/ApprovalFoodMenuController');
const authMiddleware = require('../middleware/authMiddleware');

// Approval Food Menu Routes - Allow trainers to read, restrict mutations to gym_admin
router.get('/', authMiddleware(), approvalFoodMenuController.list);                    // GET /api/approvalFoodMenu - List all approval requests
router.get('/categories', authMiddleware(), approvalFoodMenuController.getCategories); // GET /api/approvalFoodMenu/categories - Get available categories
router.get('/stats', authMiddleware(), approvalFoodMenuController.getStats);           // GET /api/approvalFoodMenu/stats - Get approval statistics
router.get('/:id', authMiddleware(), approvalFoodMenuController.get);                  // GET /api/approvalFoodMenu/:id - Get single approval request
router.post('/', authMiddleware(), approvalFoodMenuController.create);                 // POST /api/approvalFoodMenu - Create new approval request
router.put('/:id', authMiddleware('gym_admin'), approvalFoodMenuController.update);               // PUT /api/approvalFoodMenu/:id - Update approval request
router.delete('/:id', authMiddleware('gym_admin'), approvalFoodMenuController.remove);            // DELETE /api/approvalFoodMenu/:id - Delete approval request
router.patch('/:id/approval', authMiddleware('gym_admin'), approvalFoodMenuController.updateApprovalStatus); // PATCH /api/approvalFoodMenu/:id/approval - Update approval status

module.exports = router;
