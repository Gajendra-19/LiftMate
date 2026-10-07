# LiftMate

LiftMate is a BSc IT project for matching customers with moving and lifting providers, managing bookings, and collecting reviews.

## Tech stack

- Frontend: Angular 21, TypeScript, Bootstrap
- Backend: Node.js, Express 4, MongoDB, Mongoose
- Authentication: JWT and bcrypt

## Project structure

```text
.
├── backend/
│   ├── app.js
│   ├── server.js
│   ├── config/             # Database connection and environment access
│   ├── controllers/        # HTTP request handlers
│   ├── middleware/         # Authentication middleware
│   ├── models/             # Mongoose models
│   ├── routes/             # API route wiring
│   └── utils/              # Shared validation and response helpers
├── public/
├── src/
│   ├── app/
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   ├── app.ts
│   │   ├── app.html
│   │   ├── app.css
│   │   ├── core/
│   │   │   ├── auth/
│   │   │   └── guards/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   └── signup/
│   │   │   ├── customer/
│   │   │   │   ├── carrier/
│   │   │   │   └── dashboard/
│   │   │   ├── landing/
│   │   │   ├── not-found/
│   │   │   └── worker/
│   │   │       └── provider-dashboard/
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── angular.json
├── package.json
└── tsconfig*.json
```

## Install

Install the frontend and backend dependencies from the repository root:

```sh
npm install
npm --prefix backend install
```

## Environment configuration

Create `backend/.env` with the following variables:

- `JWT_SECRET` (required)
- `MONGODB_URI` (required)
- `PORT` (optional; defaults to `5000`)
- `MONGODB_DB_NAME` (optional; defaults to `liftmate`)
- `CLIENT_ORIGIN` (optional; defaults to `http://localhost:4200`)

The backend exits at startup if `JWT_SECRET` is missing. Keep `.env` files private and do not commit credentials.

## Run locally

Start the backend:

```sh
npm --prefix backend start
```

Start the Angular development server from the repository root:

```sh
ng serve
```

The backend defaults to port `5000`; Angular defaults to port `4200`. The development frontend uses the local backend API.

## Tests and build

```sh
ng test
ng build
```
