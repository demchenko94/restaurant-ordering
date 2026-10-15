import { MenuItemInput, MenuItemPatch } from '@restaurant/contracts';
import type { Request, Response } from 'express';
import { parse, parseId } from '../../common/parse';
import type { ItemService } from './item.service';

export class ItemController {
  constructor(private readonly service: ItemService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.service.create(parse(MenuItemInput, req.body)));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.update(parseId(req.params['id']), parse(MenuItemPatch, req.body)));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(parseId(req.params['id']));
    res.status(204).end();
  };
}
