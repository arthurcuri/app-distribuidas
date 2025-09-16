const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');
const bodyParser = require('body-parser');
const cors = require('cors');

const PORT = 3002;
const SERVICE_NAME = 'list-service';
const DB_DIR = './database';
const COLLECTION = 'lists';

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Banco de dados
const db = new JsonDatabase(DB_DIR, COLLECTION);

// Middleware de autenticação JWT
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET || 'segredo', (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
}

// Registro no Service Registry
serviceRegistry.register(SERVICE_NAME, 'localhost', PORT);

// Endpoints CRUD de listas
app.post('/lists', authenticateJWT, async (req, res) => {
    try {
        const { name, description } = req.body;
        const userId = req.user.id;
        const newList = {
            userId,
            name,
            description,
            status: 'active',
            items: [],
            summary: {
                totalItems: 0,
                purchasedItems: 0,
                estimatedTotal: 0
            }
        };
        const created = await db.create(newList);
        res.status(201).json(created);
    } catch (error) {
        console.error('Erro ao criar lista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.get('/lists', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const lists = await db.find({ userId });
        res.json(lists);
    } catch (error) {
        console.error('Erro ao buscar listas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.get('/lists/:id', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const list = await db.findById(req.params.id);
        if (!list || list.userId !== userId) {
            return res.sendStatus(404);
        }
        res.json(list);
    } catch (error) {
        console.error('Erro ao buscar lista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/lists/:id', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const list = await db.findById(req.params.id);
        if (!list || list.userId !== userId) {
            return res.sendStatus(404);
        }
        const updates = {
            name: req.body.name || list.name,
            description: req.body.description || list.description
        };
        const updated = await db.update(list.id, updates);
        res.json(updated);
    } catch (error) {
        console.error('Erro ao atualizar lista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.delete('/lists/:id', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const list = await db.findById(req.params.id);
        if (!list || list.userId !== userId) {
            return res.sendStatus(404);
        }
        await db.delete(list.id);
        res.sendStatus(204);
    } catch (error) {
        console.error('Erro ao deletar lista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Adicionar item à lista
app.post('/lists/:id/items', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const list = await db.findById(req.params.id);
        if (!list || list.userId !== userId) {
            return res.sendStatus(404);
        }
        
        const { itemId, itemName, quantity, unit, estimatedPrice, notes } = req.body;
        const item = {
            itemId,
            itemName,
            quantity,
            unit,
            estimatedPrice,
            purchased: false,
            notes: notes || '',
            addedAt: new Date().toISOString()
        };
        
        list.items.push(item);
        list.summary.totalItems = list.items.length;
        list.summary.estimatedTotal = list.items.reduce((sum, i) => sum + (i.estimatedPrice || 0), 0);
        
        await db.update(list.id, list);
        res.status(201).json(item);
    } catch (error) {
        console.error('Erro ao adicionar item à lista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Atualizar item na lista
app.put('/lists/:id/items/:itemId', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const list = await db.findById(req.params.id);
        if (!list || list.userId !== userId) {
            return res.sendStatus(404);
        }
        
        const item = list.items.find(i => i.itemId === req.params.itemId);
        if (!item) {
            return res.sendStatus(404);
        }
        
        Object.assign(item, req.body);
        list.summary.purchasedItems = list.items.filter(i => i.purchased).length;
        list.summary.estimatedTotal = list.items.reduce((sum, i) => sum + (i.estimatedPrice || 0), 0);
        
        await db.update(list.id, list);
        res.json(item);
    } catch (error) {
        console.error('Erro ao atualizar item na lista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Remover item da lista
app.delete('/lists/:id/items/:itemId', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const list = await db.findById(req.params.id);
        if (!list || list.userId !== userId) {
            return res.sendStatus(404);
        }
        
        list.items = list.items.filter(i => i.itemId !== req.params.itemId);
        list.summary.totalItems = list.items.length;
        list.summary.purchasedItems = list.items.filter(i => i.purchased).length;
        list.summary.estimatedTotal = list.items.reduce((sum, i) => sum + (i.estimatedPrice || 0), 0);
        
        await db.update(list.id, list);
        res.sendStatus(204);
    } catch (error) {
        console.error('Erro ao remover item da lista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Resumo da lista
app.get('/lists/:id/summary', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const list = await db.findById(req.params.id);
        if (!list || list.userId !== userId) {
            return res.sendStatus(404);
        }
        res.json(list.summary);
    } catch (error) {
        console.error('Erro ao buscar resumo da lista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: SERVICE_NAME });
});

app.listen(PORT, () => {
    console.log(`${SERVICE_NAME} running on port ${PORT}`);
});