import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'liftmate-user';
  private readonly userState = signal<StoredUser | null>(this.readUser());
  readonly user = this.userState.asReadonly();
  readonly isLoggedIn = () => this.userState() !== null;

  constructor(private readonly http: HttpClient) {}

  async register(name: string, email: string, password: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ _id: string; name: string; email: string; role: string }>(
          'http://localhost:5000/api/auth/signup',
          { name, email, password },
        ),
      );

      const user: StoredUser = {
        id: response._id,
        name: response.name,
        email: response.email,
        role: response.role,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(user));
      this.userState.set(user);
      return true;
    } catch {
      return false;
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ _id: string; name: string; email: string; role: string }>(
          'http://localhost:5000/api/auth/login',
          { email, password },
        ),
      );

      const user: StoredUser = {
        id: response._id,
        name: response.name,
        email: response.email,
        role: response.role,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(user));
      this.userState.set(user);
      return true;
    } catch {
      return false;
    }
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.userState.set(null);
  }

  private readUser(): StoredUser | null {
    const storedValue = localStorage.getItem(this.storageKey);
    if (!storedValue) return null;

    try {
      return JSON.parse(storedValue) as StoredUser;
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }
}
