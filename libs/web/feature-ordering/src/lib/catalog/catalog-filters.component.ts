import { ChangeDetectionStrategy, Component, effect, input, model, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { SkeletonBarComponent } from '@restaurant/web/ui';
import type { Category } from '@restaurant/contracts';
import { debounceTime } from 'rxjs';

const SEARCH_DEBOUNCE_MS = 150;

/** Search box and category chips. Stateless apart from the typed text: the page owns the filters. */
@Component({
  selector: 'app-catalog-filters',
  imports: [ReactiveFormsModule, MatIcon, SkeletonBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search">
      <mat-icon aria-hidden="true">search</mat-icon>
      <input
        type="search"
        class="search-input"
        placeholder="Search the menu"
        aria-label="Search the menu"
        autocomplete="off"
        [formControl]="search"
      />
    </div>
    <nav class="chips" aria-label="Categories">
      <button
        type="button"
        class="chip"
        [class.active]="!selectedId()"
        [attr.aria-pressed]="!selectedId()"
        (click)="categorySelected.emit(null)"
      >
        All
      </button>
      @if (loading()) {
        @for (width of chipWidths; track $index) {
          <app-skeleton-bar [width]="width" height="36px" radius="18px" class="chip-placeholder" />
        }
      }
      @for (category of categories(); track category.id) {
        <button
          type="button"
          class="chip"
          [class.active]="category.id === selectedId()"
          [attr.aria-pressed]="category.id === selectedId()"
          (click)="categorySelected.emit(category.id)"
        >
          {{ category.name }}
        </button>
      }
    </nav>
  `,
  styleUrl: './catalog-filters.component.scss',
})
export class CatalogFiltersComponent {
  readonly categories = input.required<readonly Category[]>();
  readonly selectedId = input<string | null>(null);
  /** While the categories are loading, show placeholder chips so the row does not jump. */
  readonly loading = input(false);
  protected readonly chipWidths = ['64px', '84px', '78px', '96px', '72px', '88px'];
  /** The (debounced) search text; two-way bindable so the page can clear it. */
  readonly query = model('');
  readonly categorySelected = output<string | null>();

  protected readonly search = new FormControl('', { nonNullable: true });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((value) => this.query.set(value));

    // Keep the box in sync when the page changes the query (initial URL value, "clear filters").
    effect(() => {
      const query = this.query();
      if (this.search.value !== query) this.search.setValue(query, { emitEvent: false });
    });
  }
}
