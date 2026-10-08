import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { AuthService, DemoAccountRole } from '../../../core/auth/auth.service';

interface DemoAccountOption {
  role: DemoAccountRole;
  label: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email: string = '';
  password: string = '';
  showPassword: boolean = false;
  loginError: string = '';
  loading = false;
  demoLoading: DemoAccountRole | null = null;
  readonly demoAccounts: DemoAccountOption[] = [
    { role: 'customer', label: 'Customer' },
    { role: 'individual-worker', label: 'Individual Worker' },
    { role: 'team-worker', label: 'Team Worker' },
  ];
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
    this.showPassword = !this.showPassword;
  }

  async onSubmit(): Promise<void> {
    if (this.loading) {
      return;
    }

    if (!this.email || !this.password) {
      this.toastr.error('Please fill in all fields');
      return;
    }

    if (!this.emailPattern.test(this.email)) {
      this.toastr.error('Please enter a valid email address');
      return;
    }

    this.loading = true;

    try {
      const success = await this.authService.login(this.email, this.password);

      if (success) {
        this.toastr.success('Signed in successfully.');
        this.router.navigateByUrl(this.authService.resolveReturnUrl(this.returnUrl));
      } else {
        const message =
          this.authService.authError === 'rate-limited'
            ? 'Too many login attempts. Please try again in 5 minutes.'
            : this.authService.authError === 'network'
              ? 'Unable to connect to LiftMate. Please try again.'
              : 'Invalid email or password.';
        this.toastr.error(message, 'Login Failed');
      }
    } catch {
      this.toastr.error('Unable to connect to LiftMate. Please try again.', 'Network Error');
    } finally {
      this.loading = false;
    }
  }

  async signInAsDemo(role: DemoAccountRole): Promise<void> {
    if (this.loading || this.demoLoading) return;

    this.demoLoading = role;
    try {
      const success = await this.authService.loginAsDemo(role);
      if (success) {
        this.toastr.success('Signed in with a demo account.');
        this.router.navigateByUrl(this.authService.resolveReturnUrl(this.returnUrl));
        return;
      }

      const message =
        this.authService.authError === 'rate-limited'
          ? 'Too many login attempts. Please try again in 5 minutes.'
          : this.authService.authError === 'demo-unavailable'
            ? 'Demo accounts are not available right now.'
            : this.authService.authError === 'network'
              ? 'Unable to connect to LiftMate. Please try again.'
              : 'Unable to sign in with this demo account.';
      this.toastr.error(message, 'Demo Sign-In Failed');
    } finally {
      this.demoLoading = null;
    }
  }
}
