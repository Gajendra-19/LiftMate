import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BookingForm, PaymentMethod, Provider } from '../../carrier.types';

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
  paymentMethod = input.required<PaymentMethod>();
  paymentProcessing = input(false);
  paymentSuccess = input(false);

  chooseAnotherCarrier = output<void>();
  confirmBooking = output<void>();
  paymentMethodChange = output<PaymentMethod>();
}
