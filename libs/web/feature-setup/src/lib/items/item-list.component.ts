import { ScrollingModule } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import type { Category, MenuItem } from '@restaurant/contracts';
import { isApiErrorView, NotifyService } from '@restaurant/web/core';
import { MenuStore } from '@restaurant/web/menu-data-access';
import {
  centsToInput,
  ConfirmDialogComponent,
  EmptyStateComponent,
  parseMoneyToCents,
} from '@restaurant/web/ui';
import { firstValueFrom } from 'rxjs';

/** Items of one category: price and availability inline, plus add / edit / delete. */
@Component({
  selector: 'app-item-list',
  imports: [
    ScrollingModule,
    MatButton,
    MatIconButton,
    MatIcon,
    MatSlideToggle,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.scss',
})
export class ItemListComponent {
  readonly category = input.required<Category>();

  private readonly menu = inject(MenuStore);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);

  protected readonly items = computed(
    () => this.menu.itemsByCategory().get(this.category().id) ?? [],
  );
  protected readonly priceText = centsToInput;

  protected trackItem(_: number, item: MenuItem): string {
    return item.id;
  }

  protected async openForm(item?: MenuItem): Promise<void> {
    const { ItemFormDialog } = await import('./item-form.dialog');
    const saved = await firstValueFrom(
      this.dialog
        .open(ItemFormDialog, {
          data: { categoryId: this.category().id, item },
          autoFocus: 'dialog',
        })
        .afterClosed(),
    );
    if (saved) this.notify.info(item ? 'Item updated' : 'Item created');
  }

  protected async toggleAvailable(item: MenuItem, available: boolean): Promise<void> {
    try {
      await this.menu.setAvailability(item.id, available);
    } catch (error) {
      this.fail(error);
    }
  }

  protected async commitPrice(item: MenuItem, input: HTMLInputElement): Promise<void> {
    if (item.openPrice) return;
    const cents = parseMoneyToCents(input.value);
    if (cents === item.priceCents) {
      input.value = centsToInput(item.priceCents);
      return;
    }
    if (cents === null || cents < 1) {
      input.value = centsToInput(item.priceCents);
      this.notify.error('Enter a price like 9.50');
      return;
    }
    try {
      await this.menu.updateItem(item.id, { priceCents: cents });
    } catch (error) {
      input.value = centsToInput(item.priceCents);
      this.fail(error);
    }
  }

  protected async remove(item: MenuItem): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: `Delete "${item.name}"?`,
            message: 'Existing orders keep their copy of this item.',
            confirmLabel: 'Delete',
          },
        })
        .afterClosed(),
    );
    if (!confirmed) return;
    try {
      await this.menu.deleteItem(item.id);
      this.notify.info('Item deleted');
    } catch (error) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    if (isApiErrorView(error)) this.notify.error(error);
    else throw error;
  }
}
