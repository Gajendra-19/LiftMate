import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';
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
  paymentStatus: string;
  worker: string;
  images: BookingImageResponse[];
}

interface BookingImageResponse {
  name: string;
  contentType: string;
  dataUrl: string;
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
  paymentStatus?: string;
  images?: BookingImageResponse[];
  createdAt?: string;
  status?:
    | 'Request Sent'
    | 'Accepted'
    | 'On the Way'
    | 'Arrived'
    | 'Job Started'
    | 'Awaiting Customer Confirmation'
    | 'Completed'
    | 'Completion Disputed'
    | 'Cancelled';
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

interface WorkerTeam {
  id: string;
  name: string;
  inviteCode: string | null;
  isCreator: boolean;
  canManageMembers: boolean;
  members: {
    userId: string;
    providerId: string;
    name: string;
    role: 'Admin' | 'Member';
    joinedAt: string;
  }[];
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
  protected readonly profileLoading = signal(true);
  protected readonly profileError = signal('');
  protected readonly onboardingStep = signal<'choose' | 'form'>('form');
  protected profileKind: 'Individual' | 'Team' = 'Individual';
  protected profileName = '';
  protected settingsName = '';
  protected profilePhone: number | null = null;
  protected teamName = '';
  protected teamSize: number | null = null;
  protected serviceArea = '';
  protected equipment = '';
  protected capacity: number | null = null;
  protected rate: number | null = null;
  protected teamMode: 'create' | 'join' | 'manage' = 'create';
  protected joinCode = '';
  protected team = signal<WorkerTeam | null>(null);
  protected teamSaving = signal(false);
  protected teamError = signal('');
  protected teamMessage = signal('');
  protected teamNameInput = '';
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
  protected readonly requestState = signal<
    | 'New request'
    | 'Accepted'
    | 'Rejected'
    | 'Awaiting Customer Confirmation'
    | 'Completion Disputed'
    | 'Completed'
  >('New request');
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
    void this.loadTeam();
    void this.loadRequest(userId);
    void this.loadReviews(userId);
    this.requestRefreshTimer = setInterval(() => void this.loadRequest(userId), 5000);
  }

  ngOnDestroy(): void {
    if (this.requestRefreshTimer) clearInterval(this.requestRefreshTimer);
  }

  private async loadTeam(): Promise<void> {
    try {
      const team = await firstValueFrom(
        this.http.get<WorkerTeam | null>(`${environment.apiUrl}/providers/team`),
      );
      this.team.set(team);
      this.teamError.set('');
    } catch {
      this.teamError.set('Could not load your team. Please refresh and try again.');
    }
  }

  protected async createOrJoinTeam(): Promise<void> {
    if (this.teamSaving()) return;
    this.teamSaving.set(true);
    this.teamError.set('');
    this.teamMessage.set('');
    try {
      const team =
        this.teamMode === 'create'
          ? await firstValueFrom(
              this.http.post<WorkerTeam>(`${environment.apiUrl}/providers/team`, {
                name: this.teamNameInput,
              }),
            )
          : await firstValueFrom(
              this.http.post<WorkerTeam>(`${environment.apiUrl}/providers/team/join`, {
                inviteCode: this.joinCode,
              }),
            );
      this.team.set(team);
      this.joinCode = '';
      this.teamNameInput = team.name;
      this.teamMessage.set(
        this.teamMode === 'create'
          ? 'Team created. Share the invite code with your crew.'
          : 'You joined the team.',
      );
    } catch (error) {
      this.teamError.set(
        this.getTeamError(error, 'Could not update your team. Please try again.'),
      );
    } finally {
      this.teamSaving.set(false);
    }
  }

  protected async updateTeamMemberRole(userId: string, role: 'Admin' | 'Member'): Promise<void> {
    if (this.teamSaving()) return;
    this.teamSaving.set(true);
    this.teamError.set('');
    this.teamMessage.set('');
    try {
      const team = await firstValueFrom(
        this.http.patch<WorkerTeam>(
          `${environment.apiUrl}/providers/team/members/${userId}/role`,
          { role },
        ),
      );
      this.team.set(team);
      this.teamMessage.set('Team member role updated.');
    } catch (error) {
      this.teamError.set(
        this.getTeamError(error, 'Could not update the team member role. Please try again.'),
      );
      await this.loadTeam();
    } finally {
      this.teamSaving.set(false);
    }
  }

  protected async removeTeamMember(userId: string, name: string): Promise<void> {
    if (this.teamSaving() || !window.confirm(`Remove ${name} from this team?`)) return;
    this.teamSaving.set(true);
    this.teamError.set('');
    this.teamMessage.set('');
    try {
      const team = await firstValueFrom(
        this.http.delete<WorkerTeam>(`${environment.apiUrl}/providers/team/members/${userId}`),
      );
      this.team.set(team);
      this.teamMessage.set(`${name} was removed from the team.`);
    } catch (error) {
      this.teamError.set(
        this.getTeamError(error, 'Could not remove the team member. Please try again.'),
      );
      await this.loadTeam();
    } finally {
      this.teamSaving.set(false);
    }
  }

  protected async leaveTeam(): Promise<void> {
    if (this.teamSaving()) return;
    this.teamSaving.set(true);
    this.teamError.set('');
    this.teamMessage.set('');
    try {
      await firstValueFrom(this.http.delete(`${environment.apiUrl}/providers/team`));
      this.team.set(null);
      this.teamMessage.set('You left the team.');
      this.teamMode = 'create';
    } catch (error) {
      this.teamError.set(this.getTeamError(error, 'Could not leave the team. Please try again.'));
    } finally {
      this.teamSaving.set(false);
    }
  }

  private getTeamError(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
      ? error.error.message
      : fallback;
  }

  private async loadProfile(userId: string): Promise<void> {
    this.profileLoading.set(true);
    this.profileError.set('');
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
      this.settingsName = profile.name;
      this.profilePhone = profile.phone;
      this.serviceArea = profile.serviceArea;
      this.equipment = profile.equipment.join(', ');
      this.capacity = profile.capacity;
      this.rate = profile.price;
      this.teamNameInput = profile.teamName;
      this.earnings.set(profile.jobs * profile.price);
      this.rating.set(profile.rating);
      this.available.set(profile.available);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.profile.set(null);
        this.profileRegistered.set(false);
      } else {
        this.profileError.set('Could not load your worker profile. Check your connection and try again.');
      }
    } finally {
      this.profileLoading.set(false);
    }
  }

  protected retryLoadProfile(): void {
    const userId = this.authService.user()?.id;
    if (userId && !this.profileLoading()) void this.loadProfile(userId);
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
      if (bookingStatus === 'Awaiting Customer Confirmation') {
        this.requestState.set('Awaiting Customer Confirmation');
        this.activeStatus.set('Completed');
      } else if (bookingStatus === 'Completion Disputed') {
        this.requestState.set('Completion Disputed');
        this.activeStatus.set('Completed');
      } else if (bookingStatus === 'Completed') {
        this.requestState.set('Completed');
        this.activeStatus.set('Completed');
      } else if (bookingStatus === 'Accepted' || bookingStatus === 'On the Way' || bookingStatus === 'Arrived' || bookingStatus === 'Job Started') {
        this.requestState.set('Accepted');
        this.activeStatus.set(bookingStatus);
      } else if (bookingStatus === 'Cancelled') {
        this.requestState.set('Rejected');
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
              images: booking.images || [],
            }
          : null,
      );
    } catch {
      this.bookings.set([]);
      this.request.set(null);
    }
  }

  protected async acceptRequest(): Promise<void> {
    const request = this.request();
    if (!request) return;
    if (await this.updateBookingStatus(request.id, 'Accepted')) {
      this.requestState.set('Accepted');
      this.activeStatus.set('Accepted');
    }
  }

  protected async rejectRequest(): Promise<void> {
    const request = this.request();
    if (!request) return;
    if (await this.updateBookingStatus(request.id, 'Cancelled')) {
      this.requestState.set('Rejected');
    }
  }

  protected async advanceJob(): Promise<void> {
    const request = this.request();
    if (!request) return;
    const nextIndex = this.statuses.indexOf(this.activeStatus()) + 1;
    const nextStatus = this.statuses[nextIndex];
    if (nextStatus === 'Completed') {
      if (await this.updateBookingStatus(request.id, 'Awaiting Customer Confirmation')) {
        this.requestState.set('Awaiting Customer Confirmation');
        this.activeStatus.set('Completed');
      }
    } else if (nextStatus) {
      if (await this.updateBookingStatus(request.id, nextStatus)) {
        this.activeStatus.set(nextStatus);
      }
    }
  }

  private async updateBookingStatus(
    bookingId: string,
    status:
      | 'Accepted'
      | 'On the Way'
      | 'Arrived'
      | 'Job Started'
      | 'Awaiting Customer Confirmation'
      | 'Cancelled',
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.put(`${environment.apiUrl}/bookings/${bookingId}`, { status }),
      );
      this.bookings.update((bookings) =>
        bookings.map((booking) =>
          booking._id === bookingId ? { ...booking, status } : booking,
        ),
      );
      return true;
    } catch {
      return false;
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
    const name = this.settingsName.trim();
    if (
      !current ||
      !userId ||
      name.length < 2 ||
      !this.serviceArea.trim() ||
      !this.equipment.trim() ||
      !this.capacity ||
      !this.rate
    ) {
      return;
    }

    try {
      const saved = await firstValueFrom(
        this.http.patch<WorkerProfile>(`${environment.apiUrl}/providers/profile/${userId}/settings`, {
          name,
          serviceArea: this.serviceArea.trim(),
          equipment: this.equipment.trim(),
          capacity: this.capacity,
          rate: this.rate,
        }),
      );
      this.profile.set({ ...current, ...saved, available: this.available() });
      this.profileName = saved.name;
      this.settingsName = saved.name;
      this.authService.updateUserName(saved.name);
      this.team.update((team) =>
        team
          ? {
              ...team,
              members: team.members.map((member) =>
                member.userId === userId ? { ...member, name: saved.name } : member,
              ),
            }
          : null,
      );
      this.profileRegistered.set(true);
    } catch {
      return;
    }
    this.activeSection = 'request';
  }

}
