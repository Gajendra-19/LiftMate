import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BookingForm, Provider } from '../../carrier.types';

@Component({
  selector: 'app-carrier-summary',
  imports: [ReactiveFormsModule],
  templateUrl: './carrier-summary.html',
  styleUrls: ['./carrier-summary.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarrierSummaryComponent {
  provider = input.required<Provider>();
  form = input.required<FormGroup<BookingForm>>();

  chooseAnotherCarrier = output<void>();
  confirmBooking = output<void>();
}
