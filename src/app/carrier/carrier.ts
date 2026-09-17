import { Component, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { providers } from './carrier.data';
import {
  BookingForm,
  BookingStatus,
  BookingValues,
  BookingView,
  Provider,
  ProviderKind,
  SelectedFile,
  SortOption,
} from './carrier.types';
import { CarrierRequestComponent } from './components/carrier-request/carrier-request.component';
import { CarrierMatchingComponent } from './components/carrier-matching/carrier-matching.component';
import { CarrierProfileComponent } from './components/carrier-profile/carrier-profile.component';
import { CarrierSummaryComponent } from './components/carrier-summary/carrier-summary.component';
import { CarrierStatusComponent } from './components/carrier-status/carrier-status.component';
import { CarrierRatingComponent } from './components/carrier-rating/carrier-rating.component';

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

  protected readonly kindFilter = signal<'All' | ProviderKind>('All');
  protected readonly availabilityOnly = signal(false);
  protected readonly maxPrice = signal(2000);
  protected readonly maxDistance = signal(20);
  protected readonly minRating = signal(0);
  protected readonly minCapacity = signal(0);
  protected readonly sortOption = signal<SortOption>('recommended');
  protected readonly providers = providers;

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
    const result = this.providers.filter(
      (provider) =>
        provider.capacity >= Math.max(weight, this.minCapacity()) &&
        provider.price <= this.maxPrice() &&
        provider.distance <= this.maxDistance() &&
        provider.rating >= this.minRating() &&
        (this.kindFilter() === 'All' || provider.kind === this.kindFilter()) &&
        (!this.availabilityOnly() || provider.available) &&
        provider.capacity >= weight,
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
  ) {
    this.restorePendingBooking();
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
      sessionStorage.setItem('liftmate-pending-provider', JSON.stringify(provider));
      sessionStorage.setItem('liftmate-pending-request', JSON.stringify(this.form.getRawValue()));
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

  protected confirmProviderBooking(): void {
    if (this.bookingStatus() !== 'Request Sent') return;
    this.view.set('status');
  }

  protected advanceStatus(): void {
    const statuses: BookingStatus[] = [
      'Request Sent',
      'Accepted',
      'On the Way',
      'Arrived',
      'Job Started',
      'Completed',
    ];
    const next = statuses[statuses.indexOf(this.bookingStatus()) + 1];
    if (next) this.bookingStatus.set(next);
  }

  protected cancelBooking(): void {
    this.bookingStatus.set('Request Sent');
    this.selectedProvider.set(null);
    this.view.set('matching');
  }

  protected setRating(value: number): void {
    this.rating.set(value);
  }

  protected submitFeedback(): void {
    if (this.rating() > 0 && this.review().trim()) this.feedbackSubmitted.set(true);
  }

  protected updateReview(event: Event): void {
    this.review.set((event.target as HTMLTextAreaElement).value);
  }

  protected addFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    const selectedFiles = files
      .filter(
        (file) =>
          file.size <= 10 * 1024 * 1024 &&
          ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'].includes(file.type),
      )
      .map((file) => ({
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      }));
    this.selectedFiles.update((currentFiles) => [...currentFiles, ...selectedFiles]);
    input.value = '';
  }

  protected removeFile(index: number): void {
    this.selectedFiles.update((files) => {
      const fileToRemove = files[index];
      if (fileToRemove?.previewUrl) URL.revokeObjectURL(fileToRemove.previewUrl);
      return files.filter((_, fileIndex) => fileIndex !== index);
    });
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

  private restorePendingBooking(): void {
    if (!this.authService.isLoggedIn()) return;

    const storedProvider = sessionStorage.getItem('liftmate-pending-provider');
    const storedRequest = sessionStorage.getItem('liftmate-pending-request');
    if (!storedProvider || !storedRequest) return;

    try {
      const provider = JSON.parse(storedProvider) as Provider;
      const request = JSON.parse(storedRequest) as Partial<BookingValues>;
      this.form.patchValue(request);
      this.selectedProvider.set(provider);
      this.view.set('summary');
      sessionStorage.removeItem('liftmate-pending-provider');
      sessionStorage.removeItem('liftmate-pending-request');
    } catch {
      sessionStorage.removeItem('liftmate-pending-provider');
      sessionStorage.removeItem('liftmate-pending-request');
    }
  }
}
