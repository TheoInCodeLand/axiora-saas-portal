const pool = require('../config/db');

const renderDashboard = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM knowledge_bases WHERE user_id = $1 ORDER BY created_at DESC',
            [req.session.userId]
        );
        
        const knowledgeBases = result.rows;
        
        res.render('dashboard', {
            username: req.session.username,
            userId: req.session.userId,
            knowledgeBases: knowledgeBases
        });
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = {
    renderDashboard
};