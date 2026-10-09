import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { DashboardBooking, DashboardSummary, summarizeDashboardBookings } from './dashboard-data';
import { environment } from '../../../../environments/environment';

type DashboardSection = 'overview' | 'history' | 'settings';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnDestroy {
  protected readonly authService = inject(AuthService);
  protected readonly router = inject(Router);
  protected readonly http = inject(HttpClient);
  protected readonly section = signal<DashboardSection>('overview');
  protected readonly menuOpen = signal(false);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly childRouteActive = signal(false);
  protected readonly dashboardSummary = signal<DashboardSummary>({
    requestsSent: 0,
    activeJobs: 0,
    completedJobs: 0,
    bookings: [],
    recentActivities: [],
  });
  protected readonly selectedBooking = signal<DashboardBooking | null>(null);
  protected readonly reviewRating = signal(0);
  protected readonly reviewText = signal('');
  protected readonly reviewSubmittedFor = signal<string | null>(null);
  protected readonly reviewSaving = signal(false);
  protected readonly bookingActionId = signal<string | null>(null);
  protected readonly bookingActionError = signal('');
  protected readonly bookingActionMessage = signal('');
  protected customerName = '';
  protected customerLocation = '';
  protected customerAddress = '';
  protected profileSaving = signal(false);
  protected profileMessage = signal('');
  private bookingRefreshTimer?: ReturnType<typeof setInterval>;

  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.updateChildRouteState();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateChildRouteState());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const requestedSection = params.get('section');
      if (requestedSection === 'history' || requestedSection === 'settings') {
        this.section.set(requestedSection);
      } else {
        this.section.set('overview');
      }

      void this.loadDashboardData();
    });

    void this.loadCustomerProfile();
    this.bookingRefreshTimer = setInterval(() => void this.loadDashboardData(), 5000);
  }

  private async loadCustomerProfile(): Promise<void> {
    const userId = this.authService.user()?.id;
    if (!userId) return;
    const profile = await this.authService.getProfile(userId);
    if (!profile) return;
    this.customerName = profile.name;
    this.customerLocation = profile.location;
    this.customerAddress = profile.address;
  }

  ngOnDestroy(): void {
    if (this.bookingRefreshTimer) clearInterval(this.bookingRefreshTimer);
  }

  private async loadDashboardData(): Promise<void> {
    const userId = this.authService.user()?.id;
    if (!userId) {
      this.dashboardSummary.set({
        requestsSent: 0,
        activeJobs: 0,
        completedJobs: 0,
        bookings: [],
        recentActivities: [],
      });
      return;
    }

    try {
      const bookings = await firstValueFrom(
        this.http.get<DashboardBooking[]>(`${environment.apiUrl}/bookings/user/${userId}`),
      );

      this.dashboardSummary.set(summarizeDashboardBookings(bookings ?? []));
      const selectedId = this.selectedBooking()?._id;
      if (selectedId) {
        this.selectedBooking.set((bookings ?? []).find((booking) => booking._id === selectedId) ?? null);
      }
    } catch {
      this.dashboardSummary.set({
        requestsSent: 0,
        activeJobs: 0,
        completedJobs: 0,
        bookings: [],
        recentActivities: [],
      });
    }
  }

  private updateChildRouteState(): void {
    this.childRouteActive.set(this.route.firstChild !== null);
  }

  protected formatDate(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';

    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  protected formatPrice(value: number): string {
    return `₹${value.toLocaleString('en-IN')}`;
  }

  protected canCancelBooking(booking: DashboardBooking): boolean {
    return ['Request Sent', 'Accepted', 'On the Way', 'Arrived', 'Job Started'].includes(
      booking.status,
    );
  }

  protected selectBooking(booking: DashboardBooking): void {
    this.selectedBooking.set(booking);
    this.reviewRating.set(0);
    this.reviewText.set('');
    this.reviewSubmittedFor.set(null);
    this.bookingActionError.set('');
    this.bookingActionMessage.set('');
  }

  protected closeBookingSummary(): void {
    this.selectedBooking.set(null);
  }

  protected getCancellationDetails(booking: DashboardBooking): {
    feePercent: number;
    feeAmount: number;
    refundAmount: number;
  } {
    let feePercent = 100;
    if (!['On the Way', 'Arrived', 'Job Started'].includes(booking.status)) {
      const [year, month, day] = booking.bookingDate.split('-').map(Number);
      const [hour, minute] = booking.bookingTime.split(':').map(Number);
      const offset = booking.timeZoneOffsetMinutes ?? 0;
      const pickupAt =
        Date.UTC(year, month - 1, day, hour, minute) + offset * 60_000;
      const hoursUntilPickup = (pickupAt - Date.now()) / 3_600_000;
      feePercent = !Number.isFinite(pickupAt)
        ? 100
        : hoursUntilPickup > 24
          ? 0
          : hoursUntilPickup > 1
            ? 50
            : 100;
    }
    const feeAmount = Math.round((booking.totalPrice * feePercent) / 100);
    return {
      feePercent,
      feeAmount,
      refundAmount: Math.max(0, booking.totalPrice - feeAmount),
    };
  }

  protected async cancelBooking(booking: DashboardBooking): Promise<void> {
    if (this.bookingActionId()) return;
    const cancellation = this.getCancellationDetails(booking);
    const message =
      `Cancel this booking? A ${cancellation.feePercent}% fee ` +
      `(${this.formatPrice(cancellation.feeAmount)}) applies. ` +
      `The recorded refund will be ${this.formatPrice(cancellation.refundAmount)}.`;
    if (!window.confirm(message)) return;

    this.bookingActionId.set(booking._id);
    this.bookingActionError.set('');
    this.bookingActionMessage.set('');
    try {
      await firstValueFrom(
        this.http.request<{ message: string; id: string }>(
          'DELETE',
          `${environment.apiUrl}/bookings/${booking._id}`,
          { body: { reason: 'Cancelled by the customer' } },
        ),
      );
      await this.loadDashboardData();
      this.bookingActionMessage.set('Booking cancelled. The cancellation and refund are recorded.');
    } catch (error) {
      this.bookingActionError.set(
        error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message
          : 'Could not cancel the booking. Please try again.',
      );
    } finally {
      this.bookingActionId.set(null);
    }
  }

  protected async confirmCompletion(booking: DashboardBooking, confirmed: boolean): Promise<void> {
    if (this.bookingActionId()) return;
    const confirmationMessage = confirmed
      ? 'Confirm that the worker completed this job?'
      : 'Report that the job is not complete? A simulated full refund will be recorded.';
    if (!window.confirm(confirmationMessage)) return;

    this.bookingActionId.set(booking._id);
    this.bookingActionError.set('');
    this.bookingActionMessage.set('');
    try {
      const response = await firstValueFrom(
        this.http.post<{ status: string; paymentStatus: string }>(
          `${environment.apiUrl}/bookings/${booking._id}/confirm-completion`,
          { confirmed },
        ),
      );
      await this.loadDashboardData();
      this.bookingActionMessage.set(
        confirmed
          ? 'Job completion confirmed.'
          : `Job marked as not complete. A simulated full refund was recorded (${response.paymentStatus}).`,
      );
    } catch (error) {
      this.bookingActionError.set(
        error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message
          : 'Could not save your completion response. Please try again.',
      );
    } finally {
      this.bookingActionId.set(null);
    }
  }

  protected async submitBookingReview(booking: DashboardBooking): Promise<void> {
    const providerId = booking.providerId?._id;
    if (
      booking.status !== 'Completed' ||
      !providerId ||
      this.reviewRating() === 0 ||
      !this.reviewText().trim() ||
      this.reviewSaving()
    ) {
      return;
    }

    this.reviewSaving.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/bookings/${booking._id}/reviews`, {
          providerId,
          rating: this.reviewRating(),
          reviewText: this.reviewText().trim(),
        }),
      );
      this.reviewSubmittedFor.set(booking._id);
    } finally {
      this.reviewSaving.set(false);
    }
  }

  protected async saveCustomerProfile(): Promise<void> {
    const userId = this.authService.user()?.id;
    if (!userId || !this.customerName.trim() || !this.customerLocation.trim() || !this.customerAddress.trim()) {
      this.profileMessage.set('Name, location, and address are required.');
      return;
    }

    this.profileSaving.set(true);
    this.profileMessage.set('');
    const profile = await this.authService.updateProfile(userId, {
      name: this.customerName.trim(),
      location: this.customerLocation.trim(),
      address: this.customerAddress.trim(),
    });
    this.profileSaving.set(false);
    this.profileMessage.set(profile ? 'Profile updated.' : 'Could not update profile.');
  }

  protected setSection(section: DashboardSection): void {
    this.section.set(section);
    this.menuOpen.set(false);
    this.router.navigate(['/dashboard'], {
      queryParams: section === 'overview' ? {} : { section },
    });
  }

  protected toggleMenu(): void {
    this.menuOpen.update((isOpen) => !isOpen);
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((isCollapsed) => !isCollapsed);
  }

  protected continueRequest(): void {
    this.router.navigateByUrl('/dashboard/carrier');
  }

  protected logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/');
  }
}
