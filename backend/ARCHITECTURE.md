# Backend Project Structure - Layered Architecture

## 📁 Complete Directory Structure

```
backend/
├── src/
│   ├── routes/              # API Route Definitions (12 files)
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── subscription.routes.js
│   │   ├── customer.routes.js
│   │   ├── message.routes.js
│   │   ├── product.routes.js
│   │   ├── order.routes.js
│   │   ├── whatsapp.routes.js
│   │   ├── instagram.routes.js
│   │   ├── analytics.routes.js
│   │   └── admin.routes.js
│   │
│   ├── controllers/         # Request Handlers (11 files)
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── subscription.controller.js
│   │   ├── customer.controller.js
│   │   ├── message.controller.js
│   │   ├── product.controller.js
│   │   ├── order.controller.js
│   │   ├── whatsapp.controller.js
│   │   ├── instagram.controller.js
│   │   ├── analytics.controller.js
│   │   └── admin.controller.js
│   │
│   ├── services/            # Business Logic Layer (11 files)
│   │   ├── auth.service.js
│   │   ├── user.service.js
│   │   ├── subscription.service.js
│   │   ├── customer.service.js
│   │   ├── message.service.js
│   │   ├── product.service.js
│   │   ├── order.service.js
│   │   ├── whatsapp.service.js
│   │   ├── instagram.service.js
│   │   ├── analytics.service.js
│   │   └── admin.service.js
│   │
│   ├── models/              # Database Models (5 files)
│   │   ├── User.model.js
│   │   ├── Customer.model.js
│   │   ├── Message.model.js
│   │   ├── Product.model.js
│   │   └── Order.model.js
│   │
│   ├── middleware/          # Custom Middleware (1 file)
│   │   └── auth.middleware.js
│   │
│   ├── utils/               # Utility Functions (6 files)
│   │   ├── sendEmail.js
│   │   ├── razorpay.helper.js
│   │   ├── order.helper.js
│   │   ├── whatsapp.api.js
│   │   ├── instagram.api.js
│   │   └── response.handler.js
│   │
│   ├── db/                  # Database Configuration (1 file)
│   │   └── connection.js
│   │
│   └── app.js               # Express Application Setup
│
├── server.js                # Entry Point
├── .env.example             # Environment Variables Template
├── package.json             # Dependencies
└── README.md                # Documentation
```

## 🏗️ Architecture Layers

### **Layer 1: Routes**

**Location:** `src/routes/`

**Purpose:** Define API endpoints and apply middleware

**Example:**

```javascript
// src/routes/user.routes.js
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const { getProfile, updateProfile } = require("../controllers/user.controller");

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

module.exports = router;
```

**Responsibilities:**

- Define HTTP methods (GET, POST, PUT, DELETE)
- Apply authentication/authorization middleware
- Bind routes to controller functions
- Input validation (express-validator)

---

### **Layer 2: Controllers**

**Location:** `src/controllers/`

**Purpose:** Handle HTTP requests and responses

**Example:**

```javascript
// src/controllers/user.controller.js
const userService = require("../services/user.service");
const ResponseHandler = require("../utils/response.handler");

exports.getProfile = async (req, res) => {
  try {
    const user = await userService.getProfile(req.user._id);
    return ResponseHandler.success(res, user);
  } catch (error) {
    return ResponseHandler.error(res, error.message);
  }
};
```

**Responsibilities:**

- Receive HTTP requests
- Extract data from req.body, req.params, req.query
- Call service layer methods
- Format and send responses using ResponseHandler
- Handle errors gracefully

---

### **Layer 3: Services**

**Location:** `src/services/`

**Purpose:** Implement business logic

**Example:**

```javascript
// src/services/user.service.js
const User = require("../models/User.model");

class UserService {
  async getProfile(userId) {
    const user = await User.findById(userId).select("-password");
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateProfile(userId, data) {
    const user = await User.findById(userId);
    if (data.name) user.name = data.name;
    await user.save();
    return user;
  }
}

module.exports = new UserService();
```

**Responsibilities:**

- Business logic and validation
- Database operations via models
- Call external APIs (WhatsApp, Instagram)
- Data transformation
- Error throwing with meaningful messages

---

### **Layer 4: Models**

**Location:** `src/models/`

**Purpose:** Define database schemas

**Example:**

```javascript
// src/models/User.model.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
});

module.exports = mongoose.model("User", userSchema);
```

**Responsibilities:**

- Schema definition
- Data validation
- Indexes
- Virtual fields
- Instance/static methods

---

### **Layer 5: Middleware**

**Location:** `src/middleware/`

**Purpose:** Process requests before reaching controllers

**Example:**

```javascript
// src/middleware/auth.middleware.js
const jwt = require("jsonwebtoken");

exports.protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false });

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(decoded.id);
  next();
};
```

**Responsibilities:**

- Authentication (JWT verification)
- Authorization (role/permission checks)
- Request preprocessing
- Rate limiting

---

### **Layer 6: Utils**

**Location:** `src/utils/`

**Purpose:** Reusable helper functions

**Types:**

**1. API Helpers** (`whatsapp.api.js`, `instagram.api.js`)

```javascript
class WhatsAppAPI {
  async sendMessage(data) {
    const response = await axios.post(WHATSAPP_API_URL, data);
    return response.data;
  }
}
```

**2. Payment Helpers** (`razorpay.helper.js`)

```javascript
class RazorpayHelper {
  async createOrder(orderData) {
    return await razorpay.orders.create(orderData);
  }
  verifySignature(orderId, paymentId, signature) {
    // Signature verification logic
  }
}
```

**3. Business Helpers** (`order.helper.js`)

```javascript
class OrderHelper {
  generateOrderNumber() {
    return `ORD-${Date.now()}-${Math.random()}`;
  }
  calculateOrderTotals(items, taxRate, shipping) {
    // Calculation logic
  }
}
```

**4. Email Utility** (`sendEmail.js`)

```javascript
const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({ from, to, subject, html });
};
```

**5. Response Handler** (`response.handler.js`)

```javascript
class ResponseHandler {
  static success(res, data, message) {
    return res.json({ success: true, message, data });
  }
  static error(res, message, statusCode) {
    return res.status(statusCode).json({ success: false, message });
  }
}
```

---

### **Layer 7: Database**

**Location:** `src/db/`

**Purpose:** Database connection and configuration

**Example:**

```javascript
// src/db/connection.js
const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB Connected");
  await createDefaultAdmin();
};
```

---

## 📊 Request Flow

```
HTTP Request
    ↓
[Routes Layer]
    ↓
[Middleware] → JWT Verification → Role Check → Subscription Check
    ↓
[Controller] → Extract request data → Validate input
    ↓
[Service] → Business logic → Database operations → External APIs
    ↓
[Model] → MongoDB Operations
    ↓
[Service] → Return processed data
    ↓
[Controller] → Format response
    ↓
[Response Handler] → Send JSON response
    ↓
HTTP Response
```

## 🔄 Data Flow Example: User Registration

**1. Route** (`auth.routes.js`)

```javascript
router.post(
  "/register",
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  register
);
```

**2. Controller** (`auth.controller.js`)

```javascript
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ResponseHandler.validationError(res, errors.array());
  }
  const result = await authService.register(req.body);
  return ResponseHandler.created(res, result);
};
```

**3. Service** (`auth.service.js`)

```javascript
async register(userData) {
  // Check if user exists
  const exists = await User.findOne({ email: userData.email });
  if (exists) throw new Error("User exists");

  // Hash password
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  // Create user
  const user = await User.create({
    ...userData,
    password: hashedPassword
  });

  // Send verification email
  await sendEmail({...});

  // Generate JWT
  const token = jwt.sign({ id: user._id }, JWT_SECRET);

  return { token, user };
}
```

**4. Model** (`User.model.js`)

```javascript
const user = new User({
  name,
  email,
  password,
  phone,
});
await user.save(); // Mongoose validation + save to MongoDB
```

**5. Response**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "token": "eyJhbGc...",
    "user": { "id": "...", "name": "...", "email": "..." }
  }
}
```

## 📦 Module Exports Pattern

**Services:** Class instances

```javascript
class UserService {
  /* methods */
}
module.exports = new UserService();
```

**Controllers:** Named exports

```javascript
exports.getProfile = async (req, res) => {
  /* ... */
};
exports.updateProfile = async (req, res) => {
  /* ... */
};
```

**Models:** Mongoose models

```javascript
module.exports = mongoose.model("User", userSchema);
```

**Utils:** Class instances or functions

```javascript
// Class
class Helper {
  /* methods */
}
module.exports = new Helper();

// Function
const sendEmail = async (data) => {
  /* ... */
};
module.exports = sendEmail;
```

## 🎯 Key Benefits of This Architecture

1. **Separation of Concerns:** Each layer has a single responsibility
2. **Testability:** Services can be tested independently
3. **Reusability:** Services and utils can be reused across controllers
4. **Maintainability:** Easy to locate and modify code
5. **Scalability:** Easy to add new features
6. **Clean Code:** No business logic in controllers
7. **Error Handling:** Centralized error handling
8. **API Consistency:** ResponseHandler ensures uniform responses

## 📝 File Naming Conventions

- **Routes:** `resource.routes.js` (e.g., `user.routes.js`)
- **Controllers:** `resource.controller.js`
- **Services:** `resource.service.js`
- **Models:** `Resource.model.js` (PascalCase)
- **Utils:** `descriptive.helper.js` or `name.api.js`
- **Middleware:** `purpose.middleware.js`

## 🚀 Adding a New Feature

**Example: Add Product Reviews**

1. **Create Model** (`src/models/Review.model.js`)
2. **Create Service** (`src/services/review.service.js`)
3. **Create Controller** (`src/controllers/review.controller.js`)
4. **Create Routes** (`src/routes/review.routes.js`)
5. **Register in app.js:** `app.use("/api/reviews", reviewRoutes)`

## 💡 Best Practices

- ✅ Controllers should be thin (only handle requests)
- ✅ Services contain all business logic
- ✅ Use try-catch in controllers, throw errors in services
- ✅ Always use ResponseHandler for consistency
- ✅ Validate input in routes using express-validator
- ✅ Keep utilities pure and reusable
- ✅ Use async/await (no callbacks)
- ✅ Log errors with context
- ✅ Use environment variables for configuration

This architecture ensures your backend is **production-ready**, **maintainable**, and **scalable**! 🎉
