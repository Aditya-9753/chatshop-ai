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
- **Default Admin** (one email, two passwords, at `/admin/login`):
  - Email: `admin@chatshopai.com`
  - Super Admin password: `Admin@12345`
  - Admin panel password: `Admin@123456`

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

## 🎨 Design System

All colours, type and motion are tokens defined once in `frontend/src/index.css` (light and dark) and used through Tailwind classes such as `bg-surface`, `text-fg`, `text-fg-muted`, `border-line` and `bg-accent`. Dark mode comes from the `.dark` class that `ThemeContext` sets, so components never branch on the theme. Fonts are Inter and JetBrains Mono, self-hosted.

The component kit lives in `frontend/src/components/ui/` and is imported from one place:

```jsx
import { Button, Input, DataTable, Drawer, StatusPill, PageHeader } from "../components/ui";

<PageHeader title="Orders" description="…" actions={<Button icon={Plus}>New order</Button>} />
<DataTable columns={columns} rows={orders} searchable loading={loading} error={error} empty={{ title: "No orders yet" }} />
```

Kit: Button, Input, Textarea, Select, Switch, Checkbox, Card, StatCard, DataTable, Badge, StatusPill, ChannelBadge, Modal, Drawer, ConfirmDialog, DropdownMenu, Tooltip, Tabs, Avatar, Skeleton, EmptyState, ErrorState, Alert. Toasts use `useToast()` (sonner). Ctrl+K opens the command palette.

Rules for new UI: use tokens and kit components only (no hex values, no `isDarkMode ? …` colour ternaries, no one-off gradients), design loading, empty and error states, and keep files under 500 lines.

## 🛡️ Super admin panel

Log in at `/admin/login` with `admin@chatshopai.com`. The password decides which panel opens:

| Password | Panel | Can do |
|---|---|---|
| `Admin@12345` (`ADMIN_PASSWORD`) | **Super Admin** | Everything below |
| `Admin@123456` (`ADMIN_PANEL_PASSWORD`) | **Admin** | Every shop and its data, plans and status, add shops, broadcast, export. No Billing, Settings, Security, backup, cache, audit log, deleting shops or "Open as shop" (the server returns 403) |

Change both in Super Admin → Security. That shared Admin password signs in as “Admin”; to give each admin their own login and name, add them in Super Admin → Security → **Admin accounts** (they always open the limited Admin panel, sign in at `/admin/login` with their own email, and the Super Admin can reset their password or remove them).

Sections:

- **Overview**: shop, subscription, MRR and revenue cards with change vs the previous 30 days; quick actions (add shop, broadcast, export); live system status (server, database, email, webhook secret); revenue chart; top shops; recent orders, chats and sign-ups
- **Shops**: every account with its real customers, orders and revenue; add a shop, send a message, change plan or status, delete; **Open as shop** (Super Admin): opens that shop's own dashboard with a "Back to Super Admin" banner. The session lasts 1 hour, is logged, and can't change the owner's password or two-factor login, or delete the account
- **Orders / Customers / Products / Messages**: every shop's records with a shop filter; chats open read-only
- **Analytics**: daily revenue, orders, sign-ups and messages (7/30/90 days), monthly growth, subscription distribution, platform usage
- **Billing** (Super Admin): MRR, yearly run rate and revenue by plan; plans ending in the next 7 days and plans that ended, each with +7 / +30 days buttons
- **Settings**: platform name and support contact (shown on the website and billing page), admin email notifications, export all data (CSV), JSON backup without secrets, clear the report cache, system info, message history
- **Security**: change password, two-factor login with an authenticator app, admin accounts, audit log of logins and admin actions

Broadcasts and messages appear as a banner in each shop's dashboard and are also emailed when `EMAIL_USER` / `EMAIL_PASSWORD` work (System status shows whether the mail login is accepted).

Demo product photos: `npm run seed:images` in `backend` (credits in `backend/seed-assets/products/CREDITS.md`).

## 🧾 EMI & Billing

Counter sales for phone shops: GST tax invoices, Shop EMI, collections and double-entry accounts. It lives inside ChatShop (sidebar → **EMI & Billing**, API under `/api/emi`):

- The shop owner is the tenant. Customers and products are ChatShop's own, with KYC (PAN, documents, risk grade) and GST fields (HSN, rate, sold by IMEI) added.
- Every sale is also a ChatShop order (`platform: "store"`), so Orders, Dashboard, Analytics and customer totals include it.
- A walk-in customer's mobile is their WhatsApp contact: when they message the shop it lands on the same customer, and EMI reminders go out from the shop's WhatsApp and show in the inbox.
- Staff (Store Admin, Cashier, Accountant, Collection agent) get their own logins from EMI & Billing → **Staff** and only ever see EMI & billing. Maker-checker approvals cover high EMIs, late fee waivers, foreclosures and invoice cancellations.
- **The Super Admin approves who uses it.** A shop's EMI & billing opens only after the Super Admin approves it (the request is made the first time the owner opens it; until then the owner sees "Waiting for Super Admin approval"). Staff a shop adds can sign in only after the Super Admin approves them; a rejection shows its reason. Staff the Super Admin adds (EMI & Billing → Staff → Add staff to a shop) are approved straight away. Everything waiting is in EMI & Billing → **Requests**.
- Admin panel → **EMI & Billing**, in both the Super Admin and the limited Admin panel: overview, requests, shops, staff of every shop, every shop's invoices (with the GST invoice), EMI contracts (schedule and receipts) and payments with a shop filter, multi-store borrower risk and platform rules. Only the Super Admin can change anything (approve, reject, suspend or reactivate a shop; approve, add or switch off staff; platform rules) and sees the audit log and the overdue/reminder jobs; the limited Admin panel is view only.
- NBFC finance and the Customer KYC page are not in the shop or admin panels (KYC is verified in New sale). The NBFC code is still in the server and its tests, and older NBFC invoices keep showing their NBFC status.

Code: `backend/src/emi/` (`domain/` pure money maths in integer paise, `models/`, `services/`, `routes/`), screens in `frontend/src/pages/billing/`. Rules that keep the money right: amounts are integer paise; every money write runs in one transaction; checkout and EMI payments need an `Idempotency-Key`; journals are insert-only (mistakes are reversed); every query carries `tenantId`; prices come from the catalog, never the client.

**MongoDB must be a replica set for transactions** (Atlas is). On a standalone local MongoDB the module still works, without all-or-nothing rollback, and logs a warning.

Jobs (started by `server.js`, one server only; set `EMI_CRON=off` on the others): overdue job daily at 09:00 IST (days past due, buckets, one late fee per installment, reminders) and WhatsApp reminders every 5 minutes. `EMI_WEBHOOK_SECRET` enables `POST /api/emi/webhooks/gateway` (HMAC-SHA256 of the body in `x-signature`, `{ "event": "payment.settled", "txnRef": "…" }`).

Demo data: `npm run seed:emi` in `backend` (local databases only, never deletes). Every login's password is `Password@123`:

| Login | Opens |
|---|---|
| `super@crm.local` | Super Admin panel (`/admin/login`) |
| `owner@crm.local` | Shop owner: everything, all stores |
| `admin@crm.local` | Store Admin, Bhopal store |
| `cashier@crm.local` | New sale, customers, EMI collection |
| `accounts@crm.local` | Accounts & GST, payments |
| `agent@crm.local` | Only EMI contracts assigned to them |

Tests: `npm test` in `backend` runs the calculation tests (GST, EMI, MDR, NBFC, checks, overdue, allocation, dates, foreclosure), 2,000 random sales that must close the ledger at zero, and the end-to-end API flows. To exercise transactions, point them at a replica set: `TEST_MONGODB_URL="mongodb://127.0.0.1:27018/{db}?replicaSet=rs0" npm test`.

Not built yet (need outside providers): invoice/agreement PDF files (invoices print from the browser), eSign, UPI AutoPay / eNACH, SMS, a payment gateway SDK (cashiers type the reference; the webhook settles it), credit notes for foreclosing UPFRONT-GST contracts, a customer portal.

## 🔐 Authentication Flow

1. User registers → Email sent (optional in dev)
2. User logs in → JWT token stored in localStorage
3. Token attached to all API requests via Axios interceptor
4. Protected routes check authentication via AuthContext
5. A 401 on a normal request ends the session and returns to login; a wrong password on the login form shows inline instead
6. Changing or resetting a password logs out every other session

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

See `backend/.env.example` for the full list. The ones the messaging pipeline needs:

```env
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-secret-key
PORT=5000
FRONTEND_URL=https://yourdomain.com
TRUST_PROXY=1                     # when behind one proxy / load balancer

# Meta (WhatsApp, Instagram, Facebook)
META_APP_SECRET=your-meta-app-secret   # verifies X-Hub-Signature-256; webhooks are rejected without it
META_GRAPH_API_URL=https://graph.facebook.com/v23.0
WHATSAPP_VERIFY_TOKEN=random-string    # typed into the Meta dashboard when subscribing the webhook
INSTAGRAM_VERIFY_TOKEN=random-string
FACEBOOK_VERIFY_TOKEN=random-string
PUBLIC_BASE_URL=https://api.yourdomain.com   # so WhatsApp can download attachments you send

# Email (password reset). Without it, the reset link is printed in the server log in development.
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### Frontend (.env)

```env
VITE_API_URL=https://api.yourdomain.com/api
```

## 📲 Connecting a real WhatsApp number

1. In the Meta App Dashboard, add the WhatsApp product and note the **phone number ID** (not the phone number) and a permanent **System User access token**.
2. Set `META_APP_SECRET` (App settings → Basic) and `WHATSAPP_VERIFY_TOKEN` on the server, and make the server reachable over HTTPS (for local testing, an ngrok URL).
3. In WhatsApp → Configuration, set the callback URL to `https://<server>/api/whatsapp/webhook`, the verify token to `WHATSAPP_VERIFY_TOKEN`, and subscribe to the **messages** field.
4. In ChatShop, open **Settings → Channels → WhatsApp**, paste the phone number ID and token, and connect. The credentials are checked against Meta before they're saved.
5. Send a message from a phone: it appears in the inbox within a second, without refreshing. Replies show sent → delivered → read ticks; failures show Meta's reason with a Retry button.

WhatsApp only accepts free-form replies within 24 hours of the customer's last message; outside that window Meta rejects the send and the inbox shows the error.

## 📈 Future Enhancements

- [ ] AI auto-replies (preferences already saved in Settings → AI replies)
- [ ] Online checkout and payment links (Razorpay)
- [ ] WhatsApp message templates for replies outside the 24-hour window
- [ ] Team members and inbox assignment
- [ ] Mobile app (React Native)

## 🐛 Known Issues

- Email service is optional (for testing without SMTP)
- Razorpay is optional (dummy credentials for testing)
- WhatsApp/Instagram APIs require business verification

## 👨‍💻 Development

### Run Tests

The backend suite (Node's test runner + supertest) needs a local MongoDB; each test file uses its own throwaway database.

```bash
cd backend
npm test
```

It covers the messaging pipeline (inbound save, de-duplication, signature check, send/deliver/read statuses, retry, socket.io push), all three password flows, and the dashboard/analytics report.

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
