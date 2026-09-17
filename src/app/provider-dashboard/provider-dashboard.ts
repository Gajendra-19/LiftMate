import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface RequestCard {
  customer: string;
  load: string;
  pickup: string;
  drop: string;
  schedule: string;
  duration: number;
  weight: number;
  payment: number;
}

interface LiftMateProfile {
  kind: 'Individual' | 'Team';
  name: string;
  phone: string;
  teamName: string;
  teamSize: number;
  serviceArea: string;
  equipment: string;
  capacity: number;
  rate: number;
}

@Component({
  selector: 'app-provider-dashboard',
  imports: [FormsModule],
  templateUrl: './provider-dashboard.html',
  styleUrl: './provider-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderDashboard {
  private readonly profileStorageKey = 'liftmate-provider-profile';
  protected readonly profile = signal<LiftMateProfile | null>(this.readProfile());
  protected readonly profileRegistered = signal(this.profile() !== null);
  protected readonly onboardingStep = signal<'choose' | 'form'>(this.profile() ? 'form' : 'choose');
  protected profileKind: 'Individual' | 'Team' = 'Individual';
  protected profileName = '';
  protected profilePhone = '';
  protected teamName = '';
  protected teamSize: number | null = null;
  protected serviceArea = '';
  protected equipment = '';
  protected capacity: number | null = null;
  protected rate: number | null = null;

  protected chooseProfileKind(kind: 'Individual' | 'Team'): void {
    this.profileKind = kind;
    this.onboardingStep.set('form');
  }
  protected readonly request = signal<RequestCard>({
    customer: 'Priya Mehta',
    load: 'Office furniture and 8 cartons',
    pickup: 'Andheri East, Mumbai',
    drop: 'Powai, Mumbai',
    schedule: '18 Sep 2026 · 10:30 AM',
    duration: 3,
    weight: 80,
    payment: 450,
  });
  protected readonly requestState = signal<'New request' | 'Accepted' | 'Rejected'>('New request');
  protected readonly activeStatus = signal<
    'Accepted' | 'On the Way' | 'Arrived' | 'Job Started' | 'Completed'
  >('Accepted');
  protected readonly earnings = 28450;
  protected readonly rating = 4.8;
  protected readonly statuses = [
    'Accepted',
    'On the Way',
    'Arrived',
    'Job Started',
    'Completed',
  ] as const;

  protected acceptRequest(): void {
    this.requestState.set('Accepted');
    this.activeStatus.set('Accepted');
  }

  protected rejectRequest(): void {
    this.requestState.set('Rejected');
  }

  protected advanceJob(): void {
    const nextIndex = this.statuses.indexOf(this.activeStatus()) + 1;
    const nextStatus = this.statuses[nextIndex];
    if (nextStatus) this.activeStatus.set(nextStatus);
  }

  protected resetRequest(): void {
    this.requestState.set('New request');
    this.activeStatus.set('Accepted');
  }

  protected registerAsLiftMate(): void {
    if (
      !this.profileName.trim() ||
      !this.profilePhone.trim() ||
      !this.serviceArea.trim() ||
      !this.equipment.trim() ||
      !this.capacity ||
      !this.rate ||
      (this.profileKind === 'Team' &&
        (!this.teamName.trim() || !this.teamSize || this.teamSize < 2 || this.teamSize > 5))
    )
      return;
    const profile = {
      kind: this.profileKind,
      name: this.profileName.trim(),
      phone: this.profilePhone.trim(),
      teamName: this.teamName.trim(),
      teamSize: this.teamSize || 1,
      serviceArea: this.serviceArea.trim(),
      equipment: this.equipment.trim(),
      capacity: this.capacity,
      rate: this.rate,
    };
    localStorage.setItem(this.profileStorageKey, JSON.stringify(profile));
    this.profile.set(profile);
    this.profileRegistered.set(true);
  }

  private readProfile(): LiftMateProfile | null {
    const storedProfile = localStorage.getItem(this.profileStorageKey);
    if (!storedProfile) return null;

    try {
      const profile = JSON.parse(storedProfile) as Partial<LiftMateProfile>;
      return {
        kind: profile.kind === 'Team' ? 'Team' : 'Individual',
        name: profile.name || '',
        phone: profile.phone || '',
        teamName: profile.teamName || '',
        teamSize: profile.teamSize || 1,
        serviceArea: profile.serviceArea || '',
        equipment: profile.equipment || '',
        capacity: profile.capacity || 0,
        rate: profile.rate || 0,
      };
    } catch {
      localStorage.removeItem(this.profileStorageKey);
      return null;
    }
  }
}
