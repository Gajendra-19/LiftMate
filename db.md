# LiftMate Database Tables

This is the project-aligned database structure based on the real data model used by the app.

## 1. users
Attributes:
- id
- name
- email
- password
- created_at
- updated_at

## 2. providers
Attributes based on `carrier.data.ts` and `carrier.types.ts`:
- id
- name
- kind
- avatar
- rating
- jobs
- capacity
- distance
- available
- price
- team_size
- equipment
- service_area
- reviews
- created_at
- updated_at

## 3. bookings
Attributes based on the booking form and status flow:
- id
- user_id
- provider_id
- category
- description
- weight
- items
- pickup_location
- delivery_location
- booking_date
- booking_time
- duration_hours
- preferences
- status
- total_price
- payment_method
- created_at
- updated_at

## 4. booking_documents
Attributes for uploaded files:
- id
- booking_id
- file_name
- file_type
- file_size
- preview_url
- uploaded_at

## 5. payments
Attributes for the payment step:
- id
- booking_id
- user_id
- amount
- payment_method
- status
- transaction_reference
- created_at

## 6. cancellations
Attributes for the cancel request modal and policy:
- id
- booking_id
- user_id
- reason
- fee_percent
- fee_amount
- status
- cancelled_at

## 7. reviews
Attributes for the rating and review flow:
- id
- booking_id
- user_id
- provider_id
- rating
- review_text
- created_at

## Final table list

users
providers
bookings
booking_documents
payments
cancellations
reviews
