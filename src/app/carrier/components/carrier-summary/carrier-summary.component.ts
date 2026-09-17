import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BookingForm, Provider } from '../../carrier.types';

@Component({
  selector: 'app-carrier-summary',
  imports: [ReactiveFormsModule],
  templateUrl: './carrier-summary.component.html',
  styleUrls: ['./carrier-summary.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarrierSummaryComponent {
  provider = input.required<Provider>();
  form = input.required<FormGroup<BookingForm>>();

  chooseAnotherCarrier = output<void>();
  confirmBooking = output<void>();
}
