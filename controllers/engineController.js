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
    const { userId, question, history } = req.body;
    
    const customerId = `user_${userId}`;
    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8000';

    if (!question || !userId) {
        return res.status(400).json({ error: 'Missing required chat parameters.' });
    }

    try {
        const engineResponse = await fetch(`${pythonEngineUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                customer_id: customerId,
                history: history || []
            })
        });

        const engineData = await engineResponse.json();

        if (!engineResponse.ok) {
            throw new Error(engineData.detail || 'The AI Engine failed to generate an answer.');
        }

        res.status(200).json({ 
            answer: engineData.answer,
            sources_used: engineData.sources_used
        });

    } catch (error) {
        console.error('Chat Proxy Error:', error);
        res.status(500).json({ error: 'Axiora AI is currently unavailable. Please try again later.' });
    }
};

module.exports = { ingestData, chatWithEngine };