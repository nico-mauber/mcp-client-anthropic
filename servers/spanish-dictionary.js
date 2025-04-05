import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Diccionario con palabras y sus definiciones
const dictionary = {
    "auto": "Hacia si mismo",
    "queso": "Producto lácteo obtenido a partir de la coagulación de la leche.",
    "computadora": "Máquina electrónica diseñada para el procesamiento de datos.",
    "saltar": "Acción de elevarse del suelo o impulsarse en el aire.",
    "billetara": "Objeto similar a una billetera, utilizado para guardar billetes y tarjetas.",
    "desayuno": "Primera comida del día, generalmente consumida en la mañana."
};

// Crear instancia del servidor MCP
const server = new McpServer({
    name: "diccionario",
    version: "1.1.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});

// Herramienta para buscar la palabra y mostrar su definición
server.tool("lookup-word", "Busca la palabra y muestra su definición en el diccionario", {
    word: z.string().describe("Palabra a buscar en el diccionario"),
}, async ({ word }) => {
    const normalizedWord = word.toLowerCase();
    if (normalizedWord in dictionary) {
        return {
            content: [
                {
                    type: "text",
                    text: `Palabra: ${normalizedWord}\nDefinición: ${dictionary[normalizedWord]}`,
                },
            ],
        };
    } else {
        return {
            content: [
                {
                    type: "text",
                    text: `La palabra '${normalizedWord}' no se encuentra en el diccionario.`,
                },
            ],
        };
    }
});

// Nueva herramienta para obtener únicamente la definición de una palabra
server.tool("get-definition", "Devuelve la definición de la palabra", {
    word: z.string().describe("Palabra para obtener su definición"),
}, async ({ word }) => {
    const normalizedWord = word.toLowerCase();
    if (normalizedWord in dictionary) {
        return {
            content: [
                {
                    type: "text",
                    text: dictionary[normalizedWord],
                },
            ],
        };
    } else {
        return {
            content: [
                {
                    type: "text",
                    text: `No se encontró la definición para la palabra '${normalizedWord}'.`,
                },
            ],
        };
    }
});

// Herramienta para listar todas las palabras disponibles en el diccionario
server.tool("list-words", "Lista todas las palabras disponibles en el diccionario", {}, async () => {
    const wordsList = Object.keys(dictionary).join(", ");
    return {
        content: [
            {
                type: "text",
                text: `Palabras del diccionario:\n${wordsList}`,
            },
        ],
    };
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Servidor MCP de diccionario ejecutándose en stdio");
}

main().catch((error) => {
    console.error("Error fatal en main():", error);
    process.exit(1);
});
