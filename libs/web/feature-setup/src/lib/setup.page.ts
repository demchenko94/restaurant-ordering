import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { describeError } from '@restaurant/web/core';
import { MenuStore } from '@restaurant/web/menu-data-access';
import { EmptyStateComponent, ErrorStateComponent } from '@restaurant/web/ui';
import { CategoryListSkeletonComponent } from './categories/category-list-skeleton.component';
import { CategoryListComponent } from './categories/category-list.component';
import { ItemListSkeletonComponent } from './items/item-list-skeleton.component';
import { ItemListComponent } from './items/item-list.component';

/** Menu configuration: categories on one side, the items of the selected category on the other. */
@Component({
  selector: 'app-setup-page',
  imports: [
    CategoryListComponent,
    ItemListComponent,
    CategoryListSkeletonComponent,
    ItemListSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './setup.page.html',
  styleUrl: './setup.page.scss',
})
export class SetupPage {
  protected readonly menu = inject(MenuStore);

  /** The user's pick; falls back to the first category (also when the picked one is deleted). */
  protected readonly picked = signal<string | null>(null);
  protected readonly selectedId = linkedSignal<string | null>(() => {
    const categories = this.menu.categoriesSorted();
    const picked = this.picked();
    if (picked && categories.some((c) => c.id === picked)) return picked;
    return categories[0]?.id ?? null;
  });
  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? (this.menu.categoryById().get(id) ?? null) : null;
  });
  protected readonly errorTitle = computed(() => {
    const error = this.menu.error();
    return error ? describeError(error).title : '';
  });

  constructor() {
    this.menu.load();
  }

  protected retry(): void {
    this.menu.load();
  }
}
