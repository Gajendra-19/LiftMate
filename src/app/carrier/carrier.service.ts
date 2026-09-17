import { Injectable } from '@angular/core';
import { providers as allProviders } from './carrier.data';
import { BookingStatus, Provider, ProviderKind, SelectedFile } from './carrier.types';

@Injectable({ providedIn: 'root' })
export class CarrierService {
  readonly providers = allProviders;

  filterProviders(
    maxPrice: number,
    maxDistance: number,
    minRating: number,
    minCapacity: number,
    kindFilter: 'All' | ProviderKind,
    availabilityOnly: boolean,
    weight: number,
  ): Provider[] {
    return this.providers.filter(
      (provider) =>
        provider.capacity >= Math.max(weight, minCapacity) &&
        provider.price <= maxPrice &&
        provider.distance <= maxDistance &&
        provider.rating >= minRating &&
        (kindFilter === 'All' || provider.kind === kindFilter) &&
        (!availabilityOnly || provider.available),
    );
  }

  getStatusFlow(): BookingStatus[] {
    return ['Request Sent', 'Accepted', 'On the Way', 'Arrived', 'Job Started', 'Completed'];
  }

  addFiles(event: Event, selectedFiles: SelectedFile[]): SelectedFile[] {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    const newFiles = files
      .filter(
        (file) =>
          file.size <= 10 * 1024 * 1024 &&
          ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'].includes(file.type),
      )
      .map((file) => ({
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      }));

    input.value = '';
    return [...selectedFiles, ...newFiles];
  }

  removeFile(index: number, selectedFiles: SelectedFile[]): SelectedFile[] {
    const fileToRemove = selectedFiles[index];
    if (fileToRemove?.previewUrl) URL.revokeObjectURL(fileToRemove.previewUrl);
    return selectedFiles.filter((_, fileIndex) => fileIndex !== index);
  }
}
