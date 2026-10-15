import './openapi/extend';
import mongoose from 'mongoose';
import { pino } from 'pino';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { createContainer } from './container';
import { seedMenu } from './seed/seed';

async function main(): Promise<void> {
  try {
    process.loadEnvFile?.();
  } catch {
    // .env is optional; defaults and real environment variables apply.
  }
  const env = loadEnv();
  const logger = pino({
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
      : {}),
  });

  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  logger.info('connected to MongoDB');

  const forceSeed = process.argv.includes('--seed');
  if (forceSeed || env.SEED_ON_EMPTY) {
    const seeded = await seedMenu(env.SEED_ITEM_COUNT, { onlyIfEmpty: !forceSeed });
    if (seeded) logger.info({ items: seeded }, 'seeded demo menu');
  }
  if (forceSeed) {
    await mongoose.disconnect();
    return;
  }

  const container = createContainer({
    eventBufferSize: env.EVENT_BUFFER_SIZE,
    simulatorStepMs: env.SIMULATOR_STEP_MS,
    logger,
  });
  await container.simulator.resume();

  const app = createApp({ services: container, logger, corsOrigin: env.CORS_ORIGIN });
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`API ready on http://${env.HOST}:${env.PORT} (docs: /api/docs)`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    container.dispose();
    server.closeAllConnections();
    server.close(() => {
      mongoose.disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
