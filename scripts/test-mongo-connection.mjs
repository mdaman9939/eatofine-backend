// Standalone connection tester for MongoDB Atlas (verbose).

import { MongoClient } from 'mongodb';

const url =
  process.env.MONGO_URL ??
  'mongodb://aman_admin:Aman%40123456@' +
    'ac-wwhajfd-shard-00-00.5kgahgx.mongodb.net:27017,' +
    'ac-wwhajfd-shard-00-01.5kgahgx.mongodb.net:27017,' +
    'ac-wwhajfd-shard-00-02.5kgahgx.mongodb.net:27017/eatofine' +
    '?ssl=true&replicaSet=atlas-wwhajfd-shard-0&authSource=admin' +
    '&retryWrites=true&w=majority';

const client = new MongoClient(url, {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
});

client.on('serverHeartbeatFailed', (e) =>
  console.error(`heartbeat fail ${e.connectionId}: ${e.failure?.message ?? e.failure}`),
);
client.on('serverDescriptionChanged', (e) =>
  console.log(`server ${e.address}: ${e.previousDescription.type} → ${e.newDescription.type}`),
);

(async () => {
  try {
    console.log('Connecting (30s timeout) …');
    await client.connect();
    console.log('Connected.');
    const db = client.db('eatofine');
    const ping = await db.command({ ping: 1 });
    console.log('Ping:', ping);
    const collections = await db.listCollections().toArray();
    console.log(`Collections (${collections.length}):`, collections.map((c) => c.name));
  } catch (err) {
    console.error('FAIL:', err.message);
    if (err.cause) console.error('Cause:', err.cause.message ?? err.cause);
    process.exit(1);
  } finally {
    await client.close();
  }
})();
