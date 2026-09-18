import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BookingForm, SelectedFile } from '../../carrier.types';

@Component({
  selector: 'app-carrier-request',
  imports: [ReactiveFormsModule],
  templateUrl: './carrier-request.html',
  styleUrls: ['./carrier-request.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class CarrierRequestComponent {
  form = input.required<FormGroup<BookingForm>>();
  requestStep = input.required<1 | 2 | 3>();
  submitted = input.required<boolean>();
  loading = input.required<boolean>();
  selectedFiles = input.required<SelectedFile[]>();

  nextStep = output<void>();
  previousStep = output<void>();
  confirmBooking = output<void>();
  addFiles = output<Event>();
  removeFile = output<number>();

  protected readonly stepLabel = computed(() => ({ 1: 'Load Details', 2: 'Location', 3: 'Confirm' })[this.requestStep()],
  );
}
