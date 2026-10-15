import {
  CheckoutRequest,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_PATTERN,
  OrdersQuery,
  OrderStatusPatch,
} from '@restaurant/contracts';
import type { Request, Response } from 'express';
import { AppError } from '../../common/errors';
import { parse, parseId } from '../../common/parse';
import type { OrderService } from './order.service';

export class OrderController {
  constructor(private readonly service: OrderService) {}

  place = async (req: Request, res: Response): Promise<void> => {
    const key = req.header(IDEMPOTENCY_KEY_HEADER);
    if (!key) {
      throw new AppError(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        `The ${IDEMPOTENCY_KEY_HEADER} header is required`,
      );
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw AppError.validation(`Invalid ${IDEMPOTENCY_KEY_HEADER} header`, [
        {
          path: ['header', IDEMPOTENCY_KEY_HEADER],
          message: '1-128 chars: letters, digits, _ or -',
        },
      ]);
    }
    const { order, replayed } = await this.service.place(key, parse(CheckoutRequest, req.body));
    res.setHeader('Idempotency-Replayed', String(replayed));
    res.status(replayed ? 200 : 201).json(order);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { limit, cursor } = parse(OrdersQuery, req.query, 'query');
    res.json(await this.service.list(limit, cursor));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.get(parseId(req.params['id'])));
  };

  setStatus = async (req: Request, res: Response): Promise<void> => {
    const { status } = parse(OrderStatusPatch, req.body);
    res.json(await this.service.transition(parseId(req.params['id']), status));
  };
}
