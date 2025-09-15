const express = require('express');
const router = express.Router();
const foodMenuController = require('../controllers/FoodMenuController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware('gym_admin'));

// Food Menu Routes
router.get('/', foodMenuController.list);                    // GET /api/foodMenu - List all food menus
router.get('/categories', foodMenuController.getCategories); // GET /api/foodMenu/categories - Get available categories
router.get('/:id', foodMenuController.get);                  // GET /api/foodMenu/:id - Get single food menu
router.post('/', foodMenuController.create);                 // POST /api/foodMenu - Create new food menu
router.put('/:id', foodMenuController.update);               // PUT /api/foodMenu/:id - Update food menu
router.delete('/:id', foodMenuController.remove);            // DELETE /api/foodMenu/:id - Delete food menu
router.patch('/:id/status', foodMenuController.updateStatus); // PATCH /api/foodMenu/:id/status - Update status

module.exports = router;
