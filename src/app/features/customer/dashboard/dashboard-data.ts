export interface DashboardProviderSummary {
  _id: string;
  name: string;
}

export interface DashboardBooking {
  _id: string;
  userId: string;
  category: string;
  description: string;
  pickupLocation: string;
  deliveryLocation: string;
  bookingDate: string;
  bookingTime: string;
  durationHours: number;
  weight?: number;
  items?: number;
  preferences?: string;
  paymentMethod?: string;
  totalPrice: number;
  status: string;
  createdAt: string;
  providerId?: DashboardProviderSummary | null;
}

export interface DashboardSummary {
  activeRequests: number;
  completedJobs: number;
  savedProviders: number;
  recentActivities: DashboardBooking[];
}

export function summarizeDashboardBookings(bookings: DashboardBooking[]): DashboardSummary {
  const ordered = [...bookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const recentActivities = ordered.slice(0, 2);
  const completedJobs = bookings.filter((booking) => booking.status === 'Completed').length;
  const activeRequests = bookings.filter(
    (booking) => booking.status !== 'Completed' && booking.status !== 'Cancelled',
  ).length;
  const savedProviders = new Set(
    bookings
      .filter((booking) => booking.providerId && booking.providerId.name)
      .map((booking) => booking.providerId!.name),
  ).size;

  return {
    activeRequests,
    completedJobs,
    savedProviders,
    recentActivities,
  };
}
