import { BreakpointObserver } from '@angular/cdk/layout';
import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Router } from '@angular/router';
import type { MenuItem } from '@restaurant/contracts';
import { describeError } from '@restaurant/web/core';
import { MenuStore } from '@restaurant/web/menu-data-access';
import { EmptyStateComponent, ErrorStateComponent, MoneyPipe } from '@restaurant/web/ui';
import { map } from 'rxjs';
import { CartPanelComponent } from '../cart/cart-panel.component';
import { CatalogFiltersComponent } from './catalog-filters.component';
import { CatalogSkeletonComponent } from './catalog-skeleton.component';
import { CartStore } from '../cart/cart.store';
import { QuantityStepperComponent } from '../cart/quantity-stepper.component';

type Row =
  | { kind: 'header'; key: string; name: string; count: number }
  | { kind: 'item'; key: string; item: MenuItem };

const WIDE_QUERY = '(min-width: 960px)';

@Component({
  selector: 'app-catalog-page',
  imports: [
    ScrollingModule,
    MatButton,
    MatIcon,
    MoneyPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    QuantityStepperComponent,
    CartPanelComponent,
    CatalogFiltersComponent,
    CatalogSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.page.html',
  styleUrl: './catalog.page.scss',
})
export class CatalogPage implements OnInit {
  /** Bound from the URL (`/menu?category=…&q=…`) by `withComponentInputBinding()`. */
  readonly category = input<string>();
  readonly q = input<string | undefined>();

  protected readonly menu = inject(MenuStore);
  protected readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly sheet = inject(MatBottomSheet);

  protected readonly isWide = toSignal(
    inject(BreakpointObserver)
      .observe(WIDE_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: typeof matchMedia === 'function' && matchMedia(WIDE_QUERY).matches },
  );

  protected readonly query = signal('');

  protected readonly selectedCategoryId = computed(() => {
    const id = this.category();
    return id && this.menu.categoryById().has(id) ? id : null;
  });

  /** One flat list of category headers and items, so a single fixed-size virtual scroll fits. */
  protected readonly rows = computed<Row[]>(() => {
    const needle = this.query().trim().toLowerCase();
    const only = this.selectedCategoryId();
    const byCategory = this.menu.itemsByCategory();
    const rows: Row[] = [];
    for (const category of this.menu.categoriesSorted()) {
      if (only && category.id !== only) continue;
      const items = (byCategory.get(category.id) ?? []).filter(
        (item) =>
          !needle ||
          item.name.toLowerCase().includes(needle) ||
          (item.description?.toLowerCase().includes(needle) ?? false),
      );
      if (items.length === 0) continue;
      rows.push({
        kind: 'header',
        key: `h:${category.id}`,
        name: category.name,
        count: items.length,
      });
      for (const item of items) rows.push({ kind: 'item', key: item.id, item });
    }
    return rows;
  });

  protected readonly errorTitle = computed(() => {
    const error = this.menu.error();
    return error ? describeError(error).title : '';
  });

  constructor() {
    this.menu.load();
  }

  ngOnInit(): void {
    // The router binds an absent query param as `undefined`.
    this.query.set(this.q() ?? '');
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    void this.router.navigate([], {
      queryParams: { q: value.trim() || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected selectCategory(id: string | null): void {
    void this.router.navigate([], {
      queryParams: { category: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected clearFilters(): void {
    this.query.set('');
    void this.router.navigate([], { queryParams: { q: null, category: null }, replaceUrl: true });
  }

  protected quantityOf(itemId: string): number {
    return this.cart.quantityByItem().get(itemId) ?? 0;
  }

  protected addFixed(item: MenuItem): void {
    this.cart.add(item);
  }

  protected async addOpenPrice(item: MenuItem): Promise<void> {
    const { OpenPriceDialog } = await import('../cart/open-price.dialog');
    this.dialog
      .open(OpenPriceDialog, { data: item, autoFocus: 'dialog' })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.cart.add(item, result.quantity, result.unitPriceCents);
      });
  }

  protected openCart(): void {
    this.sheet.open(CartPanelComponent, { panelClass: 'cart-sheet' });
  }

  protected retry(): void {
    this.menu.load();
  }

  protected trackRow(_: number, row: Row): string {
    return row.key;
  }
}
