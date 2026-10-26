# Admin User Setup Guide

## How to Create Your First Admin User

Since this is a developer/super admin dashboard, you need to manually create an admin user in the database.

### Option 1: Using MongoDB Compass or MongoDB Shell

1. Open MongoDB Compass or connect to your MongoDB database
2. Navigate to your database (usually `chatshop` or similar)
3. Find the `users` collection
4. Either:
   - **Create a new admin user** by inserting a document with `role: "admin"`
   - **Update an existing user** to make them admin

#### Example: Create New Admin User

```javascript
{
  "name": "Admin Name",
  "email": "admin@yourdomain.com",
  "password": "$2a$10$hashedPasswordHere", // You need to hash the password first
  "phone": "+1234567890",
  "role": "admin",
  "isVerified": true,
  "subscription": {
    "plan": null,
    "status": "inactive"
  },
  "createdAt": new Date(),
  "updatedAt": new Date()
}
```

#### Example: Update Existing User to Admin

```javascript
db.users.updateOne({ email: "your@email.com" }, { $set: { role: "admin" } });
```

### Option 2: Create Admin via API (Easier)

1. First, register a normal user account through the register page
2. Then, manually update the user's role in the database:

```javascript
// In MongoDB shell or Compass
db.users.updateOne({ email: "your@email.com" }, { $set: { role: "admin" } });
```

### Option 3: Using Node.js Script

Create a file `create-admin.js` in the `backend` folder:

```javascript
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./src/models/User.model");

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const adminData = {
      name: "Super Admin",
      email: "admin@yourdomain.com",
      password: await bcrypt.hash("YourSecurePassword123!", 10),
      phone: "+1234567890",
      role: "admin",
      isVerified: true,
    };

    const admin = await User.create(adminData);
    console.log("Admin user created successfully:", admin.email);

    mongoose.connection.close();
  } catch (error) {
    console.error("Error creating admin:", error);
    mongoose.connection.close();
  }
};

createAdmin();
```

Run it with:

```bash
cd backend
node create-admin.js
```

## Accessing the Admin Dashboard

Once you have created an admin user:

1. Go to: `http://localhost:5174/admin/login`
2. Login with your admin credentials
3. You'll be redirected to the Admin Dashboard

## Admin Dashboard Features

### Overview Stats

- Total Users (active/inactive)
- Premium Users vs Free Users
- Total Revenue from subscriptions
- Recent Signups (last 7 days)

### Subscription Breakdown

- Starter Plan users (₹499/month)
- Business Plan users (₹999/month)
- Premium Plan users (₹1999/month)

### Platform Connections

- WhatsApp connected users
- Instagram connected users

### System Wide Data

- Total Customers across all users
- Total Orders across all users
- Total Products across all users
- Total Messages across all users

### User Management

- View all users
- Search users by name/email/phone
- Filter by subscription status/plan
- View individual user details and stats
- Delete users (with all their data)

## Security Notes

- Admin routes are protected with `isAdmin` middleware
- Only users with `role: "admin"` can access admin endpoints
- All access attempts are logged
- Regular users cannot access admin dashboard even if they know the URL

## Recommended: Environment Variables

Add to your `.env` file:

```env
ADMIN_SECRET_KEY=your-super-secret-admin-key
```

This can be used for additional admin verification if needed.

## API Endpoints

All admin endpoints are prefixed with `/api/admin`:

- `GET /api/admin/dashboard` - Get dashboard stats
- `GET /api/admin/users` - Get all users (with pagination & filters)
- `GET /api/admin/users/:id` - Get single user details
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user and all their data
- `GET /api/admin/stats` - Get system statistics

All endpoints require:

1. Valid JWT token
2. User role must be "admin"
