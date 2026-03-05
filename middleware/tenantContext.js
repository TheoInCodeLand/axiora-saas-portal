// middleware/tenantContext.js
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect();

const resolveTenantContext = async (req, res, next) => {
    try {
        // Support multiple token sources
        const token = req.headers.authorization?.replace('Bearer ', '') 
                   || req.cookies.session_token
                   || req.query.widget_token;
        
        if (!token) throw new Error('No authentication token');
        
        // Verify and decode
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check token revocation (logout, password change, etc.)
        const isRevoked = await redis.get(`revoke:${decoded.jti}`);
        if (isRevoked) throw new Error('Token revoked');
        
        // Enrich with tenant configuration
        const tenantConfig = await redis.get(`tenant:${decoded.tenant_id}:config`);
        
        req.tenant = {
            id: decoded.tenant_id,
            userId: decoded.sub,
            role: decoded.role,
            plan: decoded.plan || 'free',
            features: JSON.parse(tenantConfig || '{}'),
            // Critical: All downstream calls include this context
            namespace: `tenant_${decoded.tenant_id}`,
            rateLimit: decoded.plan === 'enterprise' ? 1000 : 100
        };
        
        next();
    } catch (error) {
        res.status(401).json({ 
            error: 'Unauthorized',
            code: 'INVALID_TENANT_CONTEXT'
        });
    }
};

module.exports = { resolveTenantContext };