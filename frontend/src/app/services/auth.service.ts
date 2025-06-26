import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface BranchInfoForUser {
  branch_id: number;
  branch_code: string;
  name: string;
}

export interface UserData {
  id: number;
  email: string;
  role: string;
  name?: string;
  branch?: BranchInfoForUser;
  is_first_time_login?: boolean;
  recieve_offers?: boolean;
}

export interface AuthResponse {
  status: string;
  message: string;
  user_data: UserData;
  tokens: {
    access: string;
    refresh: string;
  };
}
export interface LoginCredentials {
  email: string;
  password: string;
}

export type StoredUser = UserData;
export interface RegisterCredentials {
  email: string;
  password: string;
  receive_offers: boolean;
}

export interface RegisterResponse {
  status: string;
  message: string;
  user_data: UserData;
}
export interface RefreshTokenResponse {
  access: string;
  refresh?: string;
}
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8100/api';

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient) { }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    const loginUrl = `${this.apiUrl}/user/login`;
    return this.http.post<AuthResponse>(loginUrl, credentials, this.httpOptions).pipe(
      tap(response => {
        if (response && response.status === 'success' && response.tokens && response.user_data) {
          if (typeof response.user_data.id !== 'number') {
            console.error('AuthService: El ID de usuario no fue recibido o no es un número en la respuesta del login.', response.user_data);
          }
          this.storeTokens(response.tokens.access, response.tokens.refresh);
          this.storeUserData(response.user_data);
        }
      })
    );
  }

  registerClient(data: RegisterCredentials): Observable<RegisterResponse> {
    const registerUrl = `${this.apiUrl}/user/register-client`;
    return this.http.post<RegisterResponse>(registerUrl, data, this.httpOptions);
  }

  storeAccessToken(accessToken: string): void {
    localStorage.setItem('accessToken', accessToken);
  }

  storeRefreshToken(refreshToken: string): void {
    localStorage.setItem('refreshToken', refreshToken);
  }

  storeTokens(access: string, refresh: string): void {
    this.storeAccessToken(access);
    this.storeRefreshToken(refresh);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  refreshToken(): Observable<RefreshTokenResponse> {
    const currentRefreshToken = this.getRefreshToken();

    if (!currentRefreshToken) {
      return throwError(() => new Error('No hay token de refresco disponible.'));
    }

    const refreshUrl = `${this.apiUrl}/user/token-refresh`;
    return this.http.post<RefreshTokenResponse>(refreshUrl, { refresh: currentRefreshToken }, this.httpOptions)
      .pipe(
        tap((response: RefreshTokenResponse) => {
          this.storeAccessToken(response.access);
          if (response.refresh) {
            this.storeRefreshToken(response.refresh);
          }
          console.log('Tokens actualizados después del refresco.');
        })
      );
  }

  storeUserData(userData: StoredUser): void {
    localStorage.setItem('userData', JSON.stringify(userData));
  }

  getUserData(): StoredUser | null {
    const data = localStorage.getItem('userData');
    try {
      return data ? JSON.parse(data) as StoredUser : null;
    } catch (e) {
      console.error('Error al parsear userData de localStorage:', e);
      this.clearAuthData();
      return null;
    }
  }

  getCurrentUserRole(): string | null {
    const userData = this.getUserData();
    return userData?.role ?? null;
  }

  getCurrentUserBranchInfo(): BranchInfoForUser | null {
    const userData = this.getUserData();
    return userData?.branch ?? null;
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  clearAuthData(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('selectedBranchCode');
    localStorage.removeItem('cart_items');
    localStorage.removeItem('shipping_info');
    localStorage.removeItem('webpay_payment_status');
    localStorage.removeItem('webpay_order_id_pending');
    localStorage.removeItem('selectedCurrency');

    console.log('Datos de autenticación y sesión limpiados completamente.');
  }

  logout(): void {
    this.clearAuthData();
  }
}
