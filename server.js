const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'movie_tracker'
};

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// JWT middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Routes

// Authentication routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const connection = await mysql.createConnection(dbConfig);
        
        // Check if user exists
        const [existing] = await connection.execute(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const [result] = await connection.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );
        
        const token = jwt.sign(
            { userId: result.insertId, username },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );
        
        await connection.end();
        
        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: result.insertId, username, email }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const connection = await mysql.createConnection(dbConfig);
        
        const [users] = await connection.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );
        
        await connection.end();
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar_url: user.avatar_url,
                theme_preference: user.theme_preference
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// User routes
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        const [users] = await connection.execute(
            'SELECT id, username, email, avatar_url, description, role, theme_preference FROM users WHERE id = ?',
            [req.user.userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        await connection.end();
        res.json(users[0]);
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { username, description, theme_preference } = req.body;
        const connection = await mysql.createConnection(dbConfig);
        
        await connection.execute(
            'UPDATE users SET username = ?, description = ?, theme_preference = ? WHERE id = ?',
            [username, description, theme_preference, req.user.userId]
        );
        
        await connection.end();
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Movies routes
app.get('/api/movies/search', async (req, res) => {
    try {
        const { query, type, genre, year } = req.query;
        const connection = await mysql.createConnection(dbConfig);
        
        let sql = 'SELECT * FROM movies WHERE 1=1';
        const params = [];
        
        if (query) {
            sql += ' AND title LIKE ?';
            params.push(`%${query}%`);
        }
        
        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }
        
        if (genre) {
            sql += ' AND genre LIKE ?';
            params.push(`%${genre}%`);
        }
        
        if (year) {
            sql += ' AND YEAR(release_date) = ?';
            params.push(year);
        }
        
        sql += ' ORDER BY title LIMIT 50';
        
        const [movies] = await connection.execute(sql, params);
        await connection.end();
        
        res.json(movies);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/movies', authenticateToken, async (req, res) => {
    try {
        const { title, type, genre, release_date, description, poster_url, trailer_url } = req.body;
        const connection = await mysql.createConnection(dbConfig);
        
        const [result] = await connection.execute(
            'INSERT INTO movies (title, type, genre, release_date, description, poster_url
