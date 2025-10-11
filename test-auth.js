// Simple test script to verify auth functionality
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());
app.use(cookieParser());

// Test routes
app.post('/api/auth/login', (req, res) => {
    console.log('Login attempt:', req.body);
    
    // Simple test credentials
    if (req.body.email === 'test@test.com' && req.body.password === 'test123') {
        res.cookie('token', 'test-token', {
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        res.json({
            success: true,
            data: {
                _id: '123',
                name: 'Test User',
                email: 'test@test.com',
                isEmailVerified: true
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid credentials. Use test@test.com / test123'
        });
    }
});

app.get('/api/auth/profile', (req, res) => {
    console.log('Profile request, cookies:', req.cookies);
    
    if (req.cookies.token === 'test-token') {
        res.json({
            success: true,
            data: {
                _id: '123',
                name: 'Test User',
                email: 'test@test.com',
                isEmailVerified: true
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

app.listen(5001, () => {
    console.log('Test auth server running on port 5001');
    console.log('Use credentials: test@test.com / test123');
});