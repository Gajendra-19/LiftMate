import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'worker';
  location?: string;
  address?: string;
}

export type UserRole = 'customer' | 'worker';

export interface CustomerProfile {
  _id: string;
  name: string;
  email: string;
  role: 'customer' | 'worker';
  location: string;
  address: string;
}

export interface WorkerProfilePayload {
  kind: 'Individual' | 'Team';
  phone: number | null;
  teamName: string;
  teamSize: number;
  serviceArea: string;
  equipment: string;
  capacity: number;
  rate: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userState = signal<StoredUser | null>(null);
  private readonly tokenState = signal<string | null>(null);
  readonly user = this.userState.asReadonly();
  readonly isLoggedIn = () => this.userState() !== null && this.tokenState() !== null;
  readonly isCustomer = () => this.userState()?.role === 'customer';
  readonly isWorker = () => this.userState()?.role === 'worker';
  authError: 'invalid' | 'network' | null = null;

  constructor(private readonly http: HttpClient) {}

  async register(
    name: string,
    email: string,
    password: string,
    role: 'customer' | 'worker' = 'customer',
    workerProfile?: WorkerProfilePayload,
  ): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ _id: string; name: string; email: string; role: UserRole; token?: string }>(
          `${environment.apiUrl}/auth/signup`,
          { name, email, password, role, workerProfile },
        ),
      );

      const user: StoredUser = {
        id: response._id,
        name: response.name,
        email: response.email,
        role: response.role,
      };

      if (!this.isValidUser(user)) return false;
      this.tokenState.set(response.token ?? null);
      this.userState.set(user);
      return true;
    } catch {
      return false;
    }
  }

  async getProfile(userId: string): Promise<CustomerProfile | null> {
    try {
      return await firstValueFrom(
        this.http.get<CustomerProfile>(`${environment.apiUrl}/auth/profile/${userId}`),
      );
    } catch {
      return null;
    }
  }

  async updateProfile(
    userId: string,
    profile: Pick<CustomerProfile, 'name' | 'location' | 'address'>,
  ): Promise<CustomerProfile | null> {
    try {
      const updated = await firstValueFrom(
        this.http.patch<CustomerProfile>(`${environment.apiUrl}/auth/profile/${userId}`, profile),
      );
      const current = this.userState();
      if (current) {
        const nextUser = { ...current, name: updated.name };
        this.userState.set(nextUser);
      }
      return updated;
    } catch {
      return null;
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    this.authError = null;
    try {
      const response = await firstValueFrom(
        this.http.post<{ _id: string; name: string; email: string; role: UserRole; token?: string }>(
          `${environment.apiUrl}/auth/login`,
          { email, password },
        ),
      );

      const user: StoredUser = {
        id: response._id,
        name: response.name,
        email: response.email,
        role: response.role,
      };

      if (!this.isValidUser(user)) return false;
      this.tokenState.set(response.token ?? null);
      this.userState.set(user);
      return true;
    } catch (error) {
      this.authError = error instanceof HttpErrorResponse && error.status === 0 ? 'network' : 'invalid';
      return false;
    }
  }

  logout(): void {
    this.tokenState.set(null);
    this.userState.set(null);
  }

  token(): string | null {
    return this.tokenState();
  }

  homeUrl(): '/dashboard' | '/provider' {
    return this.isWorker() ? '/provider' : '/dashboard';
  }

  resolveReturnUrl(requestedUrl: string | null): '/dashboard' | '/provider' | string {
    if (!requestedUrl || !requestedUrl.startsWith('/') || requestedUrl.startsWith('//')) {
      return this.homeUrl();
    }

    if (this.isCustomer() && (requestedUrl === '/dashboard' || requestedUrl.startsWith('/dashboard?'))) {
      return requestedUrl;
    }

    if (this.isWorker() && requestedUrl === '/provider') {
      return requestedUrl;
    }

    return this.homeUrl();
  }

  private isValidUser(user: Partial<StoredUser> | null): user is StoredUser {
    return Boolean(
      user &&
        typeof user.id === 'string' &&
        typeof user.name === 'string' &&
        typeof user.email === 'string' &&
        (user.role === 'customer' || user.role === 'worker'),
    );
  }
}
