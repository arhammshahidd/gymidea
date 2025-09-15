const express = require('express');
const router = express.Router();
const approvalFoodMenuController = require('../controllers/ApprovalFoodMenuController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware('gym_admin'));

// Approval Food Menu Routes
router.get('/', approvalFoodMenuController.list);                    // GET /api/approvalFoodMenu - List all approval requests
router.get('/categories', approvalFoodMenuController.getCategories); // GET /api/approvalFoodMenu/categories - Get available categories
router.get('/stats', approvalFoodMenuController.getStats);           // GET /api/approvalFoodMenu/stats - Get approval statistics
router.get('/:id', approvalFoodMenuController.get);                  // GET /api/approvalFoodMenu/:id - Get single approval request
router.post('/', approvalFoodMenuController.create);                 // POST /api/approvalFoodMenu - Create new approval request
router.put('/:id', approvalFoodMenuController.update);               // PUT /api/approvalFoodMenu/:id - Update approval request
router.delete('/:id', approvalFoodMenuController.remove);            // DELETE /api/approvalFoodMenu/:id - Delete approval request
router.patch('/:id/approval', approvalFoodMenuController.updateApprovalStatus); // PATCH /api/approvalFoodMenu/:id/approval - Update approval status

module.exports = router;
