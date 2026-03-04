const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');

const registerUser = async (req, res) => {
    const { username, email, firstName, lastName, companyName, password } = req.body;

    try {
        const existingUsers = await userModel.checkExistingUser(email, username);
        if (existingUsers.length > 0) {
            const isEmailTaken = existingUsers.some(u => u.email.toLowerCase() === email.toLowerCase());
            const isUsernameTaken = existingUsers.some(u => u.username.toLowerCase() === username.toLowerCase());
            
            if (isEmailTaken) return res.status(400).json({ error: 'This email is already registered.' });
            if (isUsernameTaken) return res.status(400).json({ error: 'This username is already taken.' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const newUser = await userModel.createUser({
            username, email, firstName, lastName, companyName, passwordHash
        });

        req.session.userId = newUser.id;
        req.session.username = newUser.username;

        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Internal server error during registration.' });
    }
};

const loginUser = async (req, res) => {
    const { identifier, password } = req.body;

    try {
        const user = await userModel.getUserByEmailOrUsername(identifier);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username/email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username/email or password.' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;

        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error during login.' });
    }
};

const logoutUser = (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Could not log out.' });
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout successful' });
    });
};

module.exports = { registerUser, loginUser, logoutUser };