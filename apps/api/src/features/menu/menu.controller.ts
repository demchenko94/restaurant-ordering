import type { Request, Response } from 'express';
import type { MenuService } from './menu.service';

export class MenuController {
  constructor(private readonly service: MenuService) {}

  /** Snapshot with an `ETag` of the revision, so an unchanged menu answers `304`. */
  get = async (req: Request, res: Response): Promise<void> => {
    const revision = await this.service.getRevision();
    const etag = `"rev-${revision}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');
    if (req.header('if-none-match') === etag) {
      res.status(304).end();
      return;
    }
    res.json(await this.service.getSnapshot());
  };
}
