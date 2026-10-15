import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { ConnectionStore } from '@restaurant/web/core';
import { centsToInput, MoneyPipe, parseMoneyToCents } from '@restaurant/web/ui';
import { CartStore } from './cart.store';
import type { CartLineView } from './cart.view';
import { CheckoutStore } from '../checkout/checkout.store';
import { QuantityStepperComponent } from './quantity-stepper.component';

const CHECKOUT_DIALOG_ID = 'checkout-dialog';

@Component({
  selector: 'app-cart-panel',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatIconButton,
    MatIcon,
    MoneyPipe,
    QuantityStepperComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart-panel.component.html',
  styleUrl: './cart-panel.component.scss',
})
export class CartPanelComponent {
  protected readonly cart = inject(CartStore);
  private readonly checkout = inject(CheckoutStore);
  private readonly dialog = inject(MatDialog);
  private readonly sheet = inject(MatBottomSheetRef, { optional: true });
  private readonly connection = inject(ConnectionStore);

  protected readonly discount = new FormControl(centsToInput(this.cart.discountCents() || null), {
    nonNullable: true,
  });
  protected readonly discountInvalid = signal(false);
  private checkoutOpening = false;
  protected readonly offline = computed(() => !this.connection.canWrite());
  protected readonly canCheckout = computed(
    () =>
      !this.cart.isEmpty() &&
      this.cart.subtotalCents() > 0 &&
      !this.cart.discountError() &&
      !this.discountInvalid() &&
      !this.offline(),
  );

  constructor() {
    // The discount can also be changed elsewhere (the checkout dialog can cap it).
    effect(() => {
      const cents = this.cart.discountCents();
      if ((parseMoneyToCents(this.discount.value) ?? 0) !== cents) {
        this.discount.setValue(centsToInput(cents || null), { emitEvent: false });
        this.discountInvalid.set(false);
      }
    });
  }

  protected commitDiscount(): void {
    const raw = this.discount.value.trim();
    if (raw === '') {
      this.discountInvalid.set(false);
      this.cart.setDiscount(0);
      return;
    }
    const cents = parseMoneyToCents(raw);
    this.discountInvalid.set(cents === null);
    if (cents !== null) this.cart.setDiscount(cents);
  }

  protected trackLine(_: number, view: CartLineView): string {
    return view.line.key;
  }

  protected statusNote(view: CartLineView): string | null {
    switch (view.status) {
      case 'unavailable':
        return 'No longer available';
      case 'removed':
        return 'Removed from the menu';
      case 'price-changed':
        return 'Price changed';
      default:
        return null;
    }
  }

  protected async startCheckout(): Promise<void> {
    // One checkout at a time: a second click while the dialog is opening must not stack another.
    if (
      !this.canCheckout() ||
      this.checkoutOpening ||
      this.dialog.getDialogById(CHECKOUT_DIALOG_ID)
    ) {
      return;
    }
    this.checkoutOpening = true;
    this.commitDiscount();
    this.sheet?.dismiss();
    const { CheckoutDialog } = await import('../checkout/checkout.dialog');
    const ref = this.dialog.open(CheckoutDialog, {
      id: CHECKOUT_DIALOG_ID,
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: 'dialog',
    });
    this.checkoutOpening = false;
    this.checkout.start();
    ref.afterClosed().subscribe(() => this.checkout.reset());
  }
}
