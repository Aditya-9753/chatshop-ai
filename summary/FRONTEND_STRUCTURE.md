# Frontend Structure Documentation

## 📁 Complete Folder Structure

```
frontend/
├── public/
├── src/
│   ├── components/          # Reusable UI components
│   │   └── ProtectedRoute.jsx
│   ├── config/              # Configuration files
│   │   └── api.config.js
│   ├── context/             # React contexts
│   │   └── AuthContext.jsx
│   ├── layouts/             # Layout components
│   │   └── DashboardLayout.jsx
│   ├── pages/               # Page components
│   │   ├── LandingPage.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── Dashboard.jsx
│   ├── services/            # API services
│   │   ├── api.service.js
│   │   └── auth.service.js
│   ├── App.jsx              # Main app with routing
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── .env                     # Environment variables
├── .env.example             # Environment template
├── package.json
├── tailwind.config.js
├── vite.config.js
└── index.html
```

---

## 🔧 Configuration

### Environment Variables (`.env`)

```
VITE_API_URL=http://localhost:5000/api
```

### API Configuration (`src/config/api.config.js`)

- **BASE_URL**: Backend API endpoint
- **API_ENDPOINTS**: All backend routes organized by feature
  - Auth endpoints (login, register, verify, etc.)
  - User endpoints (profile, settings, etc.)
  - Subscription endpoints
  - WhatsApp/Instagram endpoints
  - Customers, Messages, Products, Orders
  - Analytics, Admin

---

## 🎯 Services Layer

### API Service (`src/services/api.service.js`)

- **Axios instance** with interceptors
- **Request interceptor**: Adds Bearer token to headers
- **Response interceptor**:
  - Handles errors globally
  - Auto-redirects to login on 401
  - Formats error messages

### Auth Service (`src/services/auth.service.js`)

- `login(email, password)` - Login user, store token
- `register(userData)` - Register new user
- `verifyEmail(token)` - Verify email
- `forgotPassword(email)` - Send reset link
- `resetPassword(token, newPassword)` - Reset password
- `logout()` - Clear token, redirect
- `getCurrentUser()` - Get user from localStorage
- `isAuthenticated()` - Check if logged in

---

## 🔐 Authentication Context

### AuthContext (`src/context/AuthContext.jsx`)

Provides global auth state:

- `user` - Current user object
- `loading` - Loading state
- `login(email, password)` - Login function
- `register(userData)` - Register function
- `logout()` - Logout function
- `updateUser(userData)` - Update user in state
- `isAuthenticated` - Boolean
- `isAdmin` - Boolean (user.role === 'admin')

### Protected Routes (`src/components/ProtectedRoute.jsx`)

- Wraps routes that require authentication
- Shows loading spinner while checking auth
- Redirects to `/login` if not authenticated
- `adminOnly` prop for admin-only routes

---

## 📄 Pages

### 1. Landing Page (`src/pages/LandingPage.jsx`)

- **Hero section** with animated phone mockup
- **Features section** (8 features)
- **Pricing section** (4 plans)
- **FAQ section** (5 questions)
- **Contact form**
- **Footer**
- Links to `/login` and `/register`

### 2. Login Page (`src/pages/Login.jsx`)

- Email & password form
- Remember me checkbox
- Forgot password link
- Link to register
- Error handling
- Redirects to `/dashboard` on success

### 3. Register Page (`src/pages/Register.jsx`)

- Name, email, business name, phone, password fields
- Password confirmation
- Email verification message on success
- Auto-redirects to login after 3 seconds

### 4. Dashboard Page (`src/pages/Dashboard.jsx`)

- Welcome message with user name
- **6 stat cards**:
  - Total Customers
  - Total Messages
  - Total Orders
  - Total Revenue
  - Products
  - Conversion Rate
- **Quick Actions**: Add Customer, Add Product, Create Order
- **Connection Status**: WhatsApp & Instagram
- **Recent Activity** feed

---

## 🎨 Layouts

### Dashboard Layout (`src/layouts/DashboardLayout.jsx`)

- **Sidebar** (desktop) with navigation
  - Logo
  - Dashboard, Customers, Messages, Products, Orders, Analytics, Settings
  - User profile section
  - Logout button
- **Mobile sidebar** (hamburger menu)
- **Top bar**:
  - Menu button (mobile)
  - Search bar
  - Notifications bell
- **Main content area**: Renders child routes via `<Outlet />`

---

## 🛣️ Routing Structure

### Public Routes

- `/` - Landing page
- `/login` - Login page
- `/register` - Register page

### Protected Routes (require authentication)

- `/dashboard` - Dashboard overview
- `/dashboard/customers` - Customers list (placeholder)
- `/dashboard/messages` - Messages inbox (placeholder)
- `/dashboard/products` - Products catalog (placeholder)
- `/dashboard/orders` - Orders management (placeholder)
- `/dashboard/analytics` - Analytics reports (placeholder)
- `/dashboard/settings` - Account settings (placeholder)

### Admin Routes (require admin role)

- `/admin` - Admin dashboard (placeholder)

### Catch-All

- `*` - Redirects to `/`

---

## 🔄 Data Flow Example

### User Login Flow

```
1. User enters email/password in Login.jsx
   ↓
2. Calls AuthContext.login(email, password)
   ↓
3. AuthService.login() makes API call to backend
   ↓
4. Backend returns { token, user }
   ↓
5. Token stored in localStorage
   ↓
6. User stored in localStorage & AuthContext state
   ↓
7. Navigate to /dashboard
   ↓
8. ProtectedRoute checks auth status
   ↓
9. DashboardLayout renders with user data
   ↓
10. Dashboard.jsx fetches analytics data
```

### API Request Flow

```
1. Component calls api.get(API_ENDPOINTS.ANALYTICS.DASHBOARD)
   ↓
2. Request interceptor adds: Authorization: Bearer {token}
   ↓
3. Request sent to http://localhost:5000/api/analytics/dashboard
   ↓
4. Backend processes request
   ↓
5. Response interceptor extracts response.data
   ↓
6. Component receives data
```

---

## 🎨 Styling

### Tailwind CSS Classes Used

- **Gradients**: `bg-gradient-to-r from-indigo-600 to-purple-600`
- **Shadows**: `shadow-xl`, `shadow-lg`
- **Rounded corners**: `rounded-xl`, `rounded-2xl`
- **Transitions**: `transition-all duration-300`
- **Hover effects**: `hover:scale-105`, `hover:shadow-xl`
- **Responsive**: `md:grid-cols-2`, `lg:grid-cols-3`

### Color Scheme

- **Primary**: Indigo/Purple gradients
- **Success**: Green (WhatsApp)
- **Info**: Pink (Instagram)
- **Background**: Gray-50, White
- **Text**: Gray-900, Gray-600

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^7.9.6",
    "axios": "latest",
    "recharts": "latest",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.22",
    "postcss": "^8.5.6",
    "tailwindcss": "^4.1.17",
    "vite": "^5.0.8"
  }
}
```

---

## 🚀 Running the Application

### Development

```bash
cd frontend
npm install
npm run dev
```

Access at: `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

---

## ✅ What's Working

### ✅ Implemented

- Landing page with all sections
- Login/Register pages with validation
- Protected routes with authentication
- Dashboard layout with sidebar
- Dashboard overview with stats
- API integration setup
- Auth context and services
- Routing structure

### 🚧 To Be Implemented

- Customers page with CRUD
- Messages inbox
- Products catalog
- Orders management
- Analytics reports
- Settings page
- Admin dashboard
- Real-time notifications
- File upload for product images
- Payment integration UI

---

## 🔗 Backend Integration

### API Connection

Frontend connects to backend at:

- **Development**: `http://localhost:5000/api`
- **Production**: Set `VITE_API_URL` in `.env`

### Authentication Flow

1. Login returns JWT token
2. Token stored in `localStorage`
3. Token sent in `Authorization: Bearer {token}` header
4. Backend validates token
5. Protected routes accessible

### Error Handling

- **401**: Auto-logout, redirect to login
- **Network errors**: Show user-friendly message
- **Validation errors**: Display field-specific errors

---

## 📱 Responsive Design

- **Mobile**: < 768px

  - Hamburger menu
  - Stack layout
  - Full-width cards

- **Tablet**: 768px - 1024px

  - 2-column grid
  - Collapsible sidebar

- **Desktop**: > 1024px
  - Fixed sidebar
  - 3-column grid
  - Hover effects

---

## 🎯 Next Steps

1. **Complete Dashboard Pages**

   - Customers CRUD with table
   - Messages inbox with filters
   - Products with image upload
   - Orders with status tracking

2. **Add Admin Panel**

   - User management
   - System statistics
   - Settings configuration

3. **Real-time Features**

   - WebSocket for messages
   - Live notifications
   - Auto-refresh stats

4. **UI Enhancements**

   - Loading skeletons
   - Toast notifications
   - Confirmation modals
   - Form validation

5. **Testing**
   - Unit tests
   - Integration tests
   - E2E tests

---

## 🏗️ Architecture Benefits

✅ **Modular**: Clear separation of concerns
✅ **Scalable**: Easy to add new features
✅ **Maintainable**: Organized folder structure
✅ **Reusable**: Shared components and services
✅ **Type-safe**: Consistent API patterns
✅ **Secure**: Protected routes, token management
✅ **User-friendly**: Responsive, modern UI

---

**Frontend is now connected to backend and ready for development!** 🎉
