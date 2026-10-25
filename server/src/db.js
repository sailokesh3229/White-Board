import mongoose from "mongoose";

// Fail fast when MongoDB is unreachable: by default Mongoose waits ~10-30 s
// before giving up, which would leave users staring at "Loading board…".
const TIMEOUT_MS = 5000;

export async function connectDB(uri) {
  mongoose.set("bufferTimeoutMS", TIMEOUT_MS);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: TIMEOUT_MS });
    console.log(`Connected to MongoDB at ${hidePassword(uri)}`);
  } catch (err) {
    console.error(`Could not connect to MongoDB at ${hidePassword(uri)}: ${err.message}`);
    console.error("Is MongoDB running, and is MONGODB_URI correct (server/.env locally, or your host's environment variables)? See README.md.");
    process.exit(1);
  }
}

// Never print database passwords (Atlas URIs contain them) to the logs.
// Greedy up to the LAST "@" before the host, so a password that itself
// contains an "@" is still fully hidden.
export function hidePassword(uri) {
  return uri.replace(/\/\/[^/?#]*@/, "//***@");
}
