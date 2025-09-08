const express = require('express');
const cluster = require('cluster');
const os = require('os');
const jwtInterceptor = require('./jwtInterceptor');

if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    console.log(`Master process running. Forking ${numCPUs} workers...`);
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Forking a new one.`);
        cluster.fork();
    });
} else {
    const app = express();

    // Use interceptor for protected routes
    app.use('/api/protected', jwtInterceptor);

    // Example protected route
    app.get('/api/protected/data', (req, res) => {
        res.json({ message: 'This is protected data', user: req.user });
    });

    // Global error handling middleware
    app.use((err, req, res, next) => {
        console.error(err);
        res.status(err.status || 500).json({
            error: {
                message: err.message || 'Internal Server Error'
            }
        });
    });

    // Inicie o servidor em cada worker
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} listening on port ${PORT}`);
    });
}

module.exports = app;