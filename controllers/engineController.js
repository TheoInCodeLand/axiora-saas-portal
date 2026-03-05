const pool = require('../config/db');

const ingestData = async (req, res) => {
    const { targetUrl } = req.body;
    const userId = req.session.userId;
    
    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8000';
    
    const customerId = `user_${userId}`; 

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        return res.status(400).json({ error: 'A valid HTTP or HTTPS URL is required.' });
    }

    let kbId;

    try {
        const dbResult = await pool.query(
            `INSERT INTO knowledge_bases (user_id, scraped_url, pinecone_namespace, status) 
             VALUES ($1, $2, $3, 'pending') RETURNING id`,
            [userId, targetUrl, customerId]
        );
        kbId = dbResult.rows[0].id;

        const engineResponse = await fetch(`${pythonEngineUrl}/api/ingest?url=${encodeURIComponent(targetUrl)}&customer_id=${customerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const engineData = await engineResponse.json();

        if (!engineResponse.ok) {
            throw new Error(engineData.detail || 'The AI Engine failed to process this URL.');
        }

        await pool.query(
            `UPDATE knowledge_bases SET status = 'success' WHERE id = $1`,
            [kbId]
        );

        res.status(200).json({ 
            message: 'Data successfully ingested and vectorized.', 
            chunks: engineData.chunks_saved_to_db 
        });

    } catch (error) {
        console.error('Ingestion Pipeline Error:', error);
        
        if (kbId) {
            await pool.query(
                `UPDATE knowledge_bases SET status = 'failed' WHERE id = $1`,
                [kbId]
            );
        }
        
        res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
};

const chatWithEngine = async (req, res) => {
    // 🔒 CRITICAL: Use session userId, NEVER trust body
    const sessionUserId = req.session.userId;
    if (!sessionUserId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { question, history } = req.body;
    
    // Validate question
    if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Invalid question format' });
    }
    
    if (question.length > 1000) {
        return res.status(400).json({ error: 'Question too long (max 1000 chars)' });
    }
    
    // Validate history structure
    if (history && !Array.isArray(history)) {
        return res.status(400).json({ error: 'Invalid history format' });
    }
    
    if (history && history.length > 50) {
        return res.status(400).json({ error: 'History too long' });
    }

    const customerId = `user_${sessionUserId}`;
    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8000';

    try {
        // Add timeout and retry logic
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const engineResponse = await fetch(`${pythonEngineUrl}/api/chat`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Service-Secret': process.env.ENGINE_SECRET || ''  // Service auth
            },
            body: JSON.stringify({
                question: question,
                customer_id: customerId,  // 🔒 From session, not user
                history: history || []
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!engineResponse.ok) {
            const errorText = await engineResponse.text();
            throw new Error(`Engine error: ${engineResponse.status}`);
        }

        const engineData = await engineResponse.json();

        // Validate response has required fields
        if (!engineData.answer) {
            throw new Error('Invalid response from AI engine');
        }

        res.status(200).json({
            answer: engineData.answer,
            phase: engineData.phase || 'UNKNOWN',
            emotion_detected: engineData.emotion_detected || 'neutral',
            confidence: engineData.confidence || 0,
            rapport_score: engineData.rapport_score || 0,
            sources_used: engineData.sources_used || 0
        });

    } catch (error) {
        console.error('Chat Proxy Error:', error);
        
        // Don't leak internal details
        res.status(500).json({ 
            error: 'AI service temporarily unavailable. Please try again in a moment.' 
        });
    }
};

const deleteKnowledgeBase = async (req, res) => {
    const kbId = req.params.id;
    const userId = req.session.userId;
    const customerId = `user_${userId}`;
    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8000';

    try {
        const kbResult = await pool.query(
            'SELECT scraped_url FROM knowledge_bases WHERE id = $1 AND user_id = $2',
            [kbId, userId]
        );

        if (kbResult.rows.length === 0) {
            return res.status(404).json({ error: 'Knowledge base not found.' });
        }

        const targetUrl = kbResult.rows[0].scraped_url;

        const engineResponse = await fetch(`${pythonEngineUrl}/api/delete?url=${encodeURIComponent(targetUrl)}&customer_id=${customerId}`, {
            method: 'DELETE'
        });

        if (!engineResponse.ok) {
            const errorData = await engineResponse.text();
            console.error('---> Python Engine Rejected Deletion:', errorData);
            throw new Error(`Python Engine Error: ${engineResponse.status}`);
        }

        await pool.query('DELETE FROM knowledge_bases WHERE id = $1', [kbId]);
        res.status(200).json({ message: 'Knowledge base successfully deleted.' });

    } catch (error) {
        console.error('Deletion Error:', error);
        res.status(500).json({ error: 'Failed to delete knowledge base.' });
    }
};

module.exports = { 
    ingestData, 
    chatWithEngine,
    deleteKnowledgeBase
};