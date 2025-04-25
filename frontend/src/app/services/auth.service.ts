import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

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
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = 'http://localhost:8100/api';

  private readonly ACCESS_TOKEN_KEY = 'accessToken';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private readonly USER_DATA_KEY = 'userData';

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

  storeTokens(access: string, refresh: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, access);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refresh);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  storeUserData(userData: StoredUser): void {
    localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(userData));
  }

  getUserData(): StoredUser | null {
    const data = localStorage.getItem(this.USER_DATA_KEY);
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

  clearAuthData(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_DATA_KEY);
  }

  logout(): void {
    this.clearAuthData();
  }
}
