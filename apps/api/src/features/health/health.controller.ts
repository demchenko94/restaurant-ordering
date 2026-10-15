import type { HealthResponse } from '@restaurant/contracts';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';

export class HealthController {
  get = (_req: Request, res: Response): void => {
    const up = mongoose.connection.readyState === 1;
    const body: HealthResponse = { status: up ? 'ok' : 'degraded', mongo: up ? 'up' : 'down' };
    res.status(up ? 200 : 503).json(body);
  };
}
