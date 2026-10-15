import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MAX_PRICE_CENTS, MAX_QTY, type MenuItem } from '@restaurant/contracts';
import { formatMoney, parseMoneyToCents } from '@restaurant/web/ui';

export interface OpenPriceResult {
  unitPriceCents: number;
  quantity: number;
}

const priceValidator: ValidatorFn = (control) => {
  const cents = parseMoneyToCents(control.value);
  if (cents === null) return { price: 'Enter an amount like 9.50' };
  if (cents < 1) return { price: 'Price must be above zero' };
  if (cents > MAX_PRICE_CENTS)
    return { price: `Price can't exceed ${formatMoney(MAX_PRICE_CENTS)}` };
  return null;
};

/** Asks for the price of an open-price item (and a quantity) when it is added to the order. */
@Component({
  selector: 'app-open-price-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ item.name }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="hint">This item has an open price. Enter the price for this order.</p>
        <mat-form-field appearance="outline">
          <mat-label>Price</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input
            matInput
            formControlName="price"
            inputmode="decimal"
            autocomplete="off"
            cdkFocusInitial
          />
          @if (form.controls.price.getError('price'); as message) {
            <mat-error>{{ message }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Quantity</mat-label>
          <input
            matInput
            type="number"
            formControlName="quantity"
            min="1"
            [max]="maxQty"
            step="1"
          />
          @if (form.controls.quantity.invalid) {
            <mat-error>Between 1 and {{ maxQty }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">Add to order</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      min-width: min(340px, 80vw);
    }
    .hint {
      margin: 0 0 12px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class OpenPriceDialog {
  protected readonly item = inject<MenuItem>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<OpenPriceDialog, OpenPriceResult>>(MatDialogRef);
  protected readonly maxQty = MAX_QTY;

  protected readonly form = new FormGroup({
    price: new FormControl('', { nonNullable: true, validators: [priceValidator] }),
    quantity: new FormControl(1, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(1),
        Validators.max(MAX_QTY),
        Validators.pattern(/^\d+$/),
      ],
    }),
  });

  protected submit(): void {
    if (this.form.invalid) return;
    const unitPriceCents = parseMoneyToCents(this.form.controls.price.value);
    if (unitPriceCents === null) return;
    this.ref.close({ unitPriceCents, quantity: this.form.controls.quantity.value });
  }
}
