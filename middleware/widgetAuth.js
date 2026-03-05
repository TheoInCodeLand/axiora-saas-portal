// middleware/widgetAuth.js
const { verifyWidgetToken } = require('../controllers/dashboardController');

const widgetAuth = (req, res, next) => {
    const token = req.headers['x-widget-token'] || req.query.token;
    const userId = req.headers['x-widget-user'] || req.query.userId;
    
    if (!token || !userId) {
        return res.status(401).json({ error: 'Widget authentication required' });
    }
    
    if (!verifyWidgetToken(token, userId)) {
        return res.status(403).json({ error: 'Invalid or expired widget token' });
    }
    
    // Attach verified userId to request
    req.widgetUserId = userId;
    next();
};

module.exports = { widgetAuth };