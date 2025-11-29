# WhatsApp & Instagram Automation Platform

A complete full-stack SaaS application for automating customer interactions on WhatsApp and Instagram, with integrated e-commerce features, order management, and AI-powered chatbot capabilities.

## 🚀 Features

### ✅ **Complete Authentication System**

- User registration with email verification
- Secure login with JWT tokens
- Password reset functionality
- Role-based access control (User/Admin)

### ✅ **Customer Management**

- Full CRUD operations for customers
- Platform filtering (WhatsApp/Instagram)
- Customer search and filtering
- Block/unblock customers
- Track customer orders and spending
- Beautiful data table with actions

### ✅ **Product Catalog**

- Complete product management system
- Grid and list view modes
- Stock management
- Category organization
- Search and filter products
- Price and inventory tracking

### ✅ **Order Management**

- Comprehensive order tracking
- Real-time status updates (Pending → Processing → Shipped → Delivered)
- Order statistics and revenue tracking
- Customer order history
- Payment status tracking
- Order details modal with full information

### ✅ **Messages & Inbox**

- Unified inbox for WhatsApp and Instagram
- Conversation list with search
- Real-time message display
- Platform-specific icons and indicators
- Chat interface with message history
- Customer information in chat header

### ✅ **Analytics Dashboard**

- Revenue trends with line charts
- Order status distribution (pie charts)
- Sales by category (bar charts)
- Platform-wise customer distribution
- KPI cards (Revenue, Orders, Customers, AOV)
- Recent activity feed
- Date range filtering

### ✅ **Settings & Integrations**

- Profile management
- WhatsApp Business API connection
- Instagram Graph API connection
- Business information settings
- Password change functionality
- Tab-based navigation for easy access

### ✅ **Beautiful UI/UX**

- Modern gradient designs
- Responsive layout for all devices
- Smooth animations and transitions
- Toast notifications for user feedback
- Loading states and error handling
- Consistent color scheme (Indigo & Purple)
- Icons from Lucide React

## 🛠️ Tech Stack

### **Frontend**

- **React 18.2.0** - UI library
- **Vite 5.0.8** - Build tool
- **React Router DOM 7.9.6** - Routing
- **Tailwind CSS 4.1.17** - Styling
- **Axios** - HTTP client
- **Recharts** - Charts and analytics
- **Lucide React** - Icon library

### **Backend**

- **Node.js 18.14.0** - Runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Nodemailer** - Email service
- **Razorpay** - Payment gateway

## 📁 Project Structure

```
whatsapp-automation-frontend/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Button.jsx           # Reusable button component
│   │   │   ├── Input.jsx            # Reusable input component
│   │   │   ├── Modal.jsx            # Reusable modal component
│   │   │   ├── Toast.jsx            # Toast notification system
│   │   │   └── ProtectedRoute.jsx   # Auth guard
│   │   ├── config/
│   │   │   └── api.config.js        # API endpoints
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Global auth state
│   │   ├── layouts/
│   │   │   └── DashboardLayout.jsx  # Dashboard wrapper with sidebar
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx      # Home page
│   │   │   ├── Login.jsx            # Login page
│   │   │   ├── Register.jsx         # Registration page
│   │   │   ├── Dashboard.jsx        # Dashboard overview
│   │   │   ├── Customers.jsx        # Customer management
│   │   │   ├── Products.jsx         # Product catalog
│   │   │   ├── Orders.jsx           # Order management
│   │   │   ├── Messages.jsx         # Inbox and chat
│   │   │   ├── Analytics.jsx        # Charts and insights
│   │   │   └── Settings.jsx         # Settings and integrations
│   │   ├── services/
│   │   │   ├── api.service.js       # Axios instance
│   │   │   ├── auth.service.js      # Auth API calls
│   │   │   ├── customer.service.js  # Customer API calls
│   │   │   ├── product.service.js   # Product API calls
│   │   │   └── order.service.js     # Order API calls
│   │   ├── App.jsx                  # Root component
│   │   └── main.jsx                 # Entry point
│   ├── .env                         # Environment variables
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── controllers/             # HTTP request handlers (11 files)
│   │   ├── services/                # Business logic (11 files)
│   │   ├── routes/                  # API routes (12 files)
│   │   ├── models/                  # Database models (5 files)
│   │   ├── middleware/              # Auth, validation, error handling
│   │   ├── utils/                   # Helper functions (6 files)
│   │   ├── db/
│   │   │   └── connection.js        # MongoDB connection
│   │   ├── app.js                   # Express app setup
│   │   └── server.js                # Server entry point
│   ├── .env                         # Environment variables
│   └── package.json
```

## 🔧 Installation & Setup

### Prerequisites

- Node.js 18+ installed
- MongoDB running locally or connection string
- Git installed

### 1. Clone the Repository

```bash
git clone <repository-url>
cd whatsapp-automation-frontend
```

### 2. Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Edit .env with your configuration:
MONGODB_URI=mongodb://localhost:27017/whatsapp-automation
JWT_SECRET=your-super-secret-jwt-key-change-this
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5174
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:5000/api" > .env
```

### 4. Start Development Servers

**Backend (Terminal 1):**

```bash
cd backend
npm run dev
```

**Frontend (Terminal 2):**

```bash
cd frontend
npm run dev
```

### 5. Access the Application

- **Frontend:** http://localhost:5174
- **Backend API:** http://localhost:5000
- **Default Admin:**
  - Email: `admin@chatshopai.com`
  - Password: `Admin@12345`

## 📊 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Customers

- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `PATCH /api/customers/:id/block` - Block/unblock customer

### Products

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders

- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get order by ID
- `POST /api/orders` - Create order
- `PUT /api/orders/:id/status` - Update order status
- `GET /api/orders/stats` - Get order statistics

### Messages

- `GET /api/messages/conversations` - Get all conversations
- `GET /api/messages/:customerId` - Get messages for customer
- `POST /api/messages/send` - Send message

### WhatsApp

- `POST /api/whatsapp/connect` - Connect WhatsApp Business
- `POST /api/whatsapp/send` - Send WhatsApp message
- `GET /api/whatsapp/status` - Get connection status

### Instagram

- `POST /api/instagram/connect` - Connect Instagram
- `POST /api/instagram/send` - Send Instagram message
- `GET /api/instagram/status` - Get connection status

## 🎨 UI Components

### Reusable Components

**Button Component**

```jsx
<Button variant="primary" size="md" icon={Plus}>
  Add Customer
</Button>
```

Variants: primary, secondary, success, danger, warning, ghost

**Input Component**

```jsx
<Input label="Email" type="email" icon={Mail} error={errors.email} required />
```

**Modal Component**

```jsx
<Modal isOpen={true} onClose={handleClose} title="Add Customer" size="lg">
  <form>...</form>
</Modal>
```

Sizes: sm, md, lg, xl

**Toast Notifications**

```jsx
const { success, error, info } = useToast();
success("Customer created successfully");
error("Failed to save");
```

## 🔐 Authentication Flow

1. User registers → Email sent (optional in dev)
2. User logs in → JWT token stored in localStorage
3. Token attached to all API requests via Axios interceptor
4. Protected routes check authentication via AuthContext
5. Auto-logout on 401 Unauthorized response

## 📱 Responsive Design

- **Desktop:** Full sidebar navigation with all features
- **Tablet:** Collapsible sidebar with icons
- **Mobile:** Hamburger menu with slide-in navigation

## 🚀 Deployment Checklist

### Backend Deployment

- [ ] Set production environment variables
- [ ] Configure MongoDB Atlas or production database
- [ ] Set up email service (SendGrid/AWS SES)
- [ ] Configure Razorpay live keys
- [ ] Set up WhatsApp Business API
- [ ] Set up Instagram Graph API
- [ ] Enable CORS for production frontend URL
- [ ] Deploy to Heroku/DigitalOcean/AWS

### Frontend Deployment

- [ ] Update VITE_API_URL to production backend
- [ ] Build production bundle (`npm run build`)
- [ ] Deploy to Vercel/Netlify/AWS S3
- [ ] Configure custom domain
- [ ] Enable SSL certificate

## 🔑 Environment Variables

### Backend (.env)

```env
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-secret-key
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com

# Email (optional for testing)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Razorpay (required for payments)
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret

# WhatsApp Business API
WHATSAPP_TOKEN=your-token
WHATSAPP_PHONE_ID=your-phone-id

# Instagram Graph API
INSTAGRAM_TOKEN=your-token
INSTAGRAM_BUSINESS_ID=your-business-id
```

### Frontend (.env)

```env
VITE_API_URL=https://api.yourdomain.com/api
```

## 📈 Future Enhancements

- [ ] Real-time chat with WebSocket
- [ ] AI chatbot integration (OpenAI/Gemini)
- [ ] Bulk message sending
- [ ] Message templates
- [ ] Automated responses
- [ ] Product image upload
- [ ] Invoice generation
- [ ] Export reports (PDF/Excel)
- [ ] Advanced analytics with filters
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Mobile app (React Native)

## 🐛 Known Issues

- Email service is optional (for testing without SMTP)
- Razorpay is optional (dummy credentials for testing)
- WhatsApp/Instagram APIs require business verification

## 👨‍💻 Development

### Run Tests

```bash
npm test
```

### Lint Code

```bash
npm run lint
```

### Build for Production

```bash
# Frontend
cd frontend
npm run build

# Backend (no build needed for Node.js)
```

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 💬 Support

For issues or questions:

- Create an issue on GitHub
- Email: support@chatshopai.com

## 🎉 Acknowledgments

- React team for the amazing library
- Tailwind CSS for the utility-first CSS framework
- Lucide for beautiful icons
- Recharts for chart components

---

**Built with ❤️ for WhatsApp & Instagram automation**

Ready to launch in 1 week! 🚀
