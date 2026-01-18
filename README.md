# CalibrateNow Backend API

Backend server for CalibrateNow with custom OAuth JWT authentication using Firebase Firestore for data storage.

## 🚀 Features

- ✅ Email/Password authentication with bcrypt hashing
- ✅ Google OAuth integration
- ✅ JWT-based access & refresh tokens
- ✅ Secure httpOnly cookies for refresh tokens
- ✅ Token rotation for enhanced security
- ✅ Firebase Firestore for data persistence
- ✅ Input validation and sanitization
- ✅ Comprehensive error handling
- ✅ CORS configuration
- ✅ RESTful API design

## 📋 Prerequisites

Before you begin, ensure you have:

- Node.js (v16 or higher)
- npm or yarn
- Firebase project with Firestore database
- Google OAuth credentials

## 🔧 Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**

Copy `env.example` to `.env` and fill in the required values:

```bash
cp env.example .env
```

### Required Environment Variables:

#### **Server Configuration**
```env
PORT=5000
NODE_ENV=development
```

#### **Firebase Admin SDK**
Get these from Firebase Console:
1. Go to https://console.firebase.google.com/
2. Select your project
3. Navigate to **Project Settings** > **Service Accounts**
4. Click **"Generate New Private Key"**
5. Download the JSON file and extract these values:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
```

⚠️ **Important**: The private key must include the `\n` characters for newlines.

#### **JWT Secrets**
Generate strong random secrets (minimum 32 characters):

```bash
# Generate secrets using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```env
JWT_ACCESS_SECRET=your-generated-access-secret-here
JWT_REFRESH_SECRET=your-generated-refresh-secret-here
```

#### **Google OAuth Configuration**
Get these from Google Cloud Console:
1. Go to https://console.cloud.google.com/
2. Select your Firebase project
3. Navigate to **APIs & Services** > **Credentials**
4. Create **OAuth 2.0 Client ID** (Web application)
5. Add authorized origins: `http://localhost:5173`
6. Add authorized redirect URIs: `http://localhost:5173`

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### **CORS Configuration**
```env
FRONTEND_URL=http://localhost:5173
```

## 🗄️ Firebase Firestore Setup

### Create Collections:

The following collections will be automatically created when you use the API:

1. **users** - Stores user profiles
   ```javascript
   {
     email: string,
     displayName: string,
     photoURL: string | null,
     provider: 'email' | 'google',
     passwordHash: string (only for email provider),
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

2. **refresh_tokens** - Stores JWT refresh tokens
   ```javascript
   {
     tokenHash: string (SHA-256),
     userId: string,
     expiresAt: timestamp,
     createdAt: timestamp
   }
   ```

### Security Rules:

Set up Firestore security rules (backend-only access):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;  // All access via backend only
    }
  }
}
```

## 🚀 Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000` (or your configured PORT).

## 📡 API Endpoints

### Authentication Endpoints

#### Register with Email
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "displayName": "John Doe" (optional)
}
```

#### Login with Email
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

#### Google OAuth Login
```http
POST /api/auth/google
Content-Type: application/json

{
  "idToken": "google-id-token-from-frontend"
}
```

#### Refresh Access Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

Or if using cookies (automatic):
```http
POST /api/auth/refresh
Cookie: refreshToken=your-refresh-token
```

#### Logout
```http
POST /api/auth/logout
Cookie: refreshToken=your-refresh-token
```

#### Verify Token
```http
GET /api/auth/verify
Authorization: Bearer <your-access-token>
```

### User Endpoints

#### Get Profile
```http
GET /api/user/profile
Authorization: Bearer <your-access-token>
```

#### Update Profile
```http
PUT /api/user/profile
Authorization: Bearer <your-access-token>
Content-Type: application/json

{
  "displayName": "New Name",
  "photoURL": "https://example.com/photo.jpg"
}
```

### Health Check
```http
GET /health
```

## 🔐 Authentication Flow

### Email/Password Registration:
1. Client sends email, password, and optional displayName
2. Server validates input and checks for existing user
3. Password is hashed with bcrypt (10 rounds)
4. User is created in Firestore
5. Access token (15min) and refresh token (7d) are generated
6. Refresh token is stored in Firestore and set as httpOnly cookie
7. Both tokens are returned to client

### Google OAuth Login:
1. Client obtains Google ID token from Google Sign-In
2. Client sends ID token to backend
3. Server verifies token with Google's API
4. Server checks if user exists by email
5. If new user, account is created
6. Access and refresh tokens are generated and returned

### Token Refresh:
1. Client sends refresh token (from cookie or body)
2. Server verifies refresh token JWT signature
3. Server checks if token exists in Firestore and is not expired
4. Old refresh token is revoked (deleted)
5. New access token and refresh token are generated
6. New refresh token is stored in Firestore
7. Tokens are returned to client

## 🛡️ Security Features

- ✅ **Password Hashing**: bcrypt with 10 rounds
- ✅ **JWT Tokens**: Signed with strong secrets
- ✅ **Token Rotation**: Refresh tokens are rotated on use
- ✅ **httpOnly Cookies**: Refresh tokens stored securely
- ✅ **CORS Protection**: Limited to frontend origin
- ✅ **Input Validation**: All inputs validated and sanitized
- ✅ **SQL Injection Protection**: Using Firestore (NoSQL)
- ✅ **XSS Protection**: HTML tags stripped from inputs
- ✅ **Rate Limiting**: Recommended for production

## 🧪 Testing the API

You can test the API using tools like:
- Postman
- Insomnia
- cURL
- Thunder Client (VS Code extension)

### Example cURL commands:

**Register:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","displayName":"Test User"}'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'
```

**Get Profile:**
```bash
curl -X GET http://localhost:5000/api/user/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📝 Project Structure

```
Calibrate-be/
├── src/
│   ├── config/
│   │   ├── firestore.js         # Firebase Admin SDK setup
│   │   └── jwt.js               # JWT configuration
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication middleware
│   │   └── validateRequest.js   # Input validation middleware
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   └── user.js              # User routes
│   ├── controllers/
│   │   ├── authController.js    # Auth business logic
│   │   └── userController.js    # User business logic
│   ├── services/
│   │   ├── googleOauth.js       # Google OAuth verification
│   │   ├── tokenService.js      # JWT token management
│   │   └── userService.js       # User CRUD operations
│   ├── utils/
│   │   ├── responseHandler.js   # Standardized API responses
│   │   └── errors.js            # Custom error classes
│   └── server.js                # Express app entry point
├── .env                         # Environment variables (create this)
├── env.example                  # Environment template
├── .gitignore
├── package.json
└── README.md
```

## 🐛 Troubleshooting

### Common Issues:

1. **"Missing required environment variable"**
   - Ensure all variables in `env.example` are in your `.env` file
   - Check for typos in variable names

2. **"Failed to initialize Firebase Admin SDK"**
   - Verify your Firebase credentials are correct
   - Ensure `FIREBASE_PRIVATE_KEY` includes `\n` for newlines
   - Check that you have the correct project ID

3. **"Invalid Google token"**
   - Verify your Google Client ID matches the one used in frontend
   - Ensure the token is fresh (tokens expire quickly)
   - Check that Google OAuth is properly configured in Google Cloud Console

4. **"JWT must be at least 32 characters"**
   - Generate proper secrets using the command provided above
   - Don't use simple passwords as JWT secrets

5. **CORS errors**
   - Verify `FRONTEND_URL` in `.env` matches your frontend URL
   - Check that frontend is running on the specified URL

## 📚 Additional Resources

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [JWT.io](https://jwt.io/) - JWT debugger
- [Express.js Documentation](https://expressjs.com/)

## 🔄 Maintenance Tasks

### Clean up expired refresh tokens:

You can manually clean up expired tokens by calling:
```javascript
import tokenService from './src/services/tokenService.js';
await tokenService.cleanupExpiredTokens();
```

Consider setting up a cron job for this in production.

## 📄 License

ISC

## 👥 Support

For issues or questions, please refer to the project documentation or contact the development team.

