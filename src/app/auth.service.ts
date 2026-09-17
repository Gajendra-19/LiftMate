import { Injectable, signal } from '@angular/core';

interface StoredUser {
  name: string;
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'liftmate-user';
  private readonly userState = signal<StoredUser | null>(this.readUser());
  readonly user = this.userState.asReadonly();
  readonly isLoggedIn = () => this.userState() !== null;

  register(name: string, email: string, password: string): void {
    const user = { name, email, password };
    localStorage.setItem(this.storageKey, JSON.stringify(user));
    this.userState.set(user);
  }

  login(email: string, password: string): boolean {
    const storedUser = this.readUser();
    if (storedUser && storedUser.email === email && storedUser.password === password) {
      this.userState.set(storedUser);
      return true;
    }

    if (!storedUser) {
      const user = { name: email.split('@')[0], email, password };
      localStorage.setItem(this.storageKey, JSON.stringify(user));
      this.userState.set(user);
      return true;
    }

    return false;
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
