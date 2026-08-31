import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDb() {
  if (!config.mongoUri) {
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  await mongoose.connect(config.mongoUri, {
    dbName: config.mongoDb,
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30_000,
    waitQueueTimeoutMS: 5_000,
    serverSelectionTimeoutMS: 5_000,
  });
  return true;
}
