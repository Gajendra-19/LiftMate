import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../auth.service';

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
  loading: boolean = false;
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

  continueWithGoogle(): void {
    this.toastr.info('Google sign-in is available for the next LiftMate account flow.');
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.toastr.error('Please fill in all fields');
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

    this.loading = true;

    setTimeout(() => {
      this.loading = false;
      if (this.authService.login(this.email, this.password)) {
        this.toastr.success('Signed in successfully.');
        this.router.navigateByUrl(this.returnUrl);
      } else {
        this.toastr.error('Invalid email or password.');
        this.password = '';
      }
    }, 800);
  }
}
