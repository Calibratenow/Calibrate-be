# CalibrateNow Backend API

RESTful backend for CalibrateNow with JWT authentication, Firebase Firestore, AI workflows via n8n, and Cloudinary image uploads.

## Features

- Email/password and Google OAuth authentication
- JWT access and refresh tokens (httpOnly cookies, cross-site support)
- Firebase Firestore for users and refresh tokens
- AI prompt generation via n8n webhooks
- Profile image uploads via Cloudinary
- CORS, trust proxy, and secure cookie configuration for deployment

## Prerequisites

- Node.js v16+
- Firebase project with Firestore
- Google OAuth credentials
- Cloudinary account (for image uploads)
- n8n webhook URL (for AI features)

## Quick Start

```bash
npm install
# Create .env with required variables (see Environment Variables)
npm run dev
```

Server runs at `http://localhost:5000`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `FRONTEND_URL` | Yes | Frontend origin for CORS (e.g. `https://dashboard.calibratenow.io`) |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Yes | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Yes | Firebase private key (include `\n` for newlines) |
| `JWT_ACCESS_SECRET` | Yes | JWT access token secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | JWT refresh token secret (min 32 chars) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `N8N_WEBHOOK_URL` | Yes | n8n webhook URL for AI workflow |

## Deployment

**Production URLs:**
- Backend: `https://backend.calibratenow.io`
- Frontend: `https://dashboard.calibratenow.io`

**Production `.env` settings:**
```env
NODE_ENV=production
FRONTEND_URL=https://dashboard.calibratenow.io
```

- `trust proxy` is set for proxies (Nginx, load balancers)
- Cookies use `secure: true` and `sameSite: 'none'` for cross-origin requests
- Add `https://dashboard.calibratenow.io` to Google OAuth authorized origins and redirect URIs

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/google` | Login/register with Google |
| POST | `/api/auth/refresh` | Refresh access token (cookie) |
| POST | `/api/auth/logout` | Logout and clear cookies |
| GET | `/api/auth/verify` | Verify access token |

### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/profile` | Get profile |
| PUT | `/api/user/profile` | Update profile |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/generate-prompt` | Generate AI response via n8n |
| GET | `/api/ai/history` | List conversation history |
| GET | `/api/ai/conversation/:id` | Get conversation |
| DELETE | `/api/ai/conversation/:id` | Delete conversation |
| GET | `/api/ai/health` | Health check |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/profile-image` | Upload profile image (auth) |
| POST | `/api/upload/profile-image/public` | Upload profile image (public) |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |

## Project Structure

```
src/
├── config/          # Firebase, JWT, Cloudinary config
├── controllers/     # Request handlers
├── middleware/      # Auth, validation
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Response handler, errors
└── server.js        # Entry point
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development with nodemon |
| `npm start` | Production |

## Troubleshooting

- **CORS errors** — Ensure `FRONTEND_URL` matches the frontend origin
- **Invalid Google token** — Check OAuth config; add production URLs to authorized origins
- **Firebase init failed** — Ensure `FIREBASE_PRIVATE_KEY` includes `\n` for newlines
- **Missing env var** — Verify all required variables are set in `.env`

## License

ISC
