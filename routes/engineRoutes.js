const express = require('express');
const router = express.Router();
const engineController = require('../controllers/engineController');
const { requireAuth, serviceAuth } = require('../middleware/authMiddleware');

// router.post('/ingest', requireAuth, engineController.ingestData);
// router.post('/chat', engineController.chatWithEngine);
// router.delete('/knowledge-base/:id', requireAuth, engineController.deleteKnowledgeBase);

router.post('/ingest', requireAuth, engineController.ingestData);
router.get('/ingest-status/:jobId', requireAuth, engineController.getIngestStatus);
router.post('/chat', engineController.chatWithEngine);
router.delete('/knowledge-base/:id', requireAuth, engineController.deleteKnowledgeBase);
router.post('/webhook/ingest', serviceAuth, engineController.handleWebhook);

router.post('/webhook/test', (req, res) => {
    console.log('Webhook test hit:', req.body);
    res.json({ received: true });
});

module.exports = router;