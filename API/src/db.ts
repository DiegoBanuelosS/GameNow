import { config } from "./config.js";

export async function connectDb() {
  if (!config.mongoUri) {
    return false;
  }

  const mongoose = await import("mongoose");
  const connection = mongoose.default?.connection ?? mongoose.connection;
  if (connection.readyState === 1) {
    return true;
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

