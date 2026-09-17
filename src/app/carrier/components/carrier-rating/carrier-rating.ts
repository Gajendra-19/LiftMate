import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { Provider } from '../../carrier.types';

@Component({
  selector: 'app-carrier-rating',
  templateUrl: './carrier-rating.html',
  styleUrls: ['./carrier-rating.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarrierRatingComponent {
  provider = input.required<Provider>();
  rating = input.required<number>();
  review = input.required<string>();
  feedbackSubmitted = input.required<boolean>();

  setRating = output<number>();
  updateReview = output<Event>();
  submitFeedback = output<void>();
}
