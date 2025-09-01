const express = require('express');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const database = require('../database/database');
const { validate } = require('../middleware/validation');
const logger = require('../middleware/logger');

const router = express.Router();

// Registrar usuário
router.post('/register', validate('register'), async (req, res) => {
    try {
        const { email, username, password, firstName, lastName } = req.body;
        
        logger.info('User registration attempt', {
            requestId: req.requestId,
            email,
            username,
            ip: req.ip
        });

        // Verificar se usuário já existe
        const existingUser = await database.get(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existingUser) {
            logger.securityLog('Registration failed - user exists', {
                requestId: req.requestId,
                email,
                username,
                ip: req.ip
            });
            
            return res.status(409).json({
                success: false,
                message: 'Email ou username já existe'
            });
        }

        // Criar usuário
        const userData = { id: uuidv4(), email, username, password, firstName, lastName };
        const user = new User(userData);
        await user.hashPassword();

        await database.run(
            'INSERT INTO users (id, email, username, password, firstName, lastName) VALUES (?, ?, ?, ?, ?, ?)',
            [user.id, user.email, user.username, user.password, user.firstName, user.lastName]
        );

        const token = user.generateToken();
        
        logger.info('User registered successfully', {
            requestId: req.requestId,
            userId: user.id,
            email,
            username
        });

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            data: { user: user.toJSON(), token }
        });
    } catch (error) {
        logger.error('Registration error', {
            requestId: req.requestId,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Login
router.post('/login', validate('login'), async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        logger.info('Login attempt', {
            requestId: req.requestId,
            identifier,
            ip: req.ip
        });

        const userData = await database.get(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [identifier, identifier]
        );

        if (!userData) {
            logger.securityLog('Login failed - user not found', {
                requestId: req.requestId,
                identifier,
                ip: req.ip
            });
            
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        const user = new User(userData);
        const isValidPassword = await user.comparePassword(password);

        if (!isValidPassword) {
            logger.securityLog('Login failed - invalid password', {
                requestId: req.requestId,
                identifier,
                userId: user.id,
                ip: req.ip
            });
            
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        const token = user.generateToken();
        
        logger.info('Login successful', {
            requestId: req.requestId,
            userId: user.id,
            username: user.username
        });

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            data: { user: user.toJSON(), token }
        });
    } catch (error) {
        logger.error('Login error', {
            requestId: req.requestId,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

module.exports = router;