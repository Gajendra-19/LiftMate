import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { Provider } from '../../carrier.types';

@Component({
  selector: 'app-carrier-profile',
  templateUrl: './carrier-profile.component.html',
  styleUrls: ['./carrier-profile.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarrierProfileComponent {
  provider = input.required<Provider>();

  backToMatching = output<void>();
  requestProfile = output<void>();
}
