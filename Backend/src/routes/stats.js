const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/StatsController');
const auth = require('../middleware/authMiddleware');

router.get('/view', auth('gym_admin'), ctrl.view);

module.exports = router;


