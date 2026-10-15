import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IDEMPOTENCY_KEY_HEADER,
  type CheckoutQuote,
  type CheckoutRequest,
  type Order,
  type OrdersPage,
  type OrderStatus,
} from '@restaurant/contracts';
import { API_BASE_URL } from '@restaurant/web/core';

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  quote(request: CheckoutRequest) {
    return this.http.post<CheckoutQuote>(`${this.base}/checkout/quote`, request);
  }

  /** `idempotencyKey` makes retries safe: the server never creates a second order for it. */
  place(idempotencyKey: string, request: CheckoutRequest) {
    return this.http.post<Order>(`${this.base}/orders`, request, {
      headers: new HttpHeaders({ [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }),
    });
  }

  list(limit: number, cursor?: string | null) {
    const params: Record<string, string> = { limit: String(limit) };
    if (cursor) params['cursor'] = cursor;
    return this.http.get<OrdersPage>(`${this.base}/orders`, { params });
  }

  setStatus(id: string, status: OrderStatus) {
    return this.http.patch<Order>(`${this.base}/orders/${id}/status`, { status });
  }
}
