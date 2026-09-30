import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth.service';
import { CarrierService } from './carrier.service';
import {
  BookingForm,
  BookingStatus,
  BookingView,
  CancellationPolicy,
  PaymentMethod,
  Provider,
  ProviderKind,
  SelectedFile,
  SortOption,
} from './carrier.types';
import { CarrierRequestComponent } from './components/carrier-request/carrier-request';
import { CarrierMatchingComponent } from './components/carrier-matching/carrier-matching';
import { CarrierProfileComponent } from './components/carrier-profile/carrier-profile';
import { CarrierSummaryComponent } from './components/carrier-summary/carrier-summary';
import { CarrierStatusComponent } from './components/carrier-status/carrier-status';
import { CarrierRatingComponent } from './components/carrier-rating/carrier-rating';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-carrier',
  imports: [
    CarrierRequestComponent,
    CarrierMatchingComponent,
    CarrierProfileComponent,
    CarrierSummaryComponent,
    CarrierStatusComponent,
    CarrierRatingComponent,
  ],
  templateUrl: './carrier.html',
  styleUrl: './carrier.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Carrier {
  protected readonly view = signal<BookingView>('request');
  protected readonly requestStep = signal<1 | 2 | 3>(1);
  protected readonly submitted = signal(false);
  protected readonly loading = signal(false);
  protected readonly selectedProvider = signal<Provider | null>(null);
  protected readonly selectedProfile = signal<Provider | null>(null);
  protected readonly bookingStatus = signal<BookingStatus>('Request Sent');
  protected readonly rating = signal(0);
  protected readonly review = signal('');
  protected readonly feedbackSubmitted = signal(false);
  protected readonly selectedFiles = signal<SelectedFile[]>([]);
  protected readonly paymentMethod = signal<PaymentMethod>('card');
  protected readonly paymentProcessing = signal(false);
  protected readonly paymentSuccess = signal(false);
  protected readonly lastBookingId = signal<string | null>(null);
  protected readonly cancelModalOpen = signal(false);
  protected readonly cancelPolicyMessage = signal('');

  protected readonly kindFilter = signal<'All' | ProviderKind>('All');
  protected readonly availabilityOnly = signal(false);
  protected readonly maxPrice = signal(2000);
  protected readonly maxDistance = signal(20);
  protected readonly minRating = signal(0);
  protected readonly minCapacity = signal(0);
  protected readonly sortOption = signal<SortOption>('recommended');

  protected readonly form = new FormGroup<BookingForm>({
    category: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)],
    }),
    weight: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(100000),
    ]),
    items: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(10000),
    ]),
    pickup: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(160)],
    }),
    delivery: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(160)],
    }),
    date: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    time: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    duration: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(24),
    ]),
    preferences: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(300)],
    }),
  });

  protected readonly filteredProviders = computed(() => {
    const weight = this.form.controls.weight.value ?? 0;
    const result = this.carrierService.filterProviders(
      this.maxPrice(),
      this.maxDistance(),
      this.minRating(),
      this.minCapacity(),
      this.kindFilter(),
      this.availabilityOnly(),
      weight,
    );

    return [...result].sort((a, b) => {
      switch (this.sortOption()) {
        case 'price':
          return a.price - b.price;
        case 'distance':
          return a.distance - b.distance;
        case 'rating':
          return b.rating - a.rating;
        default:
          return b.rating * 2 - b.distance / 10 - (a.rating * 2 - a.distance / 10);
      }
    });
  });

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly carrierService: CarrierService,
    private readonly http: HttpClient,
  ) {
    void this.prefillPickupAddress();
  }

  private async prefillPickupAddress(): Promise<void> {
    const userId = this.authService.user()?.id;
    if (!userId || this.form.controls.pickup.value.trim()) return;

    const profile = await this.authService.getProfile(userId);
    if (!profile) return;

    const pickup = [profile.address, profile.location].filter(Boolean).join(', ');
    if (pickup) this.form.controls.pickup.setValue(pickup);
  }

  protected get providers(): Provider[] {
    return this.carrierService.providers;
  }

  protected nextStep(): void {
    const step = this.requestStep();
    const controls =
      step === 1
        ? ['category', 'description', 'weight', 'items']
        : ['pickup', 'delivery', 'date', 'time', 'duration'];

    controls.forEach((controlName) =>
      this.form.controls[controlName as keyof BookingForm].markAsTouched(),
    );
    if (
      controls.some((controlName) => this.form.controls[controlName as keyof BookingForm].invalid)
    ) {
      return;
    }

    if (step === 2 && this.form.controls.date.value < new Date().toISOString().slice(0, 10)) {
      this.form.controls.date.setErrors({ pastDate: true });
      this.form.controls.date.markAsTouched();
      return;
    }

    this.requestStep.set((step + 1) as 1 | 2 | 3);
  }

  protected previousStep(): void {
    if (this.requestStep() > 1) {
      this.submitted.set(false);
      this.requestStep.update((step) => (step - 1) as 1 | 2 | 3);
    }
  }

  protected confirmBooking(): void {
    if (this.submitted()) return;
    this.submitted.set(true);
    this.loading.set(true);
    window.setTimeout(() => {
      this.loading.set(false);
      this.view.set('matching');
    }, 650);
  }

  protected selectProvider(provider: Provider): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/carrier' } });
      return;
    }
    this.selectedProvider.set(provider);
    this.view.set('summary');
  }

  protected viewProfile(provider: Provider): void {
    this.selectedProfile.set(provider);
    this.view.set('profile');
  }

  protected requestProfile(): void {
    const provider = this.selectedProfile();
    if (provider) this.selectProvider(provider);
  }

  protected editRequest(): void {
    this.submitted.set(false);
    this.loading.set(false);
    this.view.set('request');
    this.requestStep.set(3);
  }

  protected async confirmProviderBooking(): Promise<void> {
    if (this.bookingStatus() !== 'Request Sent') return;
    const provider = this.selectedProvider();
    if (!provider) return;
    if (this.paymentProcessing()) return;

    this.paymentProcessing.set(true);
    this.paymentSuccess.set(false);

    const user = this.authService.user();
    const payload = {
      userId: user?.id,
      providerId: provider.id,
      form: {
        category: this.form.controls.category.value,
        description: this.form.controls.description.value,
        weight: this.form.controls.weight.value,
        items: this.form.controls.items.value,
        pickup: this.form.controls.pickup.value,
        delivery: this.form.controls.delivery.value,
        date: this.form.controls.date.value,
        time: this.form.controls.time.value,
        duration: this.form.controls.duration.value,
        preferences: this.form.controls.preferences.value,
        totalPrice: provider.price,
        paymentMethod: this.paymentMethod(),
      },
    };

    try {
      const response = (await firstValueFrom(
        this.http.post<{ _id: string }>(`${environment.apiUrl}/bookings/create`, payload),
      )) as { _id: string };
      this.lastBookingId.set(response._id);
    } catch {
      this.paymentProcessing.set(false);
      this.paymentSuccess.set(false);
      this.bookingStatus.set('Request Sent');
      return;
    }

    window.setTimeout(() => {
      this.paymentProcessing.set(false);
      this.paymentSuccess.set(true);

      window.setTimeout(() => {
        this.paymentSuccess.set(false);
        this.view.set('status');

        this.router.navigate(['/dashboard'], { queryParams: { section: 'history' } });
      }, 2000);
    }, 2000);
  }

  protected getCancellationPolicy(): CancellationPolicy {
    const date = this.form.controls.date.value;
    const time = this.form.controls.time.value;

    if (!date || !time) {
      return {
        label: 'Policy applies once your pickup time is scheduled',
        feePercent: 0,
        description: 'Choose a booking date and time to calculate the applicable cancellation penalty.',
      };
    }

    const scheduledAt = new Date(`${date}T${time}:00`);
    const hoursUntil = (scheduledAt.getTime() - Date.now()) / 3600000;

    if (hoursUntil > 24) {
      return {
        label: 'Free cancellation',
        feePercent: 0,
        description: 'Cancel more than 24 hours before pickup and there is no penalty.',
      };
    }

    if (hoursUntil > 12) {
      return {
        label: '50% cancellation fee',
        feePercent: 50,
        description: 'Cancel between 12 and 24 hours before pickup and you will be charged 50% of the booking total.',
      };
    }

    return {
      label: '100% cancellation fee',
      feePercent: 100,
      description: 'Cancel within 12 hours of pickup or after dispatch, and the full amount is due.',
    };
  }

  protected advanceStatus(): void {
    const statuses = this.carrierService.getStatusFlow();
    const next = statuses[statuses.indexOf(this.bookingStatus()) + 1];
    if (next) this.bookingStatus.set(next);
  }

  protected cancelBooking(): void {
    const policy = this.getCancellationPolicy();
    const penaltyText =
      policy.feePercent === 0
        ? 'No charge will be applied.'
        : `A ${policy.feePercent}% cancellation fee will apply.`;

    this.cancelPolicyMessage.set(
      `${policy.label}: ${policy.description}\n\n${penaltyText}\n\nDo you want to cancel this request?`,
    );
    this.cancelModalOpen.set(true);
  }

  protected confirmCancelBooking(): void {
    this.cancelModalOpen.set(false);
    this.bookingStatus.set('Request Sent');
    this.selectedProvider.set(null);
    this.view.set('matching');
  }

  protected closeCancelModal(): void {
    this.cancelModalOpen.set(false);
  }

  protected setRating(value: number): void {
    this.rating.set(value);
  }

  protected async submitFeedback(): Promise<void> {
    if (this.rating() <= 0 || !this.review().trim()) return;

    const user = this.authService.user();
    const provider = this.selectedProvider();
    const bookingId = this.lastBookingId();

    if (!user?.id || !provider || !bookingId) {
      this.feedbackSubmitted.set(true);
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/bookings/${bookingId}/reviews`, {
          userId: user.id,
          providerId: provider.id,
          rating: this.rating(),
          reviewText: this.review().trim(),
        }),
      );
      this.feedbackSubmitted.set(true);
      this.lastBookingId.set(null);
      this.router.navigate(['/dashboard'], { queryParams: { section: 'history' } });
    } catch {
      this.feedbackSubmitted.set(true);
    }
  }

  protected updateReview(event: Event): void {
    this.review.set((event.target as HTMLTextAreaElement).value);
  }

  protected addFiles(event: Event): void {
    this.selectedFiles.set(this.carrierService.addFiles(event, this.selectedFiles()));
  }

  protected removeFile(index: number): void {
    this.selectedFiles.set(this.carrierService.removeFile(index, this.selectedFiles()));
  }

  protected setSort(event: Event): void {
    this.sortOption.set((event.target as HTMLSelectElement).value as SortOption);
  }

  protected setKind(event: Event): void {
    this.kindFilter.set((event.target as HTMLSelectElement).value as 'All' | ProviderKind);
  }

  protected setAvailability(event: Event): void {
    this.availabilityOnly.set((event.target as HTMLInputElement).checked);
  }

  protected setNumberFilter(payload: {
    signalToUpdate: 'price' | 'distance' | 'rating' | 'capacity';
    event: Event;
  }): void {
    const value = Number((payload.event.target as HTMLInputElement).value);
    if (payload.signalToUpdate === 'price') this.maxPrice.set(value);
    if (payload.signalToUpdate === 'distance') this.maxDistance.set(value);
    if (payload.signalToUpdate === 'rating') this.minRating.set(value);
    if (payload.signalToUpdate === 'capacity') this.minCapacity.set(value);
  }

  protected resetFilters(): void {
    this.maxPrice.set(2000);
    this.maxDistance.set(20);
    this.minRating.set(0);
    this.minCapacity.set(0);
    this.kindFilter.set('All');
    this.availabilityOnly.set(false);
  }

  protected setView(view: BookingView): void {
    this.view.set(view);
  }

}
