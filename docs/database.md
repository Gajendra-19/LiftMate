# Database models

The backend uses Mongoose with MongoDB. Schema fields below use the property names stored in MongoDB. Models with timestamps have `createdAt` and `updatedAt`.

## Users

Collection: `users`

- `name` (required, trimmed)
- `email` (required, unique, lowercase, trimmed)
- `password` (required; stored as a bcrypt hash by signup)
- `role` (`customer` or `worker`, default `customer`)
- `location` (default empty string)
- `address` (default empty string)
- `createdAt`, `updatedAt`

## Providers

Collection: `providers`

- `userId` (User reference, defaults to `null`)
- `name` (required)
- `kind` (`Individual` or `Team`, required)
- `phone` (default `null`)
- `teamName` (default empty string)
- `teamMembers` (array of strings)
- `avatar` (default empty string)
- `rating`, `jobs`, `capacity`, `distance` (numbers, default `0`)
- `available` (default `true`)
- `price` (default `0`)
- `teamSize` (default `1`)
- `equipment`, `reviews` (arrays of strings)
- `serviceArea` (default empty string)
- `createdAt`, `updatedAt`

## Bookings

Model: `Booking`; collection: `orders` (explicitly configured in the model).

- `userId` (User reference, required)
- `providerId` (Provider reference, required)
- `category`, `description` (required strings)
- `weight`, `items`, `durationHours` (required numbers)
- `pickupLocation`, `deliveryLocation`, `bookingDate`, `bookingTime` (required strings)
- `preferences` (default empty string)
- `timeZoneOffsetMinutes` (booking-time UTC offset in minutes, default `0`)
- `status` (`Request Sent`, `Accepted`, `On the Way`, `Arrived`, `Job Started`, `Awaiting Customer Confirmation`, `Completed`, `Completion Disputed`, or `Cancelled`; default `Request Sent`)
- `completionConfirmation` (`pending`, `confirmed`, or `disputed`; default `null`)
- `completionConfirmedAt` (customer response timestamp, default `null`)
- `totalPrice` (default `0`)
- `paymentMethod` (`card`, `wallet`, or `bank`; default `card`)
- `createdAt`, `updatedAt`

## Payments

Collection: `payments`

- `bookingId` (Booking reference, required)
- `userId` (User reference, required)
- `amount` (required number)
- `paymentMethod` (`card`, `wallet`, or `bank`; default `card`)
- `status` (`pending`, `success`, `failed`, `partially_refunded`, or `refunded`; default `pending`)
- `refundedAmount` (simulated recorded refund amount, default `0`)
- `transactionReference` (default empty string)
- `createdAt`, `updatedAt`

## Reviews

Collection: `reviews`

- `bookingId` (Booking reference, required)
- `userId` (User reference, required)
- `providerId` (Provider reference, required)
- `rating` (required number from 1 through 5)
- `reviewText` (default empty string)
- `createdAt`, `updatedAt`

## Cancellations

Collection: `cancellations`

- `bookingId` (Booking reference, required)
- `userId` (User reference, required)
- `reason` (default empty string)
- `feePercent`, `feeAmount` (default `0`)
- `refundAmount` (simulated recorded refund, default `0`)
- `initiatedBy` (`customer`, `worker`, or `system`; default `customer`)
- `status` (`pending`, `approved`, or `rejected`; default `pending`)
- `createdAt`, `updatedAt`

Cancellation records are created when a booking is cancelled. Refunds are recorded in MongoDB only; no payment gateway is connected.

## Booking documents

The `BookingDocument` model uses Mongoose's default collection name, `bookingdocuments`.

- `bookingId` (Booking reference, required)
- `fileName`, `fileType` (required strings)
- `fileSize` (default `0`)
- `previewUrl` (default empty string)
- `createdAt`, `updatedAt`

The `BookingDocument` model is not currently used by any route or controller.
