const express = require('express');
const router = express.Router();
const engineController = require('../controllers/engineController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/ingest', requireAuth, engineController.ingestData);
router.post('/chat', engineController.chatWithEngine);
router.delete('/knowledge-base/:id', requireAuth, engineController.deleteKnowledgeBase);

module.exports = router;