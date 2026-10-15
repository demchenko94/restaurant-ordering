import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Order } from '@restaurant/contracts';
import { MoneyPipe, StatusChipComponent } from '@restaurant/web/ui';

/** Lines and totals of one order, kept current because the page re-reads it from the store. */
@Component({
  selector: 'app-order-detail',
  imports: [MoneyPipe, StatusChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
})
export class OrderDetailComponent {
  readonly order = input.required<Order>();
}
