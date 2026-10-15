import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import type { CartChange } from '@restaurant/contracts';
import { describeError } from '@restaurant/web/core';
import { MenuStore } from '@restaurant/web/menu-data-access';
import { formatMoney, MoneyPipe, SkeletonRowsComponent } from '@restaurant/web/ui';
import { CartStore } from '../cart/cart.store';
import { CheckoutStore } from './checkout.store';

@Component({
  selector: 'app-checkout-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatIcon,
    MatProgressSpinner,
    RouterLink,
    MoneyPipe,
    SkeletonRowsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout.dialog.html',
  styleUrl: './checkout.dialog.scss',
})
export class CheckoutDialog {
  protected readonly checkout = inject(CheckoutStore);
  protected readonly cart = inject(CartStore);
  private readonly menu = inject(MenuStore);

  protected readonly hasUnavailable = computed(() =>
    this.checkout.changes().some((c) => c.type === 'ITEM_UNAVAILABLE' || c.type === 'ITEM_REMOVED'),
  );
  protected readonly hasPriceChange = computed(() =>
    this.checkout.changes().some((c) => c.type === 'PRICE_CHANGED'),
  );
  protected readonly discountCap = computed(() => {
    const change = this.checkout.changes().find((c) => c.type === 'DISCOUNT_TOO_HIGH');
    return change?.type === 'DISCOUNT_TOO_HIGH' ? change.maxCents : null;
  });
  protected readonly errorView = computed(() => {
    const error = this.checkout.error();
    return error ? describeError(error) : null;
  });

  protected describe(change: CartChange): string {
    const name = (id: string) => this.menu.itemById().get(id)?.name ?? 'An item';
    switch (change.type) {
      case 'ITEM_UNAVAILABLE':
        return `${name(change.itemId)} is no longer available.`;
      case 'ITEM_REMOVED':
        return 'An item was removed from the menu.';
      case 'PRICE_CHANGED':
        return `${name(change.itemId)} price changed from ${formatMoney(change.previousCents)} to ${formatMoney(change.currentCents)}.`;
      case 'OPEN_PRICE_REQUIRED':
        return `${name(change.itemId)} needs a price.`;
      case 'OPEN_PRICE_NOT_ALLOWED':
        return `${name(change.itemId)} now has a fixed price.`;
      case 'DISCOUNT_TOO_HIGH':
        return `The discount is higher than the order total (maximum ${formatMoney(change.maxCents)}).`;
    }
  }

  protected async removeUnavailable(): Promise<void> {
    this.cart.removeUnavailable();
    await this.checkout.requote();
  }

  protected async acceptPrices(): Promise<void> {
    this.cart.acknowledgePrices();
    await this.checkout.requote();
  }

  protected async capDiscount(): Promise<void> {
    const cap = this.discountCap();
    if (cap === null) return;
    this.cart.setDiscount(cap);
    await this.checkout.requote();
  }
}
