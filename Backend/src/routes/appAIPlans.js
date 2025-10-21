const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/AppAIPlansController');
const auth = require('../middleware/authMiddleware');

// AI Plan Requests
router.get('/requests', auth(), ctrl.listRequests);
router.get('/requests/:id', auth(), ctrl.getRequest);
router.post('/requests', auth(), ctrl.createRequest);
router.put('/requests/:id', auth(), ctrl.updateRequest);
router.delete('/requests/:id', auth(), ctrl.deleteRequest);

// AI Generated Plans
router.get('/generated', auth(), ctrl.listGeneratedPlans);
router.get('/generated/:id', auth(), ctrl.getGeneratedPlan);
router.post('/generated', auth(), ctrl.createGeneratedPlan);
router.put('/generated/:id', auth(), ctrl.updateGeneratedPlan);
router.delete('/generated/:id', auth(), ctrl.deleteGeneratedPlan);

// Generate endpoint (alias for /generated with generate_items=true)
router.post('/generate', auth(), ctrl.createGeneratedPlan);

module.exports = router;


