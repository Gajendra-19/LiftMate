import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../auth.service';

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
  phone = '';
  otpCode = '';
  password = '';
  confirmPassword = '';

  showPassword = signal(false);
  showConfirmPassword = signal(false);
  loading = signal(false);
  otpSent = false;
  phoneVerified = false;
  generatedOtp = '';
  readonly returnUrl: string;

  emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  phonePattern = /^[+]?[(]?[0-9]{1,4}[)]?[-\s0-9]{7,15}$/;

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
    if (!this.fullname || !this.email || !this.phone || !this.password || !this.confirmPassword) {
      this.toastr.error('Please fill in all required fields');
      return;
    }

    if (!this.emailPattern.test(this.email)) {
      this.toastr.error('Please enter a valid email address');
      return;
    }

    if (this.password.length < 6) {
      this.toastr.error('Password must be at least 6 characters');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.toastr.error('Passwords do not match');
      return;
    }

    this.loading.set(true);

    try {
      const success = await this.authService.register(this.fullname, this.email, this.password);

      if (success) {
        this.toastr.success('Registration successful!');
        this.router.navigateByUrl(this.returnUrl);
      } else {
        this.toastr.error('User already exists or registration failed.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
