import type { Server } from 'node:http';
import os from 'node:os';
import type { AddressInfo } from 'node:net';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { pino } from 'pino';
import { createApp } from '../app';
import { createContainer, type Container } from '../container';

export interface TestApp {
  container: Container;
  app: ReturnType<typeof createApp>;
  /** Starts a real HTTP server (needed for streaming responses such as SSE). */
  listen(): Promise<{ url: string; close(): Promise<void> }>;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

/** Real Express app + real Mongoose models over an in-memory MongoDB. */
export async function startTestApp(simulatorStepMs = 0): Promise<TestApp> {
  const mongod = await MongoMemoryServer.create();
  // mongodb 7 loads `os` with a dynamic import(), which fails inside Jest's CommonJS sandbox and
  // leaves the handshake without a `driver` document. Supplying the adapter avoids the import.
  await mongoose.connect(mongod.getUri(), { dbName: 'test', runtimeAdapters: { os } });
  // Make sure unique indexes exist before the first write.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const logger = pino({ level: 'silent' });
  const container = createContainer({ eventBufferSize: 100, simulatorStepMs, logger });
  const app = createApp({ services: container, logger });
  const servers: Server[] = [];

  return {
    container,
    app,
    listen: () =>
      new Promise((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => {
          servers.push(server);
          const { port } = server.address() as AddressInfo;
          resolve({
            url: `http://127.0.0.1:${port}`,
            close: () =>
              new Promise<void>((done) => {
                server.closeAllConnections();
                server.close(() => done());
              }),
          });
        });
      }),
    reset: async () => {
      await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    },
    stop: async () => {
      container.dispose();
      for (const s of servers) s.closeAllConnections();
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}
