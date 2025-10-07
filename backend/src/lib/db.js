import mongoose from "mongoose";
let cachedDb = null;
export const connectDB = async () => {
  if (cachedDb) {
    return cachedDb;
  }
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.log("Failed to connect to MongoDB", error);
    process.exit(1);
  }
}