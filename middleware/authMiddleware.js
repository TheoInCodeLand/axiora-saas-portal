const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }
};

const serviceAuth = (req, res, next) => {
    const secret = req.headers['x-service-secret'];
    if (secret !== process.env.ENGINE_SECRET) {
        return res.status(403).json({ error: 'Invalid service authentication' });
    }
    next();
};

module.exports = {
    requireAuth,
    serviceAuth
};