# Complete Setup Guide - ChatShop AI

## Project Structure

```
whatsapp-automation-frontend/
├── src/                    # Frontend (React + Vite)
│   ├── App.jsx            # Main application
│   ├── index.css          # Styles and animations
│   └── main.jsx
├── backend/               # Backend (Node.js + Express)
│   ├── src/
│   │   ├── config/       # Database configuration
│   │   ├── models/       # 5 Mongoose models (User, Customer, Message, Product, Order)
│   │   ├── controllers/  # 9 controllers (Auth, User, Subscription, WhatsApp, Instagram, Customer, Message, Product, Order, Analytics, Admin)
│   │   ├── routes/       # 10 route files
│   │   ├── middleware/   # Authentication & authorization
│   │   ├── utils/        # Email utility
│   │   └── app.js        # Express app
│   ├── server.js         # Entry point
│   ├── .env.example      # Environment template
│   ├── package.json
│   └── README.md
├── package.json           # Frontend dependencies
└── SETUP_GUIDE.md        # This file
```

## Complete Backend Features

✅ **Authentication System**

- User registration with email verification
- Login with JWT (7-day expiry)
- Password reset via email
- Email verification
- Role-based access (User/Admin)

✅ **User Management**

- Profile management
- Password change
- WhatsApp/Instagram account connection
- AI configuration (language, response speed)
- Business information

✅ **Subscription & Payments**

- 4 pricing plans with 50% discount
- Razorpay integration
- Payment verification
- Subscription tracking
- Plan cancellation

✅ **WhatsApp Integration**

- WhatsApp Business API
- Send text, images, videos, documents
- Webhook for incoming messages
- Auto customer creation
- Message history tracking

✅ **Instagram Integration**

- Instagram Graph API
- Direct message automation
- Webhook handling
- Customer engagement tracking

✅ **CRM System**

- Customer database (WhatsApp + Instagram)
- Search and filtering
- Customer tagging and notes
- Block/unblock functionality
- Order and spending history

✅ **Message Management**

- Message logging (incoming/outgoing)
- Platform-specific tracking
- AI generation tracking
- Delivery status
- Statistics and analytics

✅ **Product Catalog**

- Product CRUD operations
- Pricing and discounts
- Image management
- Stock tracking
- Categories and tags

✅ **Order Management**

- Order creation and tracking
- Payment status (COD, UPI, Razorpay)
- Order status workflow (pending → delivered)
- Shipping address
- Revenue tracking

✅ **Analytics Dashboard**

- Dashboard statistics
- Revenue analytics (week/month/year)
- Customer analytics (top customers, growth)
- Message analytics (volume, AI usage)
- Platform distribution

✅ **Admin Panel**

- User management
- Subscription monitoring
- System-wide statistics
- User CRUD operations
- Monthly revenue trends

## Setup Instructions

### Step 1: Install Backend Dependencies

```bash
cd backend
npm install
```

This installs 20+ packages including:

- express, mongoose, bcryptjs, jsonwebtoken
- razorpay, nodemailer, axios
- socket.io, cloudinary, multer
- helmet, cors, express-rate-limit

### Step 2: Create Environment File

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your actual credentials:

```env
# Required - MongoDB
MONGODB_URI=mongodb://localhost:27017/chatshop-ai
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatshop-ai

# Required - JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this

# Required - Email (use Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Required - Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Optional - WhatsApp (add later when ready)
WHATSAPP_VERIFY_TOKEN=your_whatsapp_verify_token
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token

# Optional - Instagram (add later when ready)
INSTAGRAM_VERIFY_TOKEN=your_instagram_verify_token
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### Step 3: Start MongoDB

**Option A - Local MongoDB:**

```bash
# Windows (if installed as service)
net start MongoDB

# Or download MongoDB Community Server from:
# https://www.mongodb.com/try/download/community
```

**Option B - MongoDB Atlas (Recommended):**

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create cluster
4. Get connection string
5. Add to MONGODB_URI in .env

### Step 4: Start Backend Server

```bash
cd backend
npm run dev
```

You should see:

```
Server running on port 3001
MongoDB Connected: ...
Default admin user created
```

**Default Admin Login:**

- Email: admin@chatshopai.com
- Password: Admin@123456

### Step 5: Start Frontend

Open new terminal:

```bash
npm run dev
```

Frontend runs on: http://localhost:5173
Backend runs on: http://localhost:3001

## Testing the API

### 1. Register a User

```bash
# Using PowerShell
$body = @{
    name = "Test User"
    email = "test@example.com"
    password = "Test@123456"
    phone = "9876543210"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/auth/register" -Method POST -Body $body -ContentType "application/json"
```

### 2. Login

```bash
$body = @{
    email = "test@example.com"
    password = "Test@123456"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $body -ContentType "application/json"

# Save the token
$token = $response.token
```

### 3. Get Profile (Protected Route)

```bash
$headers = @{
    Authorization = "Bearer $token"
}

Invoke-RestMethod -Uri "http://localhost:3001/api/users/profile" -Method GET -Headers $headers
```

## Next Steps

### 1. Email Configuration (Gmail)

1. Enable 2-factor authentication on Gmail
2. Generate App Password:
   - Go to Google Account → Security
   - App passwords → Select app "Mail" and device "Other"
   - Copy the 16-character password
3. Use this in EMAIL_PASSWORD in .env

### 2. Razorpay Setup

1. Sign up at https://razorpay.com
2. Go to Dashboard → Settings → API Keys
3. Generate Test/Live keys
4. Add to .env file
5. Configure webhook: `https://yourdomain.com/api/subscriptions/webhook`

### 3. WhatsApp Business API

1. Create Facebook Developer account: https://developers.facebook.com
2. Create new app → Add WhatsApp product
3. Get Phone Number ID and Access Token
4. Configure webhook: `https://yourdomain.com/api/whatsapp/webhook`
5. Verify token must match WHATSAPP_VERIFY_TOKEN in .env

**Test Mode:**

- You can test with WhatsApp sandbox before going live
- Follow Meta's WhatsApp Business API documentation

### 4. Instagram Graph API

1. Same Facebook app → Add Instagram product
2. Get Instagram Business Account ID
3. Generate long-lived access token
4. Configure webhook: `https://yourdomain.com/api/instagram/webhook`

## API Endpoints Summary

| Category      | Endpoints   | Authentication            |
| ------------- | ----------- | ------------------------- |
| Auth          | 5 endpoints | Public                    |
| Users         | 8 endpoints | JWT Required              |
| Subscriptions | 5 endpoints | JWT Required              |
| WhatsApp      | 5 endpoints | JWT Required              |
| Instagram     | 5 endpoints | JWT Required              |
| Customers     | 6 endpoints | JWT + Active Subscription |
| Messages      | 4 endpoints | JWT + Active Subscription |
| Products      | 5 endpoints | JWT + Active Subscription |
| Orders        | 6 endpoints | JWT + Active Subscription |
| Analytics     | 4 endpoints | JWT + Active Subscription |
| Admin         | 5 endpoints | JWT + Admin Role          |

**Total: 58 API endpoints**

## Database Schema

### Collections Created:

1. **users** - User accounts, subscriptions, integrations
2. **customers** - CRM contacts from WhatsApp/Instagram
3. **messages** - Message history and tracking
4. **products** - Product catalog
5. **orders** - Order management and revenue

### Auto-generated on First Run:

- Admin user (admin@chatshopai.com)
- Indexes for performance optimization

## Security Features

✅ JWT authentication with 7-day expiry
✅ Password hashing with bcrypt (10 rounds)
✅ Rate limiting: 100 requests per 15 minutes
✅ Helmet security headers
✅ CORS protection
✅ Input validation on all routes
✅ Role-based access control
✅ Subscription status verification
✅ Token verification for password resets

## Common Issues & Solutions

**Issue: MongoDB connection failed**

- Solution: Make sure MongoDB is running or check Atlas connection string

**Issue: Email not sending**

- Solution: Use Gmail App Password, not regular password

**Issue: Port 3001 already in use**

- Solution: Change PORT in .env or kill existing process

**Issue: JWT verification failed**

- Solution: Make sure JWT_SECRET is set in .env and token is valid

**Issue: CORS errors from frontend**

- Solution: Check FRONTEND_URL in .env matches your frontend URL

## Development Tips

1. **Testing with Postman:**

   - Import all 58 endpoints
   - Set up environment variables for token
   - Test authentication flow first

2. **Database Management:**

   - Use MongoDB Compass to view data
   - Connection string: same as MONGODB_URI

3. **Logs:**

   - Check terminal for error logs
   - All errors logged with context

4. **Hot Reload:**
   - Backend uses nodemon - auto-restarts on file changes
   - Frontend uses Vite HMR - instant updates

## Production Checklist

Before deploying to production:

- [ ] Change admin password
- [ ] Set strong JWT_SECRET
- [ ] Use MongoDB Atlas (not local)
- [ ] Set NODE_ENV=production
- [ ] Configure proper email service
- [ ] Set up HTTPS/SSL
- [ ] Configure real Razorpay keys
- [ ] Set up WhatsApp/Instagram production apps
- [ ] Enable rate limiting
- [ ] Set up monitoring (PM2, New Relic)
- [ ] Configure backups
- [ ] Set up logging service
- [ ] Add API documentation
- [ ] Security audit

## Support

Backend is fully functional with:

- Complete authentication system
- Payment integration ready
- WhatsApp/Instagram webhook handlers
- Full CRM functionality
- Analytics and reporting
- Admin dashboard APIs

All routes tested and working. Ready for frontend integration!
