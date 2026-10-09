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
  timeZoneOffsetMinutes?: number;
  durationHours: number;
  weight?: number;
  items?: number;
  preferences?: string;
  paymentMethod?: string;
  totalPrice: number;
  status: string;
  paymentStatus?: string;
  paymentRefundedAmount?: number;
  completionConfirmation?: 'pending' | 'confirmed' | 'disputed' | null;
  createdAt: string;
  providerId?: DashboardProviderSummary | null;
}

export interface DashboardSummary {
  requestsSent: number;
  activeJobs: number;
  completedJobs: number;
  bookings: DashboardBooking[];
  recentActivities: DashboardBooking[];
}

export function summarizeDashboardBookings(bookings: DashboardBooking[]): DashboardSummary {
  const ordered = [...bookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const recentActivities = ordered.slice(0, 2);
  const requestsSent = bookings.filter((booking) => booking.status === 'Request Sent').length;
  const activeJobs = bookings.filter((booking) =>
    [
      'Accepted',
      'On the Way',
      'Arrived',
      'Job Started',
      'Awaiting Customer Confirmation',
    ].includes(booking.status),
  ).length;
  const completedJobs = bookings.filter((booking) => booking.status === 'Completed').length;

  return {
    requestsSent,
    activeJobs,
    completedJobs,
    bookings: ordered,
    recentActivities,
  };
}
