import { Application } from "./services/app.js";

/**
 * Función principal que inicia la aplicación
 */
async function main() {
  const app = new Application();
  await app.start();
}

// Iniciamos la aplicación
main().catch(error => {
  console.error("Error fatal en la aplicación:", error);
  process.exit(1);
});
