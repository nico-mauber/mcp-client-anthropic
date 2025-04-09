import { Router } from 'express';
export function createApiRouter(queryProcessor) {
    const router = Router();
    // Handler para procesar consultas
    const queryHandler = async (req, res) => {
        try {
            const userQuery = req.body.query;
            if (!userQuery || typeof userQuery !== 'string' || userQuery.trim() === '') {
                console.log("Petición recibida sin query válida.");
                return res.status(400).json({
                    error: 'Se requiere un campo "query" (string) en el cuerpo de la petición.'
                });
            }
            console.log(`Recibida query: "${userQuery}"`);
            const responseText = await queryProcessor.processQuery(userQuery);
            console.log(`Respuesta generada: "${responseText}"`);
            // Enviar respuesta exitosa
            res.status(200).json({ response: responseText });
        }
        catch (error) {
            console.error("Error procesando la query:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Error interno del servidor al procesar la consulta.',
                    details: error.message
                });
            }
        }
    };
    // Rutas
    router.post('/query', queryHandler);
    return router;
}
