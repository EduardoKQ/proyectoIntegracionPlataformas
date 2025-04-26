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

  storeTokens(access: string, refresh: string): void {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
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

  clearAuthData(): void {
    localStorage.clear();
  }

  logout(): void {
    this.clearAuthData();
  }
}
