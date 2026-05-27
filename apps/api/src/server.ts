import { buildApp } from './app.js';
import { config } from './config.js';
import { closeDatabase } from './db.js';

const app = await buildApp();

const shutdown = async () => {
  await closeDatabase();
  await app.close();
};

process.on('SIGTERM', () => {
  void shutdown().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  void shutdown().then(() => process.exit(0));
});

await app.listen({ port: config.PORT, host: '0.0.0.0' });
