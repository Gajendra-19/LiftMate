import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { Provider } from '../../carrier.types';

@Component({
  selector: 'app-carrier-matching',
  templateUrl: './carrier-matching.html',
  styleUrls: ['./carrier-matching.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarrierMatchingComponent {
  filteredProviders = input.required<Provider[]>();
  maxPrice = input.required<number>();
  maxDistance = input.required<number>();
  minRating = input.required<number>();
  minCapacity = input.required<number>();

  editRequest = output<void>();
  resetFilters = output<void>();
  setSort = output<Event>();
  setKind = output<Event>();
  setAvailability = output<Event>();
  setNumberFilter = output<{
    signalToUpdate: 'price' | 'distance' | 'rating' | 'capacity';
    event: Event;
  }>();
  viewProfile = output<Provider>();
  selectProvider = output<Provider>();
}
