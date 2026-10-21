import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createHostedApp } from "./hosted-app.js";

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`HOSTED_ENV_REQUIRED_${name}`);
  return value;
}

const mode = process.env.NODE_ENV === "production" ? "production" : "development";
const appOrigin =
  mode === "production"
    ? requiredEnvironmentVariable("APP_ORIGIN")
    : (process.env.APP_ORIGIN ?? "http://127.0.0.1:3000");
const dataDir =
  mode === "production"
    ? join(requiredEnvironmentVariable("RAILWAY_VOLUME_MOUNT_PATH"), "your-move")
    : (process.env.HOSTED_DATA_DIR ?? resolve(".your-move/hosted-provider-data"));
const hostedDirectory = dirname(fileURLToPath(import.meta.url));
const app = createHostedApp({
  mode,
  appOrigin,
  accessPassword: requiredEnvironmentVariable("APP_ACCESS_PASSWORD"),
  sessionSigningKey: requiredEnvironmentVariable("SESSION_SIGNING_KEY"),
  credentialEncryptionKey: requiredEnvironmentVariable("CREDENTIAL_ENCRYPTION_KEY"),
  dataDir,
  staticRoot: resolve(hostedDirectory, "../../web/dist"),
  staticEntryFile: "hosted.html",
});

const port = Number(process.env.PORT ?? "3000");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("HOSTED_PORT_INVALID");
}

try {
  const address = await app.listen({ host: "0.0.0.0", port });
  console.info(`Hosted server listening at ${address}`);
} catch (error) {
  await app.close();
  throw error;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().catch(() => {
      process.exitCode = 1;
    });
  });
}
