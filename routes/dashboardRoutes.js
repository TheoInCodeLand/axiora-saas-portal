const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', requireAuth, dashboardController.renderDashboard);
router.post('/regenerate-token', requireAuth, dashboardController.regenerateToken);

module.exports = router;