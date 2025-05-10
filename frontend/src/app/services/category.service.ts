import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface Category {
  id: string;
  name: string;
  subcategories?: SubcategoryFromCategoryDetail[];
}

export interface SubcategoryFromCategoryDetail {
  id: string;
  name: string;
}

export interface Subcategory {
  id: string;
  name: string;
  relatedCategoryId: string;
}

export interface NewCategoryPayload {
  id: string;
  name: string;
}

export interface UpdateCategoryPayload {
  id: string;
  name: string;
}

export interface NewSubcategoryPayload {
  id: string;
  name: string;
  relatedCategoryId: string;
}

export interface UpdateSubcategoryPayload {
  id: string;
  name: string;
  relatedCategoryId: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategorySubcategoryService {
  private apiUrl = 'http://localhost:8100/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`, { headers: this.getAuthHeaders() });
  }

  getCategoryByCode(categoryCode: string): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/categories/${categoryCode}`, { headers: this.getAuthHeaders() });
  }

  createCategory(payload: NewCategoryPayload): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories`, payload, { headers: this.getAuthHeaders() });
  }

  updateCategory(categoryCode: string, payload: UpdateCategoryPayload): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/categories/${categoryCode}`, payload, { headers: this.getAuthHeaders() });
  }

  deleteCategory(categoryCode: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/categories/${categoryCode}`, { headers: this.getAuthHeaders() });
  }

  getSubcategoryByCode(subcategoryCode: string): Observable<Subcategory> {
    return this.http.get<Subcategory>(`${this.apiUrl}/subcategories/${subcategoryCode}`, { headers: this.getAuthHeaders() });
  }

  createSubcategory(payload: NewSubcategoryPayload): Observable<Subcategory> {
    return this.http.post<Subcategory>(`${this.apiUrl}/subcategories`, payload, { headers: this.getAuthHeaders() });
  }

  updateSubcategory(subcategoryCode: string, payload: UpdateSubcategoryPayload): Observable<Subcategory> {
    return this.http.put<Subcategory>(`${this.apiUrl}/subcategories/${subcategoryCode}`, payload, { headers: this.getAuthHeaders() });
  }

  deleteSubcategory(subcategoryCode: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/subcategories/${subcategoryCode}`, { headers: this.getAuthHeaders() });
  }
}
