import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService, WorkerProfilePayload } from '../auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  fullname = '';
  email = '';
  password = '';
  confirmPassword = '';
  role: 'customer' | 'worker' = 'customer';
  workerProfile: WorkerProfilePayload = {
    kind: 'Individual',
    phone: null,
    teamName: '',
    teamSize: 2,
    serviceArea: '',
    equipment: '',
    capacity: 0,
    rate: 0,
  };

  showPassword = signal(false);
  showConfirmPassword = signal(false);
  loading = signal(false);
  readonly returnUrl: string;

  emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  constructor(
    private toastr: ToastrService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {
    const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl = requestedUrl?.startsWith('/') ? requestedUrl : '/dashboard';
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  checkEmailValidity(): void {
    if (this.email && !this.emailPattern.test(this.email)) {
      console.log('Invalid email format');
    }
  }

  async onSubmit(): Promise<void> {
    if (this.loading()) {
      return;
    }

    const trimmedName = this.fullname.trim();
    const trimmedEmail = this.email.trim();

    if (!trimmedName || !trimmedEmail || !this.password || !this.confirmPassword) {
      this.toastr.error('Please fill in all required fields');
      return;
    }

    if (!this.emailPattern.test(trimmedEmail)) {
      this.toastr.error('Please enter a valid email address');
      return;
    }

    if (
      this.password.length < 6 ||
      !/[A-Z]/.test(this.password) ||
      !/[a-z]/.test(this.password) ||
      !/\d/.test(this.password)
    ) {
      this.toastr.error('Password must be at least 6 characters with uppercase, lowercase, and a number');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.toastr.error('Passwords do not match');
      return;
    }

    if (this.role === 'worker') {
      const workerProfile = this.workerProfile;
      if (
        !workerProfile.phone ||
        (workerProfile.kind === 'Team' &&
          (!workerProfile.teamName.trim() || workerProfile.teamSize < 2 || workerProfile.teamSize > 5))
      ) {
        this.toastr.error('Please complete the worker account details before continuing.');
        return;
      }
    }

    this.loading.set(true);

    try {
      const success = await this.authService.register(
        trimmedName,
        trimmedEmail,
        this.password,
        this.role,
        this.role === 'worker' ? this.workerProfile : undefined,
      );

      if (success) {
        this.toastr.success('Registration successful!');
        this.router.navigateByUrl(this.authService.resolveReturnUrl(this.returnUrl));
      } else {
        this.toastr.error('User already exists or registration failed.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
