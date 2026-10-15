import { ChangeDetectionStrategy, Component, inject, model, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { CategoryInput, type Category } from '@restaurant/contracts';
import { isApiErrorView, NotifyService } from '@restaurant/web/core';
import { MenuStore } from '@restaurant/web/menu-data-access';
import { ConfirmDialogComponent, zodValidator } from '@restaurant/web/ui';
import { firstValueFrom } from 'rxjs';

/** Category pane of the Setup screen: pick, add, rename and delete categories. */
@Component({
  selector: 'app-category-list',
  imports: [ReactiveFormsModule, MatButton, MatIconButton, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.scss',
})
export class CategoryListComponent {
  protected readonly menu = inject(MenuStore);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);

  /** The category whose items are shown; two-way bound with the page. */
  readonly selectedId = model<string | null>(null);

  protected readonly newCategory = new FormControl('', {
    nonNullable: true,
    validators: [zodValidator(CategoryInput.shape.name)],
  });
  protected readonly adding = signal(false);

  protected countIn(categoryId: string): number {
    return this.menu.itemsByCategory().get(categoryId)?.length ?? 0;
  }

  protected async add(): Promise<void> {
    if (this.newCategory.invalid || this.adding()) return;
    this.adding.set(true);
    try {
      const category = await this.menu.createCategory({ name: this.newCategory.value.trim() });
      this.newCategory.reset('');
      this.selectedId.set(category.id);
    } catch (error) {
      this.fail(error);
    } finally {
      this.adding.set(false);
    }
  }

  protected async rename(category: Category): Promise<void> {
    const { CategoryNameDialog } = await import('./category-name.dialog');
    const name = await firstValueFrom(
      this.dialog
        .open(CategoryNameDialog, {
          data: { title: 'Rename category', label: 'Name', value: category.name },
        })
        .afterClosed(),
    );
    if (!name || name === category.name) return;
    try {
      await this.menu.updateCategory(category.id, { name });
    } catch (error) {
      this.fail(error);
    }
  }

  protected async remove(category: Category): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: `Delete "${category.name}"?`,
            message: 'The category must be empty. This cannot be undone.',
            confirmLabel: 'Delete',
          },
        })
        .afterClosed(),
    );
    if (!confirmed) return;
    try {
      await this.menu.deleteCategory(category.id);
      this.notify.info('Category deleted');
    } catch (error) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    if (isApiErrorView(error)) this.notify.error(error);
    else throw error;
  }
}
