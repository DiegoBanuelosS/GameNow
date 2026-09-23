import dns from "node:dns";
import { config } from "./config.js";

// Resolver con servidores DNS públicos confiables para evitar fallos de resolución SRV en Windows/redes locales
if (config.mongoUri.startsWith("mongodb+srv://")) {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  } catch (_) {}
}

export async function connectDb() {
  if (!config.mongoUri) {
    return false;
  }

  const mongoose = await import("mongoose");
  const connection = mongoose.default?.connection ?? mongoose.connection;
  if (connection.readyState === 1) {
    return true;
  }

  if (config.mongoUri.startsWith("mongodb+srv://")) {
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
    } catch (_) {}
  }

  const connect = mongoose.default?.connect ?? mongoose.connect;
  await connect(config.mongoUri, {
    dbName: config.mongoDb,
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30_000,
    waitQueueTimeoutMS: 5_000,
    serverSelectionTimeoutMS: 5_000,
  });
  return true;
}

