require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const User = require('./models/User');
const Provider = require('./models/Provider');
const Booking = require('./models/Booking');
const Review = require('./models/Review');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'LiftMate',
    });

    console.log('Mongo connected');

    const userEmail = 'tim@gmail.com';
    const user = await User.findOneAndUpdate(
      { email: userEmail },
      {
        $setOnInsert: {
          name: 'Tim Parker',
          email: userEmail,
          password: '$2b$12$D9zV1I1TgW7i4YkW1G4Rteh9tthgE0gXE1Q7TYsM9lMRbKGa8YvTW',
          role: 'customer',
        },
      },
      { upsert: true, new: true },
    );

    const provider = await Provider.findOneAndUpdate(
      { name: 'Rahul Kumar' },
      {
        $setOnInsert: {
          userId: user._id,
          name: 'Rahul Kumar',
          kind: 'Individual',
          avatar: 'RK',
          rating: 4.8,
          jobs: 124,
          capacity: 100,
          distance: 1.2,
          available: true,
          price: 450,
          teamSize: 1,
          equipment: ['Hand trolley', 'Rope set'],
          serviceArea: 'Andheri, Mumbai',
          reviews: ['Fast and careful with our office move.', 'Very professional and punctual.'],
        },
      },
      { upsert: true, new: true },
    );

    const sampleBookings = [
      {
        userId: user._id,
        providerId: provider._id,
        category: 'Office furniture',
        description: 'Office furniture delivery',
        weight: 120,
        items: 8,
        pickupLocation: 'Andheri East, Mumbai',
        deliveryLocation: 'Powai, Mumbai',
        bookingDate: '2026-09-18',
        bookingTime: '10:30',
        durationHours: 3,
        preferences: 'Handle with care',
        status: 'Completed',
        totalPrice: 450,
        paymentMethod: 'card',
      },
      {
        userId: user._id,
        providerId: provider._id,
        category: 'Home appliance',
        description: 'Home appliance move',
        weight: 200,
        items: 5,
        pickupLocation: 'Bandra West, Mumbai',
        deliveryLocation: 'Dadar, Mumbai',
        bookingDate: '2026-09-12',
        bookingTime: '09:00',
        durationHours: 4,
        preferences: 'Need careful handling',
        status: 'Request Sent',
        totalPrice: 1200,
        paymentMethod: 'wallet',
      },
    ];

    const createdBookings = [];
    for (const bookingData of sampleBookings) {
      const existing = await Booking.findOne({
        userId: bookingData.userId,
        description: bookingData.description,
      });

      if (!existing) {
        const createdBooking = await Booking.create(bookingData);
        createdBookings.push(createdBooking);
      } else {
        createdBookings.push(existing);
      }
    }

    const reviewSeed = [
      {
        bookingId: createdBookings[0]._id,
        userId: user._id,
        providerId: provider._id,
        rating: 5,
        reviewText: 'Excellent service, very punctual and careful with the furniture.',
      },
      {
        bookingId: createdBookings[1]._id,
        userId: user._id,
        providerId: provider._id,
        rating: 4,
        reviewText: 'Good communication and handling. Would hire again.',
      },
    ];

    let createdReviews = 0;
    for (const reviewData of reviewSeed) {
      const existingReview = await Review.findOne({
        bookingId: reviewData.bookingId,
        userId: reviewData.userId,
      });

      if (!existingReview) {
        await Review.create(reviewData);
        createdReviews += 1;
      }
    }

    console.log('Seed complete');
    console.log(JSON.stringify({
      userId: String(user._id),
      providerId: String(provider._id),
      bookingCount: createdBookings.length,
      reviewCount: createdReviews,
      email: userEmail,
      password: 'Tim@123',
    }, null, 2));

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }
};

seed();
