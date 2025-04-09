import dotenv from 'dotenv';
import path from 'path';
// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'build', '.env') });
// Verificar y exportar variables de entorno requeridas
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
}
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
}
const PORT = process.env.PORT || 3000;
export { ANTHROPIC_API_KEY, OPENAI_API_KEY, PORT };
