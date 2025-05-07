import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface AuthResponse {
  status: string;
  message: string;
  user_data: {
    email: string;
    role: string;
    recieve_offers?: boolean;
    id?: number;
  };
  tokens: {
    access: string;
    refresh: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface StoredUser {
    email: string;
    role: string;
    id?: number;
    recieve_offers?: boolean;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  receive_offers: boolean;
}

export interface RegisterResponse {
    status: string;
    message: string;
    user_data: StoredUser;
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
    return this.http.post<AuthResponse>(loginUrl, credentials, this.httpOptions);
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
        return data ? JSON.parse(data) : null;
    } catch (e) {
        this.clearAuthData();
        return null;
    }
  }

  getCurrentUserRole(): string | null {
    const userData = this.getUserData();
    return userData?.role ?? null;
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  clearAuthData(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    console.log('Datos de autenticación limpiados.');
  }

  logout(): void {
    this.clearAuthData();
    console.log('Usuario deslogueado.');
  }
}
