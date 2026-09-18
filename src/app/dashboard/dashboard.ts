import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../auth.service';

type DashboardSection = 'overview' | 'history' | 'settings';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly authService = inject(AuthService);
  protected readonly router = inject(Router);
  protected readonly section = signal<DashboardSection>('overview');
  protected readonly menuOpen = signal(false);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly childRouteActive = signal(false);
  protected readonly hasPendingRequest =
    sessionStorage.getItem('liftmate-pending-request') !== null;

  private readonly route = inject(ActivatedRoute);

  constructor() {
    this.updateChildRouteState();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.updateChildRouteState());
    this.route.queryParamMap.subscribe((params) => {
      const requestedSection = params.get('section');
      if (requestedSection === 'history' || requestedSection === 'settings') {
        this.section.set(requestedSection);
      } else {
        this.section.set('overview');
      }
    });
  }

  private updateChildRouteState(): void {
    this.childRouteActive.set(this.route.firstChild !== null);
  }

  protected setSection(section: DashboardSection): void {
    this.section.set(section);
    this.menuOpen.set(false);
    this.router.navigate(['/dashboard'], {
      queryParams: section === 'overview' ? {} : { section },
    });
  }

  protected toggleMenu(): void {
    this.menuOpen.update((isOpen) => !isOpen);
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((isCollapsed) => !isCollapsed);
  }

  protected continueRequest(): void {
    this.router.navigateByUrl('/dashboard/carrier');
  }

  protected logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/');
  }
}
