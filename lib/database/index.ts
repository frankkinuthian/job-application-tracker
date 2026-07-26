import mongoose from "mongoose";
import { tryCatch, type Result } from "../helpers/tryCatch";

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function connectDB(): Promise<Result<typeof mongoose, Error>> {
  if (!MONGODB_URI) {
    return {
      data: null,
      error: new Error(
        "Please define the MONGODB_URI environment variable inside .env",
      ),
    };
  }

  if (cached.conn) {
    return { data: cached.conn, error: null };
  }

  if (!cached.promise) {
    const opts = { bufferCommands: false };
    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  // tryCatch replaces manual try/catch
  const result = await tryCatch(cached.promise);

  if (result.error) {
    cached.promise = null; 
    return result;
  }

  cached.conn = result.data;
  return { data: cached.conn, error: null };
}

export default connectDB;
