import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  Category,
  CategoryInput,
  CategoryPatch,
  MenuItem,
  MenuItemInput,
  MenuItemPatch,
  MenuSnapshot,
} from '@restaurant/contracts';
import { API_BASE_URL } from '@restaurant/web/core';

/**
 * Thin typed wrapper over the menu endpoints. Responses are trusted (typed by the shared
 * contracts); only data read from `localStorage` is re-validated.
 */
@Injectable({ providedIn: 'root' })
export class MenuApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  getMenu() {
    return this.http.get<MenuSnapshot>(`${this.base}/menu`);
  }

  createCategory(input: CategoryInput) {
    return this.http.post<Category>(`${this.base}/categories`, input);
  }

  updateCategory(id: string, patch: CategoryPatch) {
    return this.http.patch<Category>(`${this.base}/categories/${id}`, patch);
  }

  deleteCategory(id: string) {
    return this.http.delete<void>(`${this.base}/categories/${id}`);
  }

  createItem(input: MenuItemInput) {
    return this.http.post<MenuItem>(`${this.base}/items`, input);
  }

  updateItem(id: string, patch: MenuItemPatch) {
    return this.http.patch<MenuItem>(`${this.base}/items/${id}`, patch);
  }

  deleteItem(id: string) {
    return this.http.delete<void>(`${this.base}/items/${id}`);
  }
}
