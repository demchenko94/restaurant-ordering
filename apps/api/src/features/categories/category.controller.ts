import { CategoryInput, CategoryPatch } from '@restaurant/contracts';
import type { Request, Response } from 'express';
import { parse, parseId } from '../../common/parse';
import type { CategoryService } from './category.service';

export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.service.create(parse(CategoryInput, req.body)));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.update(parseId(req.params['id']), parse(CategoryPatch, req.body)));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(parseId(req.params['id']));
    res.status(204).end();
  };
}
