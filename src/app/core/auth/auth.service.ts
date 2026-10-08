import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'worker';
  location?: string;
  address?: string;
}

export type UserRole = 'customer' | 'worker';
export type AuthError = 'invalid' | 'network' | 'rate-limited' | 'demo-unavailable' | null;
export type DemoAccountRole = 'customer' | 'individual-worker' | 'team-worker';

interface StoredSession {
  user: StoredUser;
  token: string;
}

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
  authError: AuthError = null;

  constructor(
    private readonly http: HttpClient,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    if (isPlatformBrowser(platformId)) this.restoreSession();
  }

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
      this.persistSession();
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
        this.persistSession();
      }

      return updated;
    } catch {
      return null;
    }
  }

  updateUserName(name: string): void {
    const current = this.userState();
    if (current) {
      this.userState.set({ ...current, name });
      this.persistSession();
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
      this.persistSession();
      return true;
    } catch (error) {
      this.authError =
        error instanceof HttpErrorResponse
          ? error.status === 0
            ? 'network'
            : error.status === 429
              ? 'rate-limited'
              : 'invalid'
          : 'invalid';
      return false;
    }
  }

  async loginAsDemo(role: DemoAccountRole): Promise<boolean> {
    this.authError = null;
    try {
      const response = await firstValueFrom(
        this.http.post<{ _id: string; name: string; email: string; role: UserRole; token?: string }>(
          `${environment.apiUrl}/auth/demo-login`,
          { role },
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
      this.persistSession();
      return true;
    } catch (error) {
      this.authError =
        error instanceof HttpErrorResponse
          ? error.status === 0
            ? 'network'
            : error.status === 429
              ? 'rate-limited'
              : error.status === 404 || error.status === 503
                ? 'demo-unavailable'
                : 'invalid'
          : 'invalid';
      return false;
    }
  }

  logout(): void {
    this.tokenState.set(null);
    this.userState.set(null);
    this.clearSavedSession();
  }

  token(): string | null {
    return this.tokenState();
  }

  private restoreSession(): void {
    let savedSession: string | null;
    try {
      localStorage.removeItem('liftmate.auth');
    } catch (error) {
      console.error('Could not remove the previous LiftMate session:', error);
    }

    try {
      savedSession = sessionStorage.getItem('liftmate.auth');
    } catch (error) {
      console.error('Could not restore the current LiftMate browser session:', error);
      return;
    }
    if (!savedSession) return;

    try {
      const session: unknown = JSON.parse(savedSession);
      if (!this.isValidSession(session)) {
        this.clearSavedSession();
        return;
      }
      this.userState.set(session.user);
      this.tokenState.set(session.token);
    } catch (error) {
      console.error('Could not parse the saved LiftMate session:', error);
      this.clearSavedSession();
    }
  }

  private persistSession(): void {
    const user = this.userState();
    const token = this.tokenState();
    if (!user || !token) return;

    try {
      sessionStorage.setItem('liftmate.auth', JSON.stringify({ user, token }));
    } catch (error) {
      console.error('Could not save the current LiftMate browser session:', error);
    }
  }

  private clearSavedSession(): void {
    try {
      sessionStorage.removeItem('liftmate.auth');
    } catch (error) {
      console.error('Could not clear the current LiftMate browser session:', error);
    }
  }

  private isValidSession(value: unknown): value is StoredSession {
    if (!value || typeof value !== 'object') return false;
    const session = value as Partial<StoredSession>;
    if (!this.isValidUser(session.user) || typeof session.token !== 'string') return false;

    const encodedPayload = session.token.split('.')[1];
    if (!encodedPayload) return false;

    try {
      const base64Payload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '=');
      const payloadText = atob(paddedPayload);
      const payload: unknown = JSON.parse(payloadText);
      if (!payload || typeof payload !== 'object') return false;
      const claims = payload as { userId?: unknown; role?: unknown; exp?: unknown };
      return (
        claims.userId === session.user.id &&
        claims.role === session.user.role &&
        typeof claims.exp === 'number' &&
        claims.exp * 1000 > Date.now()
      );
    } catch {
      return false;
    }
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

  private isValidUser(user: Partial<StoredUser> | null | undefined): user is StoredUser {
    return Boolean(
      user &&
        typeof user.id === 'string' &&
        typeof user.name === 'string' &&
        typeof user.email === 'string' &&
        (user.role === 'customer' || user.role === 'worker'),
    );
  }
}
