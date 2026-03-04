const pool = require('../config/db');

const createUser = async (userData) => {
    const { username, email, firstName, lastName, companyName, passwordHash } = userData;
    const result = await pool.query(
        `INSERT INTO users (username, email, first_name, last_name, company_name, password_hash) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, created_at`,
        [username, email, firstName, lastName, companyName, passwordHash]
    );
    return result.rows[0];
};

const getUserByEmailOrUsername = async (identifier) => {
    const result = await pool.query(
        `SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)`,
        [identifier]
    );
    return result.rows[0];
};

const checkExistingUser = async (email, username) => {
    const result = await pool.query(
        `SELECT email, username FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)`,
        [email, username]
    );
    return result.rows;
};

module.exports = {
    createUser,
    getUserByEmailOrUsername,
    checkExistingUser
};