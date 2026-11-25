# 🚀 Complete API Documentation

> **Total Endpoints Found**: 262
> **Base URL**: `http://localhost:5000`

## 📋 Index / Modules Overview

1. [Authentication & Verification (`/api/auth`)](#authentication-verification-api-auth-) (8 APIs)
2. [User Profile & Security (`/api/users`)](#user-profile-security-api-users-) (16 APIs)
3. [WhatsApp Integration & Webhooks (`/api/whatsapp`)](#whatsapp-integration-webhooks-api-whatsapp-) (8 APIs)
4. [Instagram Automation (`/api/instagram`)](#instagram-automation-api-instagram-) (5 APIs)
5. [Facebook Automation (`/api/facebook`)](#facebook-automation-api-facebook-) (5 APIs)
6. [CRM - Customers (`/api/customers`)](#crm-customers-api-customers-) (11 APIs)
7. [CRM - Conversations (`/api/conversations`)](#crm-conversations-api-conversations-) (6 APIs)
8. [CRM - Messages (`/api/messages`)](#crm-messages-api-messages-) (10 APIs)
9. [E-Commerce - Products (`/api/products`)](#e-commerce-products-api-products-) (5 APIs)
10. [E-Commerce - Orders (`/api/orders`)](#e-commerce-orders-api-orders-) (6 APIs)
11. [Analytics & Dashboard (`/api/analytics`)](#analytics-dashboard-api-analytics-) (6 APIs)
12. [Subscriptions & Merchant Billing (`/api/subscriptions`)](#subscriptions-merchant-billing-api-subscriptions-) (14 APIs)
13. [Webhooks (`/api/webhooks`)](#webhooks-api-webhooks-) (1 APIs)
14. [Admin - Platform & Super Admin (`/api/admin`)](#admin-platform-super-admin-api-admin-) (52 APIs)
15. [EMI, Billing & Invoicing System (`/api/emi`)](#emi-billing-invoicing-system-api-emi-) (87 APIs)
16. [AI Website Assistant (`/api/assistant`, `/api/admin/assistant`)](#ai-website-assistant-api-assistant-api-admin-assistant-) (6 APIs)
17. [System Guardian - Incident & Health (`/api/admin/guardian`)](#system-guardian-incident-health-api-admin-guardian-) (14 APIs)
18. [Public & Health Check Endpoints](#public-health-check-endpoints) (2 APIs)

---

## Authentication & Verification (`/api/auth`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **POST** | `/api/auth/register` | |
| **POST** | `/api/auth/login` | |
| **POST** | `/api/auth/login/2fa` | |
| **POST** | `/api/auth/forgot-password` | |
| **POST** | `/api/auth/reset-password` | |
| **GET** | `/api/auth/reset-password/:token` | |
| **POST** | `/api/auth/verify-email` | |
| **POST** | `/api/auth/verify-email/code` | |

---

## User Profile & Security (`/api/users`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/users/profile` | |
| **POST** | `/api/users/email-verification/resend` | |
| **POST** | `/api/users/phone-verification/send` | |
| **POST** | `/api/users/phone-verification/verify` | |
| **PUT** | `/api/users/profile` | |
| **PUT** | `/api/users/password` | |
| **DELETE** | `/api/users/account` | |
| **PUT** | `/api/users/whatsapp-config` | |
| **PUT** | `/api/users/instagram-config` | |
| **PUT** | `/api/users/facebook-config` | |
| **PUT** | `/api/users/ai-config` | |
| **PUT** | `/api/users/business-info` | |
| **GET** | `/api/users/announcements` | |
| **POST** | `/api/users/2fa/setup` | |
| **POST** | `/api/users/2fa/enable` | |
| **POST** | `/api/users/2fa/disable` | |

---

## WhatsApp Integration & Webhooks (`/api/whatsapp`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **POST** | `/api/whatsapp/connect` | |
| **POST** | `/api/whatsapp/disconnect` | |
| **POST** | `/api/whatsapp/send` | |
| **GET** | `/api/whatsapp/embedded-signup/config` | |
| **POST** | `/api/whatsapp/embedded-signup/exchange` | |
| **POST** | `/api/whatsapp/embedded-signup/complete` | |
| **GET** | `/api/whatsapp/webhook` | |
| **POST** | `/api/whatsapp/webhook` | |

---

## Instagram Automation (`/api/instagram`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **POST** | `/api/instagram/connect` | |
| **POST** | `/api/instagram/disconnect` | |
| **POST** | `/api/instagram/send` | |
| **GET** | `/api/instagram/webhook` | |
| **POST** | `/api/instagram/webhook` | |

---

## Facebook Automation (`/api/facebook`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **POST** | `/api/facebook/connect` | |
| **POST** | `/api/facebook/disconnect` | |
| **POST** | `/api/facebook/send` | |
| **GET** | `/api/facebook/webhook` | |
| **POST** | `/api/facebook/webhook` | |

---

## CRM - Customers (`/api/customers`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/customers` | |
| **GET** | `/api/customers/:id` | |
| **POST** | `/api/customers` | |
| **PUT** | `/api/customers/:id` | |
| **DELETE** | `/api/customers/:id` | |
| **PUT** | `/api/customers/:id/block` | |
| **POST** | `/api/customers/:id/tags` | |
| **DELETE** | `/api/customers/:id/tags` | |
| **POST** | `/api/customers/:id/notes` | |
| **GET** | `/api/customers/:id/notes` | |
| **DELETE** | `/api/customers/notes/:noteId` | |

---

## CRM - Conversations (`/api/conversations`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/conversations` | |
| **PUT** | `/api/conversations/:id/read` | |
| **PUT** | `/api/conversations/:id/status` | |
| **PUT** | `/api/conversations/:id/assign` | |
| **PUT** | `/api/conversations/:id/tags` | |
| **DELETE** | `/api/conversations/:id/tags` | |

---

## CRM - Messages (`/api/messages`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/messages/conversations` | |
| **GET** | `/api/messages/stats` | |
| **GET** | `/api/messages/:customerId` | |
| **GET** | `/api/messages` | |
| **POST** | `/api/messages/send` | |
| **POST** | `/api/messages/upload` | |
| **POST** | `/api/messages/:id/retry` | |
| **PUT** | `/api/messages/:id/read` | |
| **PUT** | `/api/messages/:id/edit` | |
| **DELETE** | `/api/messages/:id` | |

---

## E-Commerce - Products (`/api/products`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/products` | |
| **GET** | `/api/products/:id` | |
| **POST** | `/api/products` | |
| **PUT** | `/api/products/:id` | |
| **DELETE** | `/api/products/:id` | |

---

## E-Commerce - Orders (`/api/orders`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/orders` | |
| **GET** | `/api/orders/stats` | |
| **GET** | `/api/orders/:id` | |
| **POST** | `/api/orders` | |
| **PUT** | `/api/orders/:id/status` | |
| **DELETE** | `/api/orders/:id` | |

---

## Analytics & Dashboard (`/api/analytics`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/analytics/overview` | |
| **GET** | `/api/analytics/report` | |
| **GET** | `/api/analytics/dashboard` | |
| **GET** | `/api/analytics/revenue` | |
| **GET** | `/api/analytics/customers` | |
| **GET** | `/api/analytics/messages` | |

---

## Subscriptions & Merchant Billing (`/api/subscriptions`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/subscriptions/plans` | |
| **GET** | `/api/subscriptions/current` | |
| **GET** | `/api/subscriptions/details` | |
| **POST** | `/api/subscriptions/checkout` | |
| **POST** | `/api/subscriptions/create` | |
| **POST** | `/api/subscriptions/verify` | |
| **GET** | `/api/subscriptions/payments/:ref` | |
| **POST** | `/api/subscriptions/payments/:ref/test-result` | |
| **POST** | `/api/subscriptions/cancel` | |
| **POST** | `/api/subscriptions/resume` | |
| **GET** | `/api/subscriptions/invoices` | |
| **GET** | `/api/subscriptions/invoices/:id` | |
| **POST** | `/api/subscriptions/invoices/:id/pay` | |
| **GET** | `/api/subscriptions/payments` | |

---

## Webhooks (`/api/webhooks`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **POST** | `/api/webhooks/razorpay` | |

---

## Admin - Platform & Super Admin (`/api/admin`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/admin/revenue/overview` | |
| **GET** | `/api/admin/revenue/transactions` | |
| **GET** | `/api/admin/revenue/reconciliation` | |
| **GET** | `/api/admin/revenue/export/:kind` | |
| **POST** | `/api/admin/revenue/expiry/run` | |
| **GET** | `/api/admin/plans` | |
| **GET** | `/api/admin/plans/:code/history` | |
| **POST** | `/api/admin/plans` | |
| **PATCH** | `/api/admin/plans/:code` | |
| **GET** | `/api/admin/platform-invoices` | |
| **GET** | `/api/admin/platform-invoices/:id` | |
| **POST** | `/api/admin/platform-invoices/preview` | |
| **POST** | `/api/admin/platform-invoices` | |
| **POST** | `/api/admin/platform-invoices/:id/void` | |
| **POST** | `/api/admin/platform-invoices/:id/payments` | |
| **POST** | `/api/admin/platform-payments/:id/refunds` | |
| **POST** | `/api/admin/platform-payments/:id/sync` | |
| **GET** | `/api/admin/billing-settings` | |
| **PUT** | `/api/admin/billing-settings` | |
| **GET** | `/api/admin/merchants/:id/billing` | |
| **GET** | `/api/admin/orders` | |
| **GET** | `/api/admin/customers` | |
| **GET** | `/api/admin/products` | |
| **GET** | `/api/admin/conversations` | |
| **GET** | `/api/admin/conversations/:id/messages` | |
| **GET** | `/api/admin/activity` | |
| **GET** | `/api/admin/dashboard` | |
| **GET** | `/api/admin/users` | |
| **GET** | `/api/admin/users/:id` | |
| **PUT** | `/api/admin/users/:id` | |
| **DELETE** | `/api/admin/users/:id` | |
| **GET** | `/api/admin/stats` | |
| **GET** | `/api/admin/system` | |
| **GET** | `/api/admin/trends` | |
| **GET** | `/api/admin/settings` | |
| **PUT** | `/api/admin/settings` | |
| **POST** | `/api/admin/users` | |
| **POST** | `/api/admin/broadcast` | |
| **GET** | `/api/admin/announcements` | |
| **GET** | `/api/admin/export/:kind` | |
| **GET** | `/api/admin/backup` | |
| **POST** | `/api/admin/cache/clear` | |
| **GET** | `/api/admin/audit` | |
| **GET** | `/api/admin/admin-panel` | |
| **PUT** | `/api/admin/admin-panel` | |
| **GET** | `/api/admin/admins` | |
| **POST** | `/api/admin/admins` | |
| **PUT** | `/api/admin/admins/:id` | |
| **DELETE** | `/api/admin/admins/:id` | |
| **GET** | `/api/admin/billing` | |
| **POST** | `/api/admin/users/:id/extend` | |
| **POST** | `/api/admin/users/:id/impersonate` | |

---

## EMI, Billing & Invoicing System (`/api/emi`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/emi/public/whatsapp-bills/:jobId/pdf` | |
| **GET** | `/api/emi/public/invoices/:id/pdf` | |
| **POST** | `/api/emi/webhooks/gateway` | |
| **GET** | `/api/emi/super/dashboard` | |
| **GET** | `/api/emi/super/tenants` | |
| **PATCH** | `/api/emi/super/tenants/:id` | |
| **GET** | `/api/emi/super/requests` | |
| **GET** | `/api/emi/super/staff` | |
| **GET** | `/api/emi/super/shop-roles` | |
| **POST** | `/api/emi/super/staff` | |
| **PATCH** | `/api/emi/super/staff/:id` | |
| **GET** | `/api/emi/super/invoices` | |
| **GET** | `/api/emi/super/invoices/:id` | |
| **GET** | `/api/emi/super/emi` | |
| **GET** | `/api/emi/super/emi/:id` | |
| **GET** | `/api/emi/super/nbfc` | |
| **GET** | `/api/emi/super/payments` | |
| **GET** | `/api/emi/super/settings` | |
| **PUT** | `/api/emi/super/settings` | |
| **GET** | `/api/emi/super/nbfc-partners` | |
| **POST** | `/api/emi/super/nbfc-partners` | |
| **PUT** | `/api/emi/super/nbfc-partners/:id` | |
| **GET** | `/api/emi/super/risk/multi-store-customers` | |
| **GET** | `/api/emi/super/audit` | |
| **POST** | `/api/emi/super/jobs/overdue/run` | |
| **POST** | `/api/emi/super/jobs/notifications/run` | |
| **GET** | `/api/emi/me` | |
| **GET** | `/api/emi/customers` | |
| **POST** | `/api/emi/customers` | |
| **GET** | `/api/emi/customers/:id` | |
| **PATCH** | `/api/emi/customers/:id` | |
| **PATCH** | `/api/emi/customers/:id/kyc` | |
| **PATCH** | `/api/emi/products/:id/gst` | |
| **GET** | `/api/emi/stores/:storeId/stock` | |
| **GET** | `/api/emi/stores/:storeId/inventory` | |
| **POST** | `/api/emi/stores/:storeId/inventory` | |
| **GET** | `/api/emi/stores/:storeId/sale-rules` | |
| **POST** | `/api/emi/emi/preview` | |
| **POST** | `/api/emi/stores/:storeId/checkout/preview` | |
| **POST** | `/api/emi/stores/:storeId/checkout` | |
| **GET** | `/api/emi/invoices` | |
| **GET** | `/api/emi/invoices/:id/pdf` | |
| **POST** | `/api/emi/invoices/:id/send-whatsapp` | |
| **GET** | `/api/emi/invoices/:id` | |
| **POST** | `/api/emi/invoices/:id/cancel-request` | |
| **GET** | `/api/emi/dues` | |
| **POST** | `/api/emi/invoices/:id/payments` | |
| **POST** | `/api/emi/invoices/:id/remind` | |
| **GET** | `/api/emi/emi` | |
| **GET** | `/api/emi/agents` | |
| **GET** | `/api/emi/emi/:id` | |
| **POST** | `/api/emi/emi/:id/payments` | |
| **GET** | `/api/emi/emi/:id/foreclosure-quote` | |
| **POST** | `/api/emi/emi/:id/foreclose` | |
| **POST** | `/api/emi/emi/installments/:id/waiver-request` | |
| **POST** | `/api/emi/emi/:id/followups` | |
| **POST** | `/api/emi/emi/:id/assign` | |
| **GET** | `/api/emi/nbfc-partners` | |
| **GET** | `/api/emi/nbfc` | |
| **POST** | `/api/emi/nbfc/:id/status` | |
| **GET** | `/api/emi/approvals` | |
| **POST** | `/api/emi/approvals/:id/decide` | |
| **GET** | `/api/emi/payments` | |
| **POST** | `/api/emi/payments/:id/settle` | |
| **GET** | `/api/emi/reports/dashboard` | |
| **GET** | `/api/emi/reports/my` | |
| **GET** | `/api/emi/reports/emi-aging` | |
| **GET** | `/api/emi/reports/gst` | |
| **GET** | `/api/emi/reports/trial-balance` | |
| **GET** | `/api/emi/ledger` | |
| **GET** | `/api/emi/notifications` | |
| **GET** | `/api/emi/settings/effective` | |
| **PUT** | `/api/emi/settings/tenant` | |
| **PUT** | `/api/emi/settings/store/:storeId` | |
| **DELETE** | `/api/emi/settings/store/:storeId` | |
| **PUT** | `/api/emi/tenant` | |
| **GET** | `/api/emi/stores` | |
| **POST** | `/api/emi/stores` | |
| **PATCH** | `/api/emi/stores/:storeId` | |
| **GET** | `/api/emi/users` | |
| **POST** | `/api/emi/users` | |
| **PATCH** | `/api/emi/users/:id` | |
| **POST** | `/api/emi/users/:id/decide` | |
| **GET** | `/api/emi/roles` | |
| **POST** | `/api/emi/roles` | |
| **PUT** | `/api/emi/roles/:id` | |
| **DELETE** | `/api/emi/roles/:id` | |

---

## AI Website Assistant (`/api/assistant`, `/api/admin/assistant`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **POST** | `/api/assistant/chat` | |
| **POST** | `/api/assistant/chat/stream` | |
| **GET** | `/api/assistant/requests/:requestId` | |
| **DELETE** | `/api/assistant/requests/:requestId` | |
| **GET** | `/api/admin/assistant/status` | |
| **POST** | `/api/admin/assistant/test` | |

---

## System Guardian - Incident & Health (`/api/admin/guardian`)

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/admin/guardian/incidents/overview` | |
| **GET** | `/api/admin/guardian/incidents` | |
| **GET** | `/api/admin/guardian/incidents/notifications` | |
| **PATCH** | `/api/admin/guardian/incidents/notifications/:id/read` | |
| **GET** | `/api/admin/guardian/incidents/:id/events` | |
| **GET** | `/api/admin/guardian/incidents/:id` | |
| **PATCH** | `/api/admin/guardian/incidents/:id/status` | |
| **GET** | `/api/admin/guardian/health` | |
| **POST** | `/api/admin/guardian/health/run` | |
| **POST** | `/api/admin/guardian/incidents/:id/recover` | |
| **POST** | `/api/admin/guardian/incidents/:id/actions/:action` | |
| **GET** | `/api/admin/guardian/notifications` | |
| **PATCH** | `/api/admin/guardian/notifications/:id/read` | |
| **GET** | `/api/admin/guardian/audit-logs` | |

---

## Public & Health Check Endpoints

| Method | Endpoint | Description / Notes |
| :--- | :--- | :--- |
| **GET** | `/api/settings/public` | |
| **GET** | `/` | |

---

