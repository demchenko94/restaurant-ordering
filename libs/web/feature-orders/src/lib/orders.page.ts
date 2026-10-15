import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import type { Order } from '@restaurant/contracts';
import { describeError } from '@restaurant/web/core';
import { OrdersStore } from '@restaurant/web/orders-data-access';
import { OrderDetailComponent } from './order-detail.component';
import { OrdersSkeletonComponent } from './orders-skeleton.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  MoneyPipe,
  StatusChipComponent,
} from '@restaurant/web/ui';

const LOAD_MORE_THRESHOLD = 6;

@Component({
  selector: 'app-orders-page',
  imports: [
    ScrollingModule,
    DatePipe,
    RouterLink,
    MatButton,
    MatProgressSpinner,
    MoneyPipe,
    StatusChipComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    OrderDetailComponent,
    OrdersSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders.page.html',
  styleUrl: './orders.page.scss',
})
export class OrdersPage {
  protected readonly orders = inject(OrdersStore);
  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  private readonly selectedId = signal<string | null>(null);
  /** Re-read from the store, so the open detail follows live status changes. */
  protected readonly selected = computed<Order | null>(() => {
    const id = this.selectedId();
    return id ? (this.orders.entityMap()[id] ?? null) : null;
  });
  protected readonly highlighted = computed(() => new Set(this.orders.highlightedIds()));
  protected readonly errorTitle = computed(() => {
    const error = this.orders.error();
    return error ? describeError(error).title : '';
  });

  constructor() {
    this.orders.loadFirstPage();
  }

  protected select(order: Order): void {
    this.selectedId.set(this.selectedId() === order.id ? null : order.id);
  }

  protected summary(order: Order): string {
    return order.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ');
  }

  protected itemCount(order: Order): number {
    return order.lines.reduce((n, l) => n + l.quantity, 0);
  }

  protected onScrolled(): void {
    const viewport = this.viewport();
    if (!viewport) return;
    const total = this.orders.sorted().length;
    if (viewport.getRenderedRange().end >= total - LOAD_MORE_THRESHOLD) {
      this.orders.loadMore();
    }
  }

  protected retry(): void {
    this.orders.loadFirstPage();
  }

  protected trackOrder(_: number, order: Order): string {
    return order.id;
  }
}
