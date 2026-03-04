const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('===> Error acquiring client from Neon database', err.stack);
    } else {
        console.log('===> Successfully connected to Neon PostgreSQL Serverless');
    }
    if (client) release();
});

module.exports = pool;