# Silent SOS

A full-stack, mobile-first emergency safety application built with HTML/CSS/vanilla JavaScript, Node.js, Express, MongoDB/Mongoose, JWT, Nodemailer and Twilio.

## Important safety limitations

- Silent SOS is not a replacement for emergency services.
- Browser location access requires HTTPS in production and may require a user permission prompt.
- Location is requested only when the SOS workflow is activated or when an active alert is tracking.
- The application cannot guarantee complete invisibility, bypass browser/OS controls, remove browser history, or operate without network access.
- Quick exit opens a neutral Google page but cannot remove browser history or hide network activity.

## Project structure

The requested `frontend/` and `backend/` structure is included. Static frontend files are served by Express in local mode.

## Local setup

### 1. Requirements

- Node.js 18 or newer
- MongoDB Community Edition or MongoDB Atlas
- A modern browser that supports Geolocation API

### 2. Configure the backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
```

Edit `.env`:

- `MONGODB_URI`: MongoDB Atlas connection string or `mongodb://127.0.0.1:27017/silent-sos`
- `JWT_SECRET`: a long random secret
- `FRONTEND_URL`: the frontend origin, for example `http://localhost:5000`
- Keep `NOTIFICATION_MODE=dev` for demonstrations. In this mode, notification records are created with `failed` status and explanatory development-mode errors; no external service is falsely marked delivered.

Start the backend and static frontend:

```powershell
npm run dev
# or npm start
```

Open `http://localhost:5000`.

### 3. Create a demo account

Use the registration page to create a user or police account. To create an administrator account, run the seed script:

```powershell
npm run seed-admin -- "Admin User" admin@example.com "ChangeThisPassword123!"
```

Register with **User (I need help)** for the user dashboard or **Police (I help others)** for the responder dashboard. Police registration does not require an authorization token. Anyone can register as Police and view active emergency alerts and locations across users, so this setting is suitable only for a trusted demonstration environment. Both dashboards refresh every three seconds while visible: SOS activations, location updates, acknowledgments, and resolutions appear on both sides. The Police dashboard embeds a Google Maps preview for the selected alert; Google receives the coordinates when that map loads. Police can acknowledge or resolve an alert; users can resolve their own alerts. Police acknowledgment is not dispatch: the app does not contact police services or replace local emergency procedures.

### 4. Configure real notifications

#### Email with SMTP/Nodemailer

1. Create SMTP credentials with an approved provider.
2. Set `NOTIFICATION_MODE=production`.
3. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `NOTIFICATION_FROM`.
4. For Gmail, use an app password and enable the account security options required by Google.

#### SMS with Twilio

1. Create a Twilio account and SMS-capable number.
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`.
3. Set `NOTIFICATION_MODE=production`.

When a contact is added or an email/phone is changed, the app sends a six-digit verification code to each saved contact method; adding a contact alone does not send an emergency alert. Codes expire after 10 minutes and allow up to five attempts. After the user activates SOS, each verified contact receives an emergency message asking them to help and including the last known location as a Google Maps link. A method is included in SOS notifications only after it is verified. Verification and SOS delivery require `NOTIFICATION_MODE=production` and working SMTP and/or Twilio credentials; otherwise the UI or notification records report that delivery failed. SOS delivery records are only marked `sent` after the provider accepts/returns a provider message ID. Errors remain `failed`.

## API overview

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/profile`

Contacts:

- `GET /api/contacts`
- `POST /api/contacts`
- `POST /api/contacts/:id/verification`
- `POST /api/contacts/:id/verify`
- `PUT /api/contacts/:id`
- `DELETE /api/contacts/:id`

Alerts:

- `POST /api/alerts/trigger`
- `GET /api/alerts`
- `GET /api/alerts/:id`
- `PUT /api/alerts/:id/resolve`
- `POST /api/alerts/:id/location`

Administration (administrator JWT required):

- `GET /api/admin/dashboard`
- `GET /api/admin/alerts`
- `GET /api/admin/users`

Police (Police-role JWT required):

- `GET /api/police/dashboard`
- `GET /api/police/alerts`
- `PUT /api/police/alerts/:id/acknowledge`
- `PUT /api/police/alerts/:id/resolve`

Send private API requests with `Authorization: Bearer <JWT>`.

## Main workflow test

1. Register and sign in.
2. Add contacts and mark them verified only after confirming their real contact details.
3. Permit location access.
4. Press and hold the red SOS button for 1.5 seconds.
5. Verify the active alert, alert ID, Maps link and live location updates.
6. Resolve the alert; confirm live tracking stops.
7. Open Alert History and confirm the resolved record.
8. Register or seed an administrator and verify the admin dashboard.

## Automated test

```powershell
cd backend
npm test
```

MongoDB-backed flows should additionally be tested against a disposable local database because real alerts and notifications must use genuine records and providers.

## MongoDB Atlas

1. Create a free or paid Atlas cluster.
2. Add your deployment IP or permitted CIDRs to Network Access.
3. Create a database user with least-privilege application access.
4. Put the SRV connection string in `MONGODB_URI`.
5. Mongoose creates the configured collections on first use.

## Deployment

### Backend

Deploy `backend/` to Render, Railway, Azure App Service, or a Node-compatible host:

- Build/install: `npm install`
- Start: `npm start`
- Configure every `.env` value in the host's secret settings.
- Use a production MongoDB Atlas URI and a cryptographically random JWT secret.
- Use the deployed HTTPS origin in `FRONTEND_URL`.

### Frontend

The frontend is also served by Express. Alternatively, deploy `frontend/` to Netlify, Vercel static hosting, Azure Static Web Apps, or any HTTPS static host and set `FRONTEND_URL` to that origin; update `API_BASE` in `frontend/js/api.js` to the deployed backend URL/API prefix.

For secure GPS access, use HTTPS. Localhost is generally permitted for browser geolocation development.

### Production headers and security

Helmet is enabled. CORS is restricted with `FRONTEND_URL` when configured. Authentication APIs are rate-limited, passwords are bcrypt hashed, JWTs protect private routes, and administrator routes require the `admin` role. Use HTTPS, provider secrets in host environment variables, database users with least privileges, and regular dependency updates.
