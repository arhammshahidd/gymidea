const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/AppManualTrainingController');
const auth = require('../middleware/authMiddleware');

// Mobile App APIs: Manual Training Plan
router.get('/', auth(), ctrl.listPlans);
router.get('/:id', auth(), ctrl.getPlan);
router.post('/', auth(), ctrl.createPlan);
router.put('/:id', auth(), ctrl.updatePlan);
router.delete('/:id', auth(), ctrl.deletePlan);

module.exports = router;


