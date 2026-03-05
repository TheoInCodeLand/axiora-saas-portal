const crypto = require('crypto');
const pool = require('../config/db');

// 🔒 SECURITY: Validate secret exists
const WIDGET_SECRET = process.env.WIDGET_SECRET;
const ENGINE_SECRET = process.env.ENGINE_SECRET;

if (!WIDGET_SECRET) {
    console.error('❌ CRITICAL: WIDGET_SECRET not set in environment');
    console.error('   Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('   Then add to .env file');
    // Don't crash, but tokens won't work
}

if (!ENGINE_SECRET) {
    console.warn('⚠️  WARNING: ENGINE_SECRET not set. Service-to-service auth disabled.');
}

// Generate signed widget token
const generateWidgetToken = (userId) => {
    if (!WIDGET_SECRET) {
        throw new Error('WIDGET_SECRET not configured');
    }
    
    if (!userId || !/^\d+$/.test(userId)) {
        throw new Error('Invalid userId for token generation');
    }
    
    const timestamp = Date.now();
    const data = `${userId}:${timestamp}`;
    const signature = crypto
        .createHmac('sha256', WIDGET_SECRET)
        .update(data)
        .digest('hex');
    
    return `${signature}:${timestamp}`;
};

// Verify widget token
const verifyWidgetToken = (token, userId) => {
    if (!WIDGET_SECRET || !token || !userId) {
        return false;
    }
    
    try {
        const [signature, timestamp] = token.split(':');
        if (!signature || !timestamp) return false;
        
        const time = parseInt(timestamp);
        if (isNaN(time)) return false;
        
        // Check expiry (1 hour = 3600000ms)
        if (Date.now() - time > 3600000) {
            console.log('Token expired');
            return false;
        }
        
        // Verify signature
        const expected = crypto
            .createHmac('sha256', WIDGET_SECRET)
            .update(`${userId}:${timestamp}`)
            .digest('hex');
        
        // Timing-safe comparison (prevents timing attacks)
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expected, 'hex')
        );
    } catch (e) {
        console.error('Token verification error:', e.message);
        return false;
    }
};

// HTML escape helper
const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Render dashboard
const renderDashboard = async (req, res) => {
    try {
        // Validate session
        if (!req.session?.userId) {
            return res.status(401).redirect('/auth/login');
        }

        const result = await pool.query(
            'SELECT * FROM knowledge_bases WHERE user_id = $1 ORDER BY created_at DESC',
            [req.session.userId]
        );
        
        // Generate token (with error handling)
        let widgetToken;
        try {
            widgetToken = generateWidgetToken(req.session.userId);
        } catch (tokenError) {
            console.error('Token generation failed:', tokenError.message);
            widgetToken = 'ERROR: ' + tokenError.message;
        }
        
        res.render('dashboard', {
            username: escapeHtml(req.session.username || 'User'),
            userId: req.session.userId,
            widgetToken: widgetToken,
            domain: process.env.DOMAIN || 'localhost:3000',
            escapeHtml: escapeHtml,
            knowledgeBases: result.rows.map(kb => ({
                id: kb.id,
                scraped_url: escapeHtml(kb.scraped_url || ''),
                status: kb.status,
                created_at: kb.created_at,
                pinecone_namespace: kb.pinecone_namespace
            }))
        });
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).render('error', { 
            message: 'Failed to load dashboard. Please try again.' 
        });
    }
};

// Regenerate token
const regenerateToken = async (req, res) => {
    if (!req.session?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const newToken = generateWidgetToken(req.session.userId);
        res.json({ 
            success: true,
            token: newToken,
            expires_in: 3600  // seconds
        });
    } catch (error) {
        console.error('Token regeneration failed:', error.message);
        res.status(500).json({ 
            error: 'Token generation failed. Check server configuration.' 
        });
    }
};

module.exports = {
    renderDashboard,
    regenerateToken,
    verifyWidgetToken  // Export for middleware
};