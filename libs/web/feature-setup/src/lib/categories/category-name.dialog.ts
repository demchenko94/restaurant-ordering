import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
import { CategoryInput } from '@restaurant/contracts';
import { zodValidator } from '@restaurant/web/ui';

export interface CategoryNameDialogData {
  title: string;
  label: string;
  value?: string;
  confirmLabel?: string;
}

/** Asks for a single name (used to rename a category). Resolves to the trimmed name. */
@Component({
  selector: 'app-category-name-dialog',
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
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form (ngSubmit)="submit()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ data.label }}</mat-label>
          <input matInput [formControl]="name" maxlength="60" cdkFocusInitial autocomplete="off" />
          @if (name.hasError('zod')) {
            <mat-error>{{ name.getError('zod') }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="name.invalid">
          {{ data.confirmLabel ?? 'Save' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .full {
      width: 100%;
      min-width: min(320px, 80vw);
    }
  `,
})
export class CategoryNameDialog {
  protected readonly data = inject<CategoryNameDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<CategoryNameDialog, string>>(MatDialogRef);
  protected readonly name = new FormControl(this.data.value ?? '', {
    nonNullable: true,
    validators: [zodValidator(CategoryInput.shape.name)],
  });

  protected submit(): void {
    if (this.name.valid) this.ref.close(this.name.value.trim());
  }
}
