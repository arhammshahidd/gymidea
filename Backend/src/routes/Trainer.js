const express = require('express');
const router = express.Router();
const trainerController = require('../controllers/TrainerController');
const authController = require('../controllers/authcontroller');
const authMiddleware = require('../middleware/authMiddleware');

// ✅ Gym Admin can manage trainers
router.get('/', authMiddleware('gym_admin'), trainerController.getTrainers);
router.post('/', authMiddleware('gym_admin'), trainerController.addTrainer);
router.put('/:id', authMiddleware('gym_admin'), trainerController.updateTrainer);
router.delete('/:id', authMiddleware('gym_admin'), trainerController.deleteTrainer);

// ✅ Trainer login
router.post('/login', authController.trainerLogin);

module.exports = router;
