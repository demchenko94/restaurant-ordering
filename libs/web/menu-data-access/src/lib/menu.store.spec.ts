import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MenuApi } from './menu.api';
import { MenuStore } from './menu.store';
import { category, fixedItem, id, snapshot } from './menu.testing';

describe('MenuStore', () => {
  let api: jest.Mocked<Pick<MenuApi, 'getMenu' | 'updateItem' | 'createCategory' | 'deleteItem'>>;
  let store: InstanceType<typeof MenuStore>;

  beforeEach(() => {
    localStorage.clear();
    api = {
      getMenu: jest.fn(() => of(snapshot(5))),
      updateItem: jest.fn(),
      createCategory: jest.fn(),
      deleteItem: jest.fn(),
    } as never;
    TestBed.configureTestingModule({ providers: [{ provide: MenuApi, useValue: api }] });
    store = TestBed.inject(MenuStore);
  });

  describe('load', () => {
    it('hydrates entities, revision and status', async () => {
      await store.load();
      expect(store.status()).toBe('ready');
      expect(store.revision()).toBe(5);
      expect(store.categoriesSorted().map((c) => c.name)).toEqual(['Pizza', 'Pasta']);
      expect(store.itemsByCategory().get(id(1))).toHaveLength(3);
      expect(store.itemById().get(id(20))?.name).toBe('Item 20');
    });

    it('reports an error when nothing is on screen', async () => {
      api.getMenu.mockReturnValue(
        throwError(() => ({ code: 'NETWORK', message: 'x', status: 0, retryable: true })),
      );
      await store.load();
      expect(store.status()).toBe('error');
      expect(store.error()?.code).toBe('NETWORK');
    });

    it('keeps the current menu usable when a refresh fails', async () => {
      await store.load();
      api.getMenu.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
      await store.load();
      expect(store.status()).toBe('ready');
      expect(store.error()?.code).toBe('NETWORK');
      expect(store.itemEntities()).toHaveLength(4);
    });

    it('persists the snapshot for an instant next start', async () => {
      await store.load();
      expect(JSON.parse(localStorage.getItem('restaurant.menu.v1') as string).revision).toBe(5);
    });
  });

  describe('applyEvent (revision rule)', () => {
    beforeEach(async () => {
      await store.load(); // revision 5
      api.getMenu.mockClear();
    });

    it('applies the next revision and advances', () => {
      store.applyEvent({
        type: 'menu.item.upserted',
        revision: 6,
        item: fixedItem(10, id(1), 1234, false),
      });
      expect(store.revision()).toBe(6);
      expect(store.itemById().get(id(10))).toMatchObject({ priceCents: 1234, available: false });
    });

    it('ignores duplicates and older events', () => {
      store.applyEvent({ type: 'menu.item.deleted', revision: 5, id: id(10) });
      store.applyEvent({ type: 'menu.item.deleted', revision: 2, id: id(10) });
      expect(store.itemById().has(id(10))).toBe(true);
      expect(store.revision()).toBe(5);
    });

    it('reloads the whole menu when it detects a gap', () => {
      store.applyEvent({ type: 'menu.item.deleted', revision: 9, id: id(10) });
      expect(api.getMenu).toHaveBeenCalledTimes(1);
      expect(store.itemById().has(id(10))).toBe(true);
    });

    it('handles category and item removal', () => {
      store.applyEvent({ type: 'menu.item.deleted', revision: 6, id: id(20) });
      store.applyEvent({ type: 'menu.category.deleted', revision: 7, id: id(2) });
      expect(store.itemById().has(id(20))).toBe(false);
      expect(store.categoriesSorted().map((c) => c.id)).toEqual([id(1)]);
      expect(store.revision()).toBe(7);
    });

    it('upserts categories', () => {
      store.applyEvent({
        type: 'menu.category.upserted',
        revision: 6,
        category: category(3, 'Dessert'),
      });
      expect(store.categoriesSorted().map((c) => c.name)).toContain('Dessert');
    });

    it('ignores order events', () => {
      store.applyEvent({ type: 'resync' });
      expect(store.revision()).toBe(5);
    });
  });

  describe('setAvailability (optimistic)', () => {
    beforeEach(async () => {
      await store.load();
    });

    it('flips immediately and keeps the server answer', async () => {
      api.updateItem.mockReturnValue(of(fixedItem(10, id(1), 950, false)));
      const pending = store.setAvailability(id(10), false);
      expect(store.itemById().get(id(10))?.available).toBe(false);
      await pending;
      expect(store.itemById().get(id(10))?.available).toBe(false);
    });

    it('rolls back and rethrows when the server refuses', async () => {
      api.updateItem.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
      await expect(store.setAvailability(id(10), false)).rejects.toMatchObject({ code: 'NETWORK' });
      expect(store.itemById().get(id(10))?.available).toBe(true);
    });
  });

  it('hydrates from the cached snapshot on init and marks it stale', () => {
    localStorage.setItem('restaurant.menu.v1', JSON.stringify(snapshot(3)));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: MenuApi, useValue: api }] });
    const fresh = TestBed.inject(MenuStore);
    expect(fresh.revision()).toBe(3);
    expect(fresh.stale()).toBe(true);
    expect(fresh.status()).toBe('ready');
  });

  it('ignores a corrupt cache', () => {
    localStorage.setItem('restaurant.menu.v1', '{"revision":"x"}');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: MenuApi, useValue: api }] });
    const fresh = TestBed.inject(MenuStore);
    expect(fresh.status()).toBe('idle');
  });
});
