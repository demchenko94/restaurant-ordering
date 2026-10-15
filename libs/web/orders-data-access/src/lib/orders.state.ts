export type OrdersState = {
  loadingMore: boolean;
  /** Opaque cursor of the next (older) page, `null` when everything is loaded. */
  nextCursor: string | null;
  /** Orders that just changed; the list flashes them briefly. */
  highlightedIds: string[];
};

export const initialOrdersState: OrdersState = {
  loadingMore: false,
  nextCursor: null,
  highlightedIds: [],
};

export const ORDERS_PAGE_SIZE = 30;
export const HIGHLIGHT_MS = 2000;
