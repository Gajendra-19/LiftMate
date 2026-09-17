import { FormControl } from '@angular/forms';

export type BookingView = 'request' | 'matching' | 'profile' | 'summary' | 'status' | 'rating';
export type ProviderKind = 'Individual' | 'Team';
export type SortOption = 'recommended' | 'price' | 'distance' | 'rating';
export type BookingStatus =
  'Request Sent' | 'Accepted' | 'On the Way' | 'Arrived' | 'Job Started' | 'Completed';

export interface BookingForm {
  category: FormControl<string>;
  description: FormControl<string>;
  weight: FormControl<number | null>;
  items: FormControl<number | null>;
  pickup: FormControl<string>;
  delivery: FormControl<string>;
  date: FormControl<string>;
  time: FormControl<string>;
  duration: FormControl<number | null>;
  preferences: FormControl<string>;
}

export type BookingValues = { [Key in keyof BookingForm]: BookingForm[Key]['value'] };

export interface Provider {
  id: number;
  name: string;
  kind: ProviderKind;
  avatar: string;
  rating: number;
  jobs: number;
  capacity: number;
  distance: number;
  available: boolean;
  price: number;
  teamSize: number;
  equipment: string[];
  serviceArea: string;
  reviews: string[];
}

export interface SelectedFile {
  file: File;
  previewUrl: string | null;
}
