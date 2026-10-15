import { CheckoutRequest } from '@restaurant/contracts';
import type { Request, Response } from 'express';
import { parse } from '../../common/parse';
import type { CheckoutService } from './checkout.service';

export class CheckoutController {
  constructor(private readonly service: CheckoutService) {}

  /** Always `200`: problems with the cart are data (`changes`), not an error. */
  quote = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.quote(parse(CheckoutRequest, req.body)));
  };
}
