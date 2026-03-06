require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const path = require('path');

const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
}));

// --- ROUTES ---
app.get('/', (req, res) => {
    res.render('index');
});

app.use('/auth', require('./routes/authRoutes'));
app.use('/engine', require('./routes/engineRoutes'));
app.use('/dashboard', require('./routes/dashboardRoutes'));

app.post('/webhook/ingest', express.raw({type: 'application/json'}), async (req, res) => {
    const { job_id, customer_id, status, data } = JSON.parse(req.body);
    await pool.query(
        `UPDATE knowledge_bases SET status = $1, updated_at = NOW() 
         WHERE pinecone_namespace = $2 AND status = 'pending'`,
        [status === 'completed' ? 'success' : 'failed', customer_id]
    );
    
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`SaaS Portal running on http://localhost:${PORT}`);
});