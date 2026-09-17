import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BookingForm, BookingStatus, Provider } from '../../carrier.types';

@Component({
  selector: 'app-carrier-status',
  imports: [ReactiveFormsModule],
  templateUrl: './carrier-status.component.html',
  styleUrls: ['./carrier-status.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarrierStatusComponent {
  provider = input.required<Provider>();
  bookingStatus = input.required<BookingStatus>();
  form = input.required<FormGroup<BookingForm>>();

  cancelBooking = output<void>();
  advanceStatus = output<void>();
  rateCarrier = output<void>();

  readonly statusList: BookingStatus[] = [
    'Request Sent',
    'Accepted',
    'On the Way',
    'Arrived',
    'Job Started',
    'Completed',
  ];
}
