import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Build the MongoDB connection URI from individual env vars so we can:
//   (1) keep the literal password in .env (no double-encoding headaches)
//   (2) gracefully encode special chars at runtime
//   (3) work with or without DNS SRV records (we use the standard form
//       that lists every replica member explicitly)
function buildMongoUri(): string {
  const user = process.env.MONGO_USER;
  const password = process.env.MONGO_PASSWORD;
  const database = process.env.MONGO_DATABASE ?? 'eatofine';
  const hosts = process.env.MONGO_HOSTS;
  const replicaSet = process.env.MONGO_REPLICA_SET;
  const authSource = process.env.MONGO_AUTH_SOURCE ?? 'admin';

  if (!user || !password || !hosts) {
    throw new Error(
      'MongoDB env vars missing: MONGO_USER, MONGO_PASSWORD, MONGO_HOSTS are required.',
    );
  }

  const encUser = encodeURIComponent(user);
  const encPassword = encodeURIComponent(password);

  const params = new URLSearchParams({
    ssl: 'true',
    authSource,
    retryWrites: 'true',
    w: 'majority',
  });
  if (replicaSet) params.set('replicaSet', replicaSet);

  return `mongodb://${encUser}:${encPassword}@${hosts}/${database}?${params.toString()}`;
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: buildMongoUri(),
        serverSelectionTimeoutMS: 15000,
        connectionFactory: (connection) => {
          connection.on('connected', () =>
            console.log('[mongo] Connected to Atlas: %s', connection.name),
          );
          connection.on('disconnected', () =>
            console.warn('[mongo] Disconnected from Atlas'),
          );
          connection.on('error', (err: Error) =>
            console.error('[mongo] Error:', err.message),
          );
          return connection;
        },
      }),
    }),
  ],
  exports: [MongooseModule],
})
export class MongoModule {}
