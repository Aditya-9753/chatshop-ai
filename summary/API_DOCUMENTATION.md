# API Documentation

Base URL: `http://localhost:5000/api` (Development)
Production: `https://api.yourdomain.com/api`

## Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## 🔐 Auth Endpoints

### Register User

```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass@123",
  "phone": "+91 98765 43210"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "User registered successfully. Please verify your email.",
  "data": {
    "_id": "64abc123...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass@123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "64abc123...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Verify Email

```http
POST /auth/verify-email
Content-Type: application/json

{
  "token": "verification-token-from-email"
}
```

### Forgot Password

```http
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "john@example.com"
}
```

### Reset Password

```http
POST /auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass@123"
}
```

---

## 👥 Customer Endpoints

### Get All Customers

```http
GET /customers?search=john&platform=whatsapp&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**

- `search` (optional): Search by name or phone
- `platform` (optional): Filter by `whatsapp` or `instagram`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64abc123...",
      "name": "John Customer",
      "phone": "+91 98765 43210",
      "email": "john@example.com",
      "platform": "whatsapp",
      "totalOrders": 5,
      "totalSpent": 12500,
      "isBlocked": false,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5
  }
}
```

### Get Customer by ID

```http
GET /customers/:id
Authorization: Bearer <token>
```

### Create Customer

```http
POST /customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Customer",
  "phone": "+91 98765 43211",
  "email": "jane@example.com",
  "platform": "instagram"
}
```

### Update Customer

```http
PUT /customers/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Updated",
  "email": "jane.new@example.com"
}
```

### Delete Customer

```http
DELETE /customers/:id
Authorization: Bearer <token>
```

### Block/Unblock Customer

```http
PATCH /customers/:id/block
Authorization: Bearer <token>
Content-Type: application/json

{
  "isBlocked": true
}
```

---

## 📦 Product Endpoints

### Get All Products

```http
GET /products?search=laptop&category=electronics&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**

- `search` (optional): Search by name or description
- `category` (optional): Filter by category
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64def456...",
      "name": "MacBook Pro",
      "description": "Latest M3 chip",
      "price": 189900,
      "stock": 15,
      "category": "Electronics",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Get Product by ID

```http
GET /products/:id
Authorization: Bearer <token>
```

### Create Product

```http
POST /products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "iPhone 15 Pro",
  "description": "Latest iPhone model",
  "price": 134900,
  "stock": 25,
  "category": "Electronics"
}
```

### Update Product

```http
PUT /products/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "price": 129900,
  "stock": 20
}
```

### Delete Product

```http
DELETE /products/:id
Authorization: Bearer <token>
```

---

## 🛒 Order Endpoints

### Get All Orders

```http
GET /orders?status=pending&search=ORD001&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**

- `status` (optional): Filter by `pending`, `processing`, `shipped`, `delivered`, `cancelled`
- `search` (optional): Search by order number or customer name
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64ghi789...",
      "orderNumber": "ORD-1234567890",
      "customer": {
        "_id": "64abc123...",
        "name": "John Customer",
        "phone": "+91 98765 43210"
      },
      "items": [
        {
          "product": {
            "_id": "64def456...",
            "name": "MacBook Pro"
          },
          "quantity": 1,
          "price": 189900
        }
      ],
      "totalAmount": 189900,
      "status": "pending",
      "paymentStatus": "pending",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Get Order by ID

```http
GET /orders/:id
Authorization: Bearer <token>
```

### Create Order

```http
POST /orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": "64abc123...",
  "items": [
    {
      "productId": "64def456...",
      "quantity": 2,
      "price": 189900
    }
  ],
  "totalAmount": 379800
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "_id": "64ghi789...",
    "orderNumber": "ORD-1234567890",
    "status": "pending",
    "paymentStatus": "pending"
  }
}
```

### Update Order Status

```http
PUT /orders/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "processing"
}
```

**Allowed Status Flow:**

- `pending` → `processing` → `shipped` → `delivered`
- Any status → `cancelled`

### Get Order Statistics

```http
GET /orders/stats?period=week
Authorization: Bearer <token>
```

**Query Parameters:**

- `period` (optional): `today`, `week`, `month`, `year`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "totalOrders": 145,
    "totalRevenue": 2845000,
    "averageOrderValue": 19620,
    "pending": 12,
    "processing": 8,
    "shipped": 15,
    "delivered": 105,
    "cancelled": 5
  }
}
```

---

## 💬 Message Endpoints

### Get Conversations

```http
GET /messages/conversations
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64jkl012...",
      "customer": {
        "_id": "64abc123...",
        "name": "John Customer",
        "phone": "+91 98765 43210"
      },
      "platform": "whatsapp",
      "lastMessage": "When will my order arrive?",
      "lastMessageTime": "2024-01-15T14:30:00.000Z",
      "unreadCount": 2
    }
  ]
}
```

### Get Messages for Customer

```http
GET /messages/:customerId
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64mno345...",
      "customer": "64abc123...",
      "content": "Hello, I want to order a laptop",
      "direction": "inbound",
      "platform": "whatsapp",
      "timestamp": "2024-01-15T10:15:00.000Z",
      "isRead": true
    },
    {
      "_id": "64pqr678...",
      "customer": "64abc123...",
      "content": "Sure! We have MacBook Pro in stock",
      "direction": "outbound",
      "platform": "whatsapp",
      "timestamp": "2024-01-15T10:16:00.000Z",
      "isRead": true
    }
  ]
}
```

### Send Message

```http
POST /messages/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": "64abc123...",
  "content": "Your order has been shipped!",
  "platform": "whatsapp"
}
```

---

## 📱 WhatsApp Endpoints

### Connect WhatsApp Business

```http
POST /whatsapp/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "+91 98765 43210",
  "accessToken": "EAABsbCS...",
  "phoneNumberId": "123456789012345",
  "businessAccountId": "123456789012345"
}
```

### Send WhatsApp Message

```http
POST /whatsapp/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "+91 98765 43210",
  "message": "Hello! Your order is ready for pickup."
}
```

### Get Connection Status

```http
GET /whatsapp/status
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "connected": true,
    "phoneNumber": "+91 98765 43210",
    "businessName": "My Business"
  }
}
```

---

## 📸 Instagram Endpoints

### Connect Instagram

```http
POST /instagram/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "@mybusiness",
  "accessToken": "IGQVJXa2...",
  "businessAccountId": "123456789012345"
}
```

### Send Instagram Message

```http
POST /instagram/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipientId": "123456789",
  "message": "Thank you for your inquiry!"
}
```

### Get Connection Status

```http
GET /instagram/status
Authorization: Bearer <token>
```

---

## 👤 User Endpoints

### Get Profile

```http
GET /users/profile
Authorization: Bearer <token>
```

### Update Profile

```http
PUT /users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Updated",
  "phone": "+91 98765 99999"
}
```

### Change Password

```http
PUT /users/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "OldPass@123",
  "newPassword": "NewPass@123"
}
```

### Update Business Info

```http
PUT /users/business
Authorization: Bearer <token>
Content-Type: application/json

{
  "businessName": "My Shop",
  "businessEmail": "business@example.com",
  "businessPhone": "+91 98765 43210",
  "address": "123 Street, City",
  "website": "https://myshop.com",
  "description": "We sell quality products"
}
```

---

## 📊 Analytics Endpoints

### Get Dashboard Stats

```http
GET /analytics/dashboard
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "totalCustomers": 450,
    "totalProducts": 125,
    "totalOrders": 890,
    "totalRevenue": 4567890,
    "revenueGrowth": 12.5,
    "orderGrowth": 8.3,
    "customerGrowth": 15.2
  }
}
```

### Get Revenue Trend

```http
GET /analytics/revenue?period=week
Authorization: Bearer <token>
```

### Get Popular Products

```http
GET /analytics/products/popular?limit=10
Authorization: Bearer <token>
```

---

## ⚠️ Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "Access denied. Admin only."
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error details here"
}
```

---

## 📝 Notes

### Authentication

- Token expires in 7 days
- Refresh token by logging in again
- Store token securely (localStorage/sessionStorage)

### Pagination

- Default page size: 10 items
- Maximum page size: 100 items
- Use `page` and `limit` query parameters

### Rate Limiting

- 100 requests per 15 minutes per IP
- Authenticated users: 200 requests per 15 minutes

### File Uploads

- Maximum file size: 5MB
- Allowed formats: JPG, PNG, PDF
- Use multipart/form-data

### Webhooks (Coming Soon)

- WhatsApp incoming messages
- Instagram direct messages
- Payment confirmations

---

## 🔧 Testing with Postman

1. Import collection from `postman_collection.json`
2. Set environment variable: `API_URL = http://localhost:5000/api`
3. Login to get token
4. Set token in Authorization header for all requests

---

## 📞 Support

- Documentation: README.md
- Issues: GitHub Issues
- Email: support@chatshopai.com

---

**API Version:** 1.0.0  
**Last Updated:** 2024-01-15  
**Base URL:** http://localhost:5000/api (Development)
