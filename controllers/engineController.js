const pool = require('../config/db');

const isValidUrl = (url) => {
    try {
        const parsed = new URL(url);
        const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254'];
        if (blocked.includes(parsed.hostname)) return false;
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        return true;
    } catch {
        return false;
    }
};

const ingestData = async (req, res) => {
    const { targetUrl, max_pages = 100 } = req.body;
    const userId = req.session.userId;
    
    if (!targetUrl || !isValidUrl(targetUrl)) {
        return res.status(400).json({ error: 'Valid HTTP/HTTPS URL required (no localhost/private IPs)' });
    }

    const customerId = `user_${userId}`;
    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8000';
    const engineSecret = process.env.ENGINE_SECRET;

    let kbId;

    try {
        // Create pending record
        const dbResult = await pool.query(
            `INSERT INTO knowledge_bases (user_id, scraped_url, pinecone_namespace, status) 
             VALUES ($1, $2, $3, 'pending') RETURNING id`,
            [userId, targetUrl, customerId]
        );
        kbId = dbResult.rows[0].id;

        console.log(`🚀 Starting ingestion for ${targetUrl} (KB: ${kbId})`);

        // Call Python engine
        const engineResponse = await fetch(`${pythonEngineUrl}/api/ingest`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Service-Secret': engineSecret || ''
            },
            body: JSON.stringify({
                url: targetUrl,
                customer_id: customerId,
                max_pages: parseInt(max_pages) || 100
            })
        });

        const responseData = await engineResponse.json();

        if (!engineResponse.ok) {
            throw new Error(responseData.detail || `Engine error: ${engineResponse.status}`);
        }

        // Handle both old and new response formats
        const jobId = responseData.job_id || null;
        
        // Try to save job_id if provided (new format), but don't fail if column missing
        if (jobId) {
            try {
                await pool.query(
                    `UPDATE knowledge_bases SET job_id = $1 WHERE id = $2`,
                    [jobId, kbId]
                );
            } catch (jobIdError) {
                console.warn('⚠️ Could not save job_id (column may not exist):', jobIdError.message);
            }
        }

        // If Python returns immediately with success (old format), update status
        if (responseData.status === 'Success' || responseData.status === 'success') {
            await pool.query(
                `UPDATE knowledge_bases SET status = 'success' WHERE id = $1`,
                [kbId]
            );
            
            return res.status(200).json({
                status: 'completed',
                kb_id: kbId,
                chunks: responseData.chunks_saved_to_db || responseData.chunks || 0,
                message: 'Ingestion completed successfully'
            });
        }

        console.log(`✅ Job accepted: ${jobId || 'sync-completed'}`);

        res.status(202).json({
            status: responseData.status || 'processing',
            job_id: jobId,
            kb_id: kbId,
            message: jobId ? 'Ingestion started successfully' : 'Ingestion completed'
        });

    } catch (error) {
        console.error('❌ Ingestion Error:', error);
        if (kbId) {
            await pool.query(`UPDATE knowledge_bases SET status = 'failed' WHERE id = $1`, [kbId]);
        }
        res.status(500).json({ 
            error: 'Failed to start ingestion. Please try again.' 
        });
    }
};

const getIngestStatus = async (req, res) => {
    const { jobId } = req.params;
    const userId = req.session.userId;
    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8000';
    const engineSecret = process.env.ENGINE_SECRET;

    try {
        // Verify ownership
        const kbResult = await pool.query(
            'SELECT * FROM knowledge_bases WHERE job_id = $1 AND user_id = $2',
            [jobId, userId]
        );
        
        if (kbResult.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Get status from Python
        const response = await fetch(`${pythonEngineUrl}/api/ingest/status/${jobId}`, {
            headers: { 'X-Service-Secret': engineSecret }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch status from engine');
        }
        
        const status = await response.json();

        // Sync to PostgreSQL if complete
        if (status.status === 'completed' && kbResult.rows[0].status === 'pending') {
            await pool.query(
                `UPDATE knowledge_bases SET status = 'success' WHERE job_id = $1`,
                [jobId]
            );
        } else if (status.status === 'failed' && kbResult.rows[0].status === 'pending') {
            await pool.query(
                `UPDATE knowledge_bases SET status = 'failed' WHERE job_id = $1`,
                [jobId]
            );
        }

        res.json(status);
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: 'Failed to check status' });
    }
};

const chatWithEngine = async (req, res) => {
    const sessionUserId = req.session.userId;
    if (!sessionUserId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { question, history } = req.body;
    
    if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Invalid question format' });
    }
    
    if (question.length > 1000) {
        return res.status(400).json({ error: 'Question too long (max 1000 chars)' });
    }

    const customerId = `user_${sessionUserId}`;
    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8000';
    const engineSecret = process.env.ENGINE_SECRET;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const engineResponse = await fetch(`${pythonEngineUrl}/api/chat`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Service-Secret': engineSecret
            },
            body: JSON.stringify({
                question: question,
                customer_id: customerId,
                history: history || []
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!engineResponse.ok) {
            const errorData = await engineResponse.json();
            throw new Error(errorData.detail || 'Engine error');
        }

        const engineData = await engineResponse.json();

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
        res.status(500).json({ 
            error: 'AI service temporarily unavailable. Please try again.' 
        });
    }
};

const deleteKnowledgeBase = async (req, res) => {
    const kbId = req.params.id;
    const userId = req.session.userId;
    const customerId = `user_${userId}`;
    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8000';
    const engineSecret = process.env.ENGINE_SECRET;

    try {
        const kbResult = await pool.query(
            'SELECT scraped_url FROM knowledge_bases WHERE id = $1 AND user_id = $2',
            [kbId, userId]
        );

        if (kbResult.rows.length === 0) {
            return res.status(404).json({ error: 'Knowledge base not found.' });
        }

        const targetUrl = kbResult.rows[0].scraped_url;

        // Send JSON body instead of query params
        const engineResponse = await fetch(`${pythonEngineUrl}/api/delete`, {
            method: 'DELETE',
            headers: { 
                'Content-Type': 'application/json',
                'X-Service-Secret': engineSecret || ''
            },
            body: JSON.stringify({
                url: targetUrl,
                customer_id: customerId
            })
        });

        if (!engineResponse.ok) {
            const errorData = await engineResponse.text();
            console.error('Python Engine Rejected Deletion:', errorData);
            throw new Error(`Engine error: ${engineResponse.status}`);
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
    getIngestStatus,
    chatWithEngine,
    deleteKnowledgeBase
};