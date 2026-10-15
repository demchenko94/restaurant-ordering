import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import {
  ITEM_DESCRIPTION_MAX,
  ITEM_NAME_MAX,
  MAX_PRICE_CENTS,
  type MenuItem,
  MenuItemInput,
} from '@restaurant/contracts';
import { isApiErrorView } from '@restaurant/web/core';
import { MenuStore } from '@restaurant/web/menu-data-access';
import { centsToInput, formatMoney, parseMoneyToCents } from '@restaurant/web/ui';

export interface ItemFormData {
  categoryId: string;
  /** Present when editing. */
  item?: MenuItem;
}

function priceValidator(control: AbstractControl): ValidationErrors | null {
  const group = control.parent as FormGroup | null;
  if (!group || group.get('openPrice')?.value) return null;
  const cents = parseMoneyToCents(control.value);
  if (cents === null) return { price: 'Enter an amount like 9.50' };
  if (cents < 1) return { price: 'Price must be above zero' };
  if (cents > MAX_PRICE_CENTS)
    return { price: `Price can't exceed ${formatMoney(MAX_PRICE_CENTS)}` };
  return null;
}

@Component({
  selector: 'app-item-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatCheckbox,
    MatSlideToggle,
    MatButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-form.dialog.html',
  styleUrl: './item-form.dialog.scss',
})
export class ItemFormDialog {
  protected readonly data = inject<ItemFormData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ItemFormDialog, MenuItem>>(MatDialogRef);
  private readonly menu = inject(MenuStore);

  protected readonly categories = this.menu.categoriesSorted;
  protected readonly editing = this.data.item !== undefined;
  protected readonly nameMax = ITEM_NAME_MAX;
  protected readonly descriptionMax = ITEM_DESCRIPTION_MAX;
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.item?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(ITEM_NAME_MAX)],
    }),
    description: new FormControl(this.data.item?.description ?? '', { nonNullable: true }),
    categoryId: new FormControl(this.data.item?.categoryId ?? this.data.categoryId, {
      nonNullable: true,
    }),
    openPrice: new FormControl(this.data.item?.openPrice ?? false, { nonNullable: true }),
    price: new FormControl(centsToInput(this.data.item?.priceCents), {
      nonNullable: true,
      validators: [priceValidator],
    }),
    available: new FormControl(this.data.item?.available ?? true, { nonNullable: true }),
  });

  private readonly openPrice = toSignal(this.form.controls.openPrice.valueChanges, {
    initialValue: this.form.controls.openPrice.value,
  });
  protected readonly priceDisabled = computed(() => this.openPrice());

  constructor() {
    this.form.controls.openPrice.valueChanges.subscribe((open) => {
      const price = this.form.controls.price;
      if (open) price.disable({ emitEvent: false });
      else price.enable({ emitEvent: false });
      price.updateValueAndValidity();
    });
    if (this.form.controls.openPrice.value) this.form.controls.price.disable({ emitEvent: false });
  }

  protected async submit(): Promise<void> {
    this.formError.set(null);
    const v = this.form.getRawValue();
    const priceCents = v.openPrice ? null : parseMoneyToCents(v.price);

    // Reuse the shared contract so client and server agree on what is valid.
    const candidate = {
      categoryId: v.categoryId,
      name: v.name,
      description: v.description || undefined,
      available: v.available,
      openPrice: v.openPrice,
      ...(v.openPrice ? {} : { priceCents }),
    };
    const parsed = MenuItemInput.safeParse(candidate);
    if (!parsed.success) {
      this.applyIssues(parsed.error.issues);
      return;
    }

    this.saving.set(true);
    try {
      const input: MenuItemInput = parsed.data;
      const saved = this.data.item
        ? await this.menu.updateItem(this.data.item.id, {
            categoryId: input.categoryId,
            name: input.name,
            description: input.description ?? null,
            available: input.available,
            openPrice: input.openPrice,
            priceCents: input.openPrice ? null : input.priceCents,
          })
        : await this.menu.createItem(input);
      this.ref.close(saved);
    } catch (error) {
      if (isApiErrorView(error) && Array.isArray(error.details)) {
        this.applyIssues(error.details as { path: (string | number)[]; message: string }[]);
      }
      this.formError.set(isApiErrorView(error) ? error.message : 'Could not save the item.');
    } finally {
      this.saving.set(false);
    }
  }

  private applyIssues(issues: readonly { path: readonly PropertyKey[]; message: string }[]): void {
    for (const issue of issues) {
      const key = issue.path[0] === 'priceCents' ? 'price' : String(issue.path[0]);
      const control = this.form.get(key);
      if (control) control.setErrors({ server: issue.message });
    }
    this.form.markAllAsTouched();
  }
}
