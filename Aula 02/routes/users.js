const express = require('express');
const User = require('../models/User');
const database = require('../database/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 🔒 Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// 📋 ROTA 1: Listar todos os usuários
router.get('/', async (req, res) => {
    try {
        // 🔍 Query simples - users não têm completed/priority
        const rows = await database.all(
            'SELECT id, email, username, firstName, lastName, createdAt FROM users ORDER BY createdAt DESC'
        );

        res.json({
            success: true,
            message: 'Usuários listados com sucesso',
            data: rows
        });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// 👤 ROTA 2: Buscar usuário específico por ID
router.get('/:id', async (req, res) => {
    try {
        const row = await database.get(
            'SELECT id, email, username, firstName, lastName, createdAt FROM users WHERE id = ?',
            [req.params.id]
        );

        if (!row) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        res.json({
            success: true,
            data: row
        });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// ✏️ ROTA 3: Atualizar perfil do usuário
router.put('/:id', async (req, res) => {
    try {
        // 🔐 Verificar se o usuário está atualizando seu próprio perfil
        if (req.params.id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Você só pode atualizar seu próprio perfil'
            });
        }

        // 📝 Campos válidos para usuário (não completed/priority!)
        const { firstName, lastName, email } = req.body;
        
        // ✅ Validação básica
        if (!firstName || !lastName || !email) {
            return res.status(400).json({
                success: false,
                message: 'firstName, lastName e email são obrigatórios'
            });
        }

        const result = await database.run(
            'UPDATE users SET firstName = ?, lastName = ?, email = ? WHERE id = ?',
            [firstName, lastName, email, req.params.id]
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        // 🔄 Buscar dados atualizados
        const updatedRow = await database.get(
            'SELECT id, email, username, firstName, lastName, createdAt FROM users WHERE id = ?',
            [req.params.id]
        );

        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso',
            data: updatedRow
        });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// 🗑️ ROTA 4: Deletar usuário
router.delete('/:id', async (req, res) => {
    try {
        // 🔐 Verificar se o usuário está deletando seu próprio perfil
        if (req.params.id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Você só pode deletar seu próprio perfil'
            });
        }

        const result = await database.run(
            'DELETE FROM users WHERE id = ?',
            [req.params.id]
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Usuário deletado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

module.exports = router;