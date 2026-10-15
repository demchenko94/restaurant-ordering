import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  MONGO_URI: z.string().min(1).default('mongodb://localhost:27017/restaurant'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Allowed browser origin for CORS. The dev server proxies /api, so this is optional. */
  CORS_ORIGIN: z.string().optional(),
  /** Delay between automatic order status steps. 0 disables the simulator. */
  SIMULATOR_STEP_MS: z.coerce.number().int().min(0).default(8000),
  /** How many recent SSE events are kept for Last-Event-ID replay. */
  EVENT_BUFFER_SIZE: z.coerce.number().int().min(10).default(500),
  /** Seed a large demo menu on startup when the database has no categories. */
  SEED_ON_EMPTY: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SEED_ITEM_COUNT: z.coerce.number().int().min(1).max(50_000).default(3000),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}
