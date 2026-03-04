const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }
};

module.exports = {
    requireAuth
};