import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  protected readonly authService = inject(AuthService);
}
