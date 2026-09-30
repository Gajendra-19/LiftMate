import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

interface RequestCard {
  id: string;
  customer: string;
  load: string;
  pickup: string;
  drop: string;
  schedule: string;
  duration: number;
  weight: number;
  payment: number;
  paymentStatus: 'Pending' | 'Partial' | 'Paid';
  worker: string;
}

interface BookingResponse {
  _id: string;
  customerName?: string;
  description?: string;
  category?: string;
  pickupLocation?: string;
  deliveryLocation?: string;
  bookingDate?: string;
  bookingTime?: string;
  durationHours?: number;
  weight?: number;
  totalPrice?: number;
  paymentStatus?: 'Pending' | 'Partial' | 'Paid';
  createdAt?: string;
  status?: 'Request Sent' | 'Accepted' | 'On the Way' | 'Arrived' | 'Job Started' | 'Completed' | 'Cancelled';
}

interface LiftMateProfile {
  kind: 'Individual' | 'Team';
  name: string;
  phone: number | null;
  teamName: string;
  teamSize: number;
  serviceArea: string;
  equipment: string;
  capacity: number;
  rate: number;
}

interface WorkerProfile extends Omit<LiftMateProfile, 'equipment' | 'rate'> {
  id: string;
  teamMembers: string[];
  equipment: string[];
  price: number;
  jobs: number;
  rating: number;
  available: boolean;
}

interface WorkerReview {
  id: string;
  rating: number;
  reviewText: string;
  customerName: string;
  createdAt: string;
}

@Component({
  selector: 'app-provider-dashboard',
  imports: [FormsModule, DatePipe],
  templateUrl: './provider-dashboard.html',
  styleUrl: './provider-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderDashboard implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);
  protected readonly profile = signal<WorkerProfile | null>(null);
  protected readonly profileRegistered = signal(this.profile() !== null);
  protected readonly onboardingStep = signal<'choose' | 'form'>('form');
  protected profileKind: 'Individual' | 'Team' = 'Individual';
  protected profileName = '';
  protected profilePhone: number | null = null;
  protected teamName = '';
  protected teamSize: number | null = null;
  protected serviceArea = '';
  protected equipment = '';
  protected capacity: number | null = null;
  protected rate: number | null = null;
  protected teamMode: 'create' | 'join' | 'manage' = 'create';
  protected joinCode = '';
  protected teamMembers: string[] = [];
  protected activeSection: 'request' | 'team' | 'reviews' | 'settings' = 'request';
  protected available = signal(false);
  protected availabilitySaving = signal(false);
  protected availabilityError = signal('');
  protected reviews = signal<WorkerReview[]>([]);
  private requestRefreshTimer?: ReturnType<typeof setInterval>;

  protected chooseProfileKind(kind: 'Individual' | 'Team'): void {
    this.profileKind = kind;
    this.onboardingStep.set('form');
  }
  protected readonly request = signal<RequestCard | null>(null);
  private readonly bookings = signal<BookingResponse[]>([]);
  protected readonly requestState = signal<'New request' | 'Accepted' | 'Rejected' | 'Completed'>('New request');
  protected readonly activeStatus = signal<
    'Accepted' | 'On the Way' | 'Arrived' | 'Job Started' | 'Completed'
  >('Accepted');
  protected readonly earnings = signal(0);
  protected readonly rating = signal(0);
  protected readonly newRequestCount = computed(
    () => this.bookings().filter((booking) => booking.status === 'Request Sent').length,
  );
  protected readonly acceptedJobCount = computed(
    () =>
      this.bookings().filter((booking) =>
        ['Accepted', 'On the Way', 'Arrived', 'Job Started'].includes(booking.status ?? ''),
      ).length,
  );
  protected readonly completedJobCount = computed(
    () => this.bookings().filter((booking) => booking.status === 'Completed').length,
  );
  protected readonly monthlyEarnings = computed(() =>
    this.bookings()
      .filter((booking) => booking.status !== 'Cancelled')
      .reduce((total, booking) => total + (booking.totalPrice || 0), 0),
  );
  protected readonly statuses = [
    'Accepted',
    'On the Way',
    'Arrived',
    'Job Started',
    'Completed',
  ] as const;

  ngOnInit(): void {
    const userId = this.authService.user()?.id;
    if (!userId || !this.authService.isWorker()) return;
    void this.loadProfile(userId);
    void this.loadRequest(userId);
    void this.loadReviews(userId);
    this.requestRefreshTimer = setInterval(() => void this.loadRequest(userId), 5000);
  }

  ngOnDestroy(): void {
    if (this.requestRefreshTimer) clearInterval(this.requestRefreshTimer);
  }

  private async loadProfile(userId: string): Promise<void> {
    try {
      const profile = await firstValueFrom(
        this.http.get<WorkerProfile>(`${environment.apiUrl}/providers/profile/${userId}`),
      );
      this.profile.set(profile);
        const hasCompleteDetails = Boolean(
          profile.serviceArea.trim() &&
            profile.equipment.length &&
            profile.capacity > 0 &&
            profile.price > 0,
        );
        this.profileRegistered.set(hasCompleteDetails);
      this.profileKind = profile.kind;
      this.teamName = profile.teamName;
      this.teamSize = profile.teamSize;
      this.profileName = profile.name;
      this.profilePhone = profile.phone;
      this.serviceArea = profile.serviceArea;
      this.equipment = profile.equipment.join(', ');
      this.capacity = profile.capacity;
      this.rate = profile.price;
      this.teamMembers = profile.teamMembers;
      this.earnings.set(profile.jobs * profile.price);
      this.rating.set(profile.rating);
      this.available.set(profile.available);
    } catch {
      this.profile.set(null);
      this.profileRegistered.set(false);
    }
  }

  private async loadReviews(userId: string): Promise<void> {
    try {
      const reviews = await firstValueFrom(
        this.http.get<WorkerReview[]>(`${environment.apiUrl}/providers/profile/${userId}/reviews`),
      );
      this.reviews.set(reviews ?? []);
    } catch {
      this.reviews.set([]);
    }
  }

  protected async toggleAvailability(): Promise<void> {
    const userId = this.authService.user()?.id;
    if (!userId || this.availabilitySaving()) return;

    const previousValue = this.available();
    const nextValue = !previousValue;
    this.available.set(nextValue);
    this.availabilitySaving.set(true);
    this.availabilityError.set('');
    try {
      const response = await firstValueFrom(
        this.http.patch<{ available: boolean }>(
          `${environment.apiUrl}/providers/profile/${userId}/availability`,
          { available: nextValue },
        ),
      );
      this.available.set(response.available);
      const current = this.profile();
      if (current) this.profile.set({ ...current, available: response.available });
    } catch {
      this.available.set(previousValue);
      this.availabilityError.set('Could not save availability. Please try again.');
    } finally {
      this.availabilitySaving.set(false);
    }
  }

  protected logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/');
  }

  private async loadRequest(userId: string): Promise<void> {
    try {
      const bookings = await firstValueFrom(
        this.http.get<BookingResponse[]>(`${environment.apiUrl}/bookings/provider/${userId}`),
      );
      this.bookings.set(bookings ?? []);
      const booking = bookings[0];
      const bookingStatus = booking?.status;
      if (bookingStatus === 'Completed') {
        this.requestState.set('Completed');
        this.activeStatus.set('Completed');
      } else if (bookingStatus === 'Accepted' || bookingStatus === 'On the Way' || bookingStatus === 'Arrived' || bookingStatus === 'Job Started') {
        this.requestState.set('Accepted');
        this.activeStatus.set(bookingStatus);
      } else {
        this.requestState.set('New request');
      }
      this.request.set(
        booking
          ? {
              id: booking._id,
              customer: booking.customerName || 'Customer',
              load: booking.description || booking.category || 'Moving request',
              pickup: booking.pickupLocation || '',
              drop: booking.deliveryLocation || '',
              schedule: `${booking.bookingDate || ''} ${booking.bookingTime || ''}`.trim(),
              duration: booking.durationHours || 0,
              weight: booking.weight || 0,
              payment: booking.totalPrice || 0,
              paymentStatus: booking.paymentStatus || 'Pending',
              worker: this.profile()?.name || '',
            }
          : null,
      );
    } catch {
      this.bookings.set([]);
      this.request.set(null);
    }
  }

  protected acceptRequest(): void {
    const request = this.request();
    if (!request) return;
    void this.updateBookingStatus(request.id, 'Accepted');
    this.requestState.set('Accepted');
    this.activeStatus.set('Accepted');
  }

  protected rejectRequest(): void {
    const request = this.request();
    if (!request) return;
    void this.updateBookingStatus(request.id, 'Cancelled');
    this.requestState.set('Rejected');
  }

  protected advanceJob(): void {
    const request = this.request();
    if (!request) return;
    const nextIndex = this.statuses.indexOf(this.activeStatus()) + 1;
    const nextStatus = this.statuses[nextIndex];
    if (nextStatus) {
      void this.updateBookingStatus(request.id, nextStatus);
      this.activeStatus.set(nextStatus);
    }
  }

  private async updateBookingStatus(
    bookingId: string,
    status: 'Accepted' | 'On the Way' | 'Arrived' | 'Job Started' | 'Completed' | 'Cancelled',
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${environment.apiUrl}/bookings/${bookingId}`, { status }),
      );
      this.bookings.update((bookings) =>
        bookings.map((booking) =>
          booking._id === bookingId ? { ...booking, status } : booking,
        ),
      );
    } catch {
      return;
    }
  }

  protected resetRequest(): void {
    this.requestState.set('New request');
    this.activeStatus.set('Accepted');
  }

  protected registerAsLiftMate(): void {
    if (
      !this.profileName.trim() ||
      !this.profilePhone ||
      !this.serviceArea.trim() ||
      !this.equipment.trim() ||
      !this.capacity ||
      !this.rate ||
      (this.profileKind === 'Team' &&
        (!this.teamName.trim() || !this.teamSize || this.teamSize < 2 || this.teamSize > 5))
    )
      return;
    const profile = {
      kind: this.profileKind,
      name: this.profileName.trim(),
      phone: this.profilePhone,
      teamName: this.teamName.trim(),
      teamSize: this.teamSize || 1,
      serviceArea: this.serviceArea.trim(),
      equipment: this.equipment.trim(),
      capacity: this.capacity,
      rate: this.rate,
    };
    const userId = this.authService.user()?.id;
    if (!userId) return;
    void this.saveProfile(userId, profile);
  }

  private async saveProfile(userId: string, profile: LiftMateProfile): Promise<void> {
    try {
      const saved = await firstValueFrom(
        this.http.post<WorkerProfile>(`${environment.apiUrl}/providers/profile`, {
          userId,
          profile,
        }),
      );
      this.profile.set(saved);
      this.profileRegistered.set(true);
      this.available.set(saved.available);
    } catch {
      this.profileRegistered.set(false);
    }
  }

  protected async saveSettings(): Promise<void> {
    const current = this.profile();
    const userId = this.authService.user()?.id;
    if (!current || !userId || !this.serviceArea.trim() || !this.equipment.trim() || !this.capacity || !this.rate) {
      return;
    }

    try {
      const saved = await firstValueFrom(
        this.http.patch<WorkerProfile>(`${environment.apiUrl}/providers/profile/${userId}/settings`, {
          serviceArea: this.serviceArea.trim(),
          equipment: this.equipment.trim(),
          capacity: this.capacity,
          rate: this.rate,
        }),
      );
      this.profile.set({ ...current, ...saved, available: this.available() });
      this.profileRegistered.set(true);
    } catch {
      return;
    }
    this.activeSection = 'request';
  }

  protected createOrJoinTeam(): void {
    const current = this.profile();
    const userId = this.authService.user()?.id;
    if (!current || !userId) return;

    if (this.teamMode === 'join' && !this.joinCode.trim()) return;

    void this.saveProfile(userId, {
      kind: 'Team',
      name: current.name,
      phone: current.phone,
      teamName: this.teamName.trim(),
      teamSize: current.teamSize,
      serviceArea: current.serviceArea,
      equipment: current.equipment.join(', '),
      capacity: current.capacity,
      rate: current.price,
    });
  }

}
