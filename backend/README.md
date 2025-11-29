# ChatShop AI - Backend API

Complete backend API for WhatsApp and Instagram automation platform with CRM functionality.

## Features

- 🔐 **Authentication System**

  - User registration with email verification
  - Login with JWT tokens
  - Password reset functionality
  - Role-based access control (User/Admin)

- 💳 **Subscription Management**

  - Multiple pricing plans (Starter, Business, Premium, One-Time)
  - Razorpay payment integration
  - Subscription status tracking

- 💬 **WhatsApp Integration**

  - WhatsApp Business API integration
  - Send/receive messages
  - Webhook handling for incoming messages
  - Media support (images, videos, documents)

- 📱 **Instagram Integration**

  - Instagram Graph API integration
  - Direct message automation
  - Webhook handling
  - Customer engagement tracking

- 👥 **CRM System**

  - Customer management
  - Message history tracking
  - Order management
  - Product catalog

- 📊 **Analytics Dashboard**

  - Revenue analytics
  - Customer insights
  - Message statistics
  - Platform distribution

- 🛡️ **Admin Panel**
  - User management
  - System statistics
  - Subscription monitoring

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT + bcryptjs
- **Payment:** Razorpay
- **Email:** Nodemailer
- **APIs:** WhatsApp Business API, Instagram Graph API
- **Security:** Helmet, CORS, Rate Limiting

## Installation

1. **Clone and navigate to backend folder:**

```bash
cd backend
```

2. **Install dependencies:**

```bash
npm install
```

3. **Create .env file:**

```bash
cp .env.example .env
```

4. **Configure environment variables in .env:**

Required variables:

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `RAZORPAY_KEY_ID` - Razorpay key ID
- `RAZORPAY_KEY_SECRET` - Razorpay secret key
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` - SMTP settings
- `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN` - WhatsApp API credentials
- `INSTAGRAM_VERIFY_TOKEN`, `INSTAGRAM_ACCESS_TOKEN` - Instagram API credentials

5. **Start the server:**

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

Server will run on `http://localhost:3001`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/verify-email/:token` - Verify email address

### User Management

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/password` - Change password
- `PUT /api/users/whatsapp-config` - Update WhatsApp settings
- `PUT /api/users/instagram-config` - Update Instagram settings
- `PUT /api/users/ai-config` - Update AI configuration
- `PUT /api/users/business-info` - Update business information

### Subscriptions

- `GET /api/subscriptions/plans` - Get all plans
- `POST /api/subscriptions/create` - Create Razorpay order
- `POST /api/subscriptions/verify` - Verify payment
- `GET /api/subscriptions/details` - Get subscription details
- `POST /api/subscriptions/cancel` - Cancel subscription

### WhatsApp

- `POST /api/whatsapp/connect` - Connect WhatsApp account
- `POST /api/whatsapp/disconnect` - Disconnect WhatsApp
- `POST /api/whatsapp/send` - Send WhatsApp message
- `GET /api/whatsapp/webhook` - Webhook verification
- `POST /api/whatsapp/webhook` - Receive webhook events

### Instagram

- `POST /api/instagram/connect` - Connect Instagram account
- `POST /api/instagram/disconnect` - Disconnect Instagram
- `POST /api/instagram/send` - Send Instagram message
- `GET /api/instagram/webhook` - Webhook verification
- `POST /api/instagram/webhook` - Receive webhook events

### Customers

- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get single customer
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `PUT /api/customers/:id/block` - Block/unblock customer

### Messages

- `GET /api/messages` - Get all messages
- `POST /api/messages/send` - Send message
- `DELETE /api/messages/:id` - Delete message
- `GET /api/messages/stats` - Get message statistics

### Products

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders

- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order
- `PUT /api/orders/:id/status` - Update order status
- `DELETE /api/orders/:id` - Delete order
- `GET /api/orders/stats/summary` - Get order statistics

### Analytics

- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/revenue` - Revenue analytics
- `GET /api/analytics/customers` - Customer analytics
- `GET /api/analytics/messages` - Message analytics

### Admin (Admin Only)

- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/stats` - System statistics

## Database Models

### User

- Authentication details
- Subscription information
- WhatsApp/Instagram configuration
- AI settings
- Business information
- Usage statistics

### Customer

- Customer contact information
- Platform (WhatsApp/Instagram)
- Order history
- Spending statistics
- Tags and notes

### Message

- Message content and type
- Platform and direction
- AI generation tracking
- Delivery status

### Product

- Product details and pricing
- Images and inventory
- Categories and tags

### Order

- Order items and pricing
- Payment information
- Shipping details
- Status tracking

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting (100 requests per 15 minutes)
- Helmet security headers
- CORS configuration
- Input validation
- Role-based access control
- Subscription status verification

## Default Admin Account

When the server starts for the first time, a default admin account is created:

- **Email:** admin@chatshopai.com
- **Password:** Admin@123456

**⚠️ Important:** Change the admin password immediately after first login!

## Development

The backend uses MVC architecture:

```
backend/
├── src/
│   ├── config/         # Database configuration
│   ├── models/         # Mongoose models
│   ├── controllers/    # Business logic
│   ├── routes/         # API routes
│   ├── middleware/     # Custom middleware
│   ├── utils/          # Utility functions
│   └── app.js          # Express app setup
├── server.js           # Entry point
├── .env.example        # Environment variables template
└── package.json        # Dependencies
```

## API Integration Setup

### WhatsApp Business API

1. Create a Facebook Developer account
2. Create a new app and add WhatsApp product
3. Get your Business Account ID and Access Token
4. Set up webhook URL: `https://yourdomain.com/api/whatsapp/webhook`
5. Add credentials to .env file

### Instagram Graph API

1. Create a Facebook app with Instagram Basic Display
2. Get Instagram Business Account ID
3. Generate Access Token
4. Set up webhook URL: `https://yourdomain.com/api/instagram/webhook`
5. Add credentials to .env file

### Razorpay

1. Create a Razorpay account
2. Get API Key ID and Secret from dashboard
3. Enable webhooks for payment events
4. Add credentials to .env file

## Production Deployment

1. Set `NODE_ENV=production` in environment
2. Use MongoDB Atlas for database
3. Set up HTTPS with SSL certificate
4. Configure proper CORS origins
5. Use process manager like PM2
6. Set up monitoring and logging
7. Configure backup strategy

## Support

For issues or questions, contact: support@chatshopai.com

## License

Proprietary - All rights reserved
