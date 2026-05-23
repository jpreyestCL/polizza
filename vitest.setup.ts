import "@testing-library/jest-dom/vitest";
import { existsSync } from "node:fs";

// Carga DATABASE_URL y demás variables para los tests que tocan la base.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
