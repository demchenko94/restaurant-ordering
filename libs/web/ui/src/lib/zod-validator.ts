import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { ZodType } from 'zod';

/** Adapts a Zod schema to an Angular validator, so form rules come from the shared contracts. */
export function zodValidator(schema: ZodType, key = 'zod'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const result = schema.safeParse(control.value);
    if (result.success) return null;
    return { [key]: result.error.issues[0]?.message ?? 'Invalid value' };
  };
}
