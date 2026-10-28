const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let MongoMemoryServer = null;
try {
  MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
} catch (_) {
  // Optional in production when real MongoDB or Docker container is used
}

let isConnectedToMongo = false;
let dbMode = 'disconnected'; // 'atlas' | 'local_mongo' | 'embedded'
let mongoServerInstance = null;
let activeUri = '';

const connectDB = async () => {
  let rawUri = process.env.MONGO_URI || '';
  const cleanUri = rawUri.trim().replace(/^["']|["']$/g, '');

  // 1. Attempt connection to provided URI (e.g. Atlas, Docker container, or existing mongod)
  if (cleanUri) {
    try {
      const maskedUri = cleanUri.replace(/(mongodb(\+srv)?:\/\/)([^:]+):([^@]+)@/, '$1$3:***@');
      console.log(`[DB] Attempting connection to MongoDB: ${maskedUri}...`);
      
      await mongoose.connect(cleanUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        dbName: 'gov_rag_mern'
      });

      isConnectedToMongo = true;
      dbMode = cleanUri.includes('mongodb+srv') ? 'atlas' : 'local_mongo';
      activeUri = cleanUri;
      console.log(`✅ [DB] Successfully connected to MongoDB (${dbMode})!`);
      return { mode: dbMode, isConnected: true, uri: activeUri };
    } catch (uriErr) {
      console.warn(`⚠️ [DB] Provided MONGO_URI unreachable (${uriErr.message}).`);
    }
  }

  // 2. Start a Local Persistent MongoDB Server on port 27017 for Compass & Data Retention if memory server available
  if (MongoMemoryServer) {
    try {
      const dbStorageDir = path.resolve(__dirname, '../../../data/mongodb_data');
      if (!fs.existsSync(dbStorageDir)) {
        fs.mkdirSync(dbStorageDir, { recursive: true });
      }
      console.log(`🚀 [DB] Starting persistent local MongoDB on port 27017 (storage: ${dbStorageDir})...`);
      
      try {
        mongoServerInstance = await MongoMemoryServer.create({
          instance: {
            port: 27017,
            dbName: 'gov_rag_mern',
            dbPath: dbStorageDir,
            storageEngine: 'wiredTiger'
          }
        });
        activeUri = mongoServerInstance.getUri();
        console.log(`💾 [DB] Data persistence active via WiredTiger at ${dbStorageDir}`);
      } catch (instErr) {
        console.log(`ℹ️ [DB] Port 27017 already active (${instErr.message}), connecting to existing local daemon...`);
        activeUri = 'mongodb://127.0.0.1:27017/gov_rag_mern';
      }

      console.log(`[DB] Connecting Mongoose to local MongoDB: ${activeUri}...`);
      await mongoose.connect(activeUri, {
        serverSelectionTimeoutMS: 5000,
        dbName: 'gov_rag_mern'
      });

      isConnectedToMongo = true;
      dbMode = 'local_mongo';

      console.log('================================================================');
      console.log('✅ [DB] Real MongoDB Server is ONLINE & READY FOR COMPASS!');
      console.log(`👉 [COMPASS CONNECTION STRING]: mongodb://127.0.0.1:27017`);
      console.log('👉 [DATABASE NAME]: gov_rag_mern');
      console.log('================================================================');

      return { mode: 'local_mongo', isConnected: true, uri: 'mongodb://127.0.0.1:27017/gov_rag_mern' };
    } catch (localErr) {
      console.warn(`⚠️ [DB] Could not launch port 27017 server: ${localErr.message}`);
    }
  }

  // 3. Resilient Local File Store Fallback
  console.log('🚀 [DB] Activating resilient local JSON persistence fallback.');
  isConnectedToMongo = false;
  dbMode = 'embedded';
  activeUri = 'local_file_store';

  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return { mode: 'embedded', isConnected: false, uri: activeUri };
};

const getDBStatus = () => {
  return {
    mode: dbMode,
    isConnected: isConnectedToMongo,
    uri: dbMode === 'local_mongo' ? 'mongodb://127.0.0.1:27017/gov_rag_mern' : activeUri.replace(/(mongodb(\+srv)?:\/\/)([^:]+):([^@]+)@/, '$1$3:***@'),
    engine: isConnectedToMongo ? 'MongoDB Native Driver (Mongoose)' : 'Resilient Local Datastore',
    compassInstructions: 'Connect in Compass via: mongodb://127.0.0.1:27017'
  };
};

module.exports = {
  connectDB,
  getDBStatus,
  isMongoActive: () => isConnectedToMongo
};
