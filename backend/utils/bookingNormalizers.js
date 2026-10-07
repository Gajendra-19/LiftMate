const normalizeProviderBooking = (booking, provider) => ({
  ...booking,
  _id: String(booking._id),
  customerName: booking.userId?.name || 'Customer',
  userId: booking.userId?._id?.toString?.() ?? booking.userId?.toString?.() ?? booking.userId,
  providerId: String(provider._id),
});

const normalizeCustomerBooking = (booking) => ({
  ...booking,
  _id: booking._id.toString(),
  customerName: booking.userId?.name || '',
  userId: booking.userId?._id?.toString?.() ?? booking.userId?.toString?.() ?? booking.userId,
  providerId: booking.providerId
    ? {
        _id: booking.providerId._id.toString(),
        name: booking.providerId.name,
        userId: booking.providerId.userId?.toString?.() ?? booking.providerId.userId,
      }
    : null,
});

module.exports = { normalizeProviderBooking, normalizeCustomerBooking };
