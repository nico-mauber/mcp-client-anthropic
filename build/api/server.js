import express from 'express';
import cors from 'cors';
import { createApiRouter } from './routes.js';
import { PORT } from '../config/environment.js';
export class ApiServer {
    app = express();
    server;
    queryProcessor;
    constructor(queryProcessor) {
        this.queryProcessor = queryProcessor;
    }
    /**
     * Configura y arranca el servidor Express
     */
    start() {
        return new Promise((resolve) => {
            // Configuración del servidor
            this.app.use(cors());
            this.app.use(express.json());
            // Configuración de rutas
            this.app.use('/api', createApiRouter(this.queryProcessor));
            // Ruta de estado
            this.app.get('/', (req, res) => {
                res.send('Servidor Aggregator API está corriendo!');
            });
            // Iniciar el servidor
            this.server = this.app.listen(PORT, () => {
                console.log(`🚀 Servidor Express escuchando en http://localhost:${PORT}`);
                console.log(`   Endpoint disponible en POST http://localhost:${PORT}/api/query`);
                resolve();
            });
        });
    }
    /**
     * Configura los manejadores para señales del sistema
     * @param cleanupCallback Función a ejecutar al cerrar el servidor
     */
    setupShutdownHandlers(cleanupCallback) {
        const shutdown = async (signal) => {
            console.log(`\nRecibida señal ${signal}. Cerrando conexiones...`);
            this.server.close(async () => {
                console.log('Servidor HTTP cerrado.');
                try {
                    await cleanupCallback();
                    console.log('Conexiones MCP cerradas limpiamente.');
                    process.exit(0);
                }
                catch (cleanupError) {
                    console.error('Error durante la limpieza de MCP:', cleanupError);
                    process.exit(1);
                }
            });
            // Temporizador de seguridad para forzar el cierre en caso de bloqueo
            setTimeout(() => {
                console.error('No se pudo cerrar limpiamente, forzando cierre.');
                process.exit(1);
            }, 10000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
}
