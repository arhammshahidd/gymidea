const express = require('express');
const router = express.Router();
const foodMenuController = require('../controllers/FoodMenuController');
const authMiddleware = require('../middleware/authMiddleware');

// Food Menu Routes - Allow trainers to read, restrict mutations to gym_admin
router.get('/', authMiddleware(), foodMenuController.list);                    // GET /api/foodMenu - List all food menus
router.get('/categories', authMiddleware(), foodMenuController.getCategories); // GET /api/foodMenu/categories - Get available categories
// Place specific routes BEFORE the dynamic :id route
router.get('/assignments', authMiddleware(), foodMenuController.listAssignments); // GET /api/foodMenu/assignments?user_id=
router.get('/assignments/user/:user_id', authMiddleware(), foodMenuController.getUserFoodAssignments); // Mobile: GET user assignments
router.post('/assign', authMiddleware(), foodMenuController.assignToUser);       // POST /api/foodMenu/assign - Assign plan to user
router.put('/assignments/:id', authMiddleware(), foodMenuController.updateAssignment); // PUT /api/foodMenu/assignments/:id - Update assignment
router.delete('/assignments/:id', authMiddleware(), foodMenuController.deleteAssignment); // DELETE /api/foodMenu/assignments/:id - Delete assignment
router.get('/:id', authMiddleware(), foodMenuController.get);                  // GET /api/foodMenu/:id - Get single food menu
router.post('/', authMiddleware(), foodMenuController.create);                 // POST /api/foodMenu - Create new food menu (trainer or admin)
router.put('/:id', authMiddleware('gym_admin'), foodMenuController.update);               // PUT /api/foodMenu/:id - Update food menu
router.delete('/:id', authMiddleware(), foodMenuController.remove);            // DELETE /api/foodMenu/:id - Delete food menu (trainer or admin)
router.patch('/:id/status', authMiddleware('gym_admin'), foodMenuController.updateStatus); // PATCH /api/foodMenu/:id/status - Update status

module.exports = router;
