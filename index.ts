import express, { Request, Response, RequestHandler } from 'express'; // Añade RequestHandler
import dotenv from 'dotenv';
import path from 'path';
import { AggregatorClient } from './aggregator.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'build', '.env') });


async function startServer() {
  const weatherServerPath = path.resolve("servers/weather.js");
  const dictionaryServerPath = path.resolve("servers/spanish-dictionary.js");
  const aggregator = new AggregatorClient();

  try {
    console.log("Iniciando servidores MCP (Weather y Dictionary)...");
    await aggregator.startAllServers(weatherServerPath, dictionaryServerPath);
    console.log("Servidores MCP iniciados correctamente.");

    const app = express();
    const PORT = process.env.PORT || 3000;
    app.use(express.json());

    // --- Define el handler con tipo explícito ---
    const queryHandler  : RequestHandler = async (req: Request, res: Response) => {
      try {
        const userQuery = req.body.query;

        if (!userQuery || typeof userQuery !== 'string' || userQuery.trim() === '') {
          console.log("Petición recibida sin query válida.");
          // Usar 'return' aquí para asegurar que no se ejecute más código después de enviar la respuesta
          return res.status(400).json({ error: 'Se requiere un campo "query" (string) en el cuerpo de la petición.' });
        }

        console.log(`Recibida query: "${userQuery}"`);
        const responseText = await aggregator.processQuery(userQuery);
        console.log(`Respuesta generada: "${responseText}"`);

        // Enviar respuesta exitosa
        res.status(200).json({ response: responseText });

      } catch (error: any) {
        console.error("Error procesando la query:", error);
        // Asegurarse de no enviar otra respuesta si ya se envió una (aunque en este flujo es improbable)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error interno del servidor al procesar la consulta.', details: error.message });
        }
      }
    };

    // --- Usa el handler tipado ---
    app.post('/api/query', queryHandler as RequestHandler); // Ahora pasas la variable que contiene la función tipada

    app.get('/', (req: Request, res: Response) => { // También puedes tipar este handler si quieres ser consistente
      res.send('Servidor Aggregator API está corriendo!');
    });

    const server = app.listen(PORT, () => {
      console.log(`🚀 Servidor Express escuchando en http://localhost:${PORT}`);
      console.log(`   Endpoint disponible en POST http://localhost:${PORT}/api/query`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\nRecibida señal ${signal}. Cerrando conexiones...`);
      server.close(async () => {
        console.log('Servidor HTTP cerrado.');
        try {
          await aggregator.cleanup();
          console.log('Conexiones MCP cerradas limpiamente.');
          process.exit(0);
        } catch (cleanupError) {
          console.error('Error durante la limpieza de MCP:', cleanupError);
          process.exit(1);
        }
      });
      setTimeout(() => {
        console.error('No se pudo cerrar limpiamente, forzando cierre.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error("Error crítico durante la inicialización:", err);
    if (aggregator) {
        try { await aggregator.cleanup(); } catch (cleanupErr) { /* Ignora error secundario */ }
    }
    process.exit(1);
  }
}

startServer();