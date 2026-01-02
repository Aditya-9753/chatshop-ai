# Facebook Integration - Complete Implementation Guide

## Overview

Complete Facebook Messenger integration has been added to the ChatShop AI platform alongside existing WhatsApp and Instagram functionality.

## Backend Implementation

### 1. Files Created

#### **facebook.controller.js** (`backend/src/controllers/`)

- `connectFacebook()` - Connect Facebook Page account
- `disconnectFacebook()` - Disconnect Facebook account
- `sendFacebookMessage()` - Send messages via Facebook Messenger
- `verifyWebhook()` - Verify webhook for Facebook
- `handleWebhook()` - Process incoming messages from Facebook

#### **facebook.service.js** (`backend/src/services/`)

- `connectAccount()` - Validates and stores Facebook credentials
- `disconnectAccount()` - Removes Facebook connection
- `sendMessage()` - Handles message sending (text, images, videos, audio, documents)
- `handleWebhook()` - Processes webhook events
- `processIncomingMessage()` - Saves incoming messages to database

#### **facebook.api.js** (`backend/src/utils/`)

Facebook Graph API v18.0 integration:

- `verifyAccessToken()` - Validates Facebook credentials
- `sendTextMessage()` - Send text messages
- `sendMediaMessage()` - Send media (images, videos, audio, files)
- `getUserInfo()` - Fetch Facebook user details
- `sendQuickReplies()` - Send quick reply buttons
- `sendButtonTemplate()` - Send interactive button templates

#### **facebook.routes.js** (`backend/src/routes/`)

API endpoints:

- `POST /api/facebook/connect` - Connect Facebook Page
- `POST /api/facebook/disconnect` - Disconnect Facebook
- `POST /api/facebook/send` - Send message
- `GET /api/facebook/webhook` - Webhook verification
- `POST /api/facebook/webhook` - Webhook handler

### 2. Files Updated

#### **Message.model.js** (`backend/src/models/`)

```javascript
// Updated platform enum
platform: {
  type: String,
  enum: ["whatsapp", "instagram", "facebook"], // Added "facebook"
  required: true,
}
```

#### **app.js** (`backend/src/`)

```javascript
// Added Facebook routes
app.use("/api/facebook", require("./routes/facebook.routes"));

// Updated health check message
message: "WhatsApp, Instagram & Facebook Automation API";
```

#### **user.controller.js** (`backend/src/controllers/`)

```javascript
// Added new controller method
exports.updateFacebookConfig = async (req, res) => {
  // Updates user's Facebook configuration
};
```

#### **user.service.js** (`backend/src/services/`)

```javascript
// Added new service method
async updateFacebookConfig(userId, configData) {
  // Updates facebookConfig in user model
}
```

#### **user.routes.js** (`backend/src/routes/`)

```javascript
// Added new route
router.put("/facebook-config", protect, updateFacebookConfig);
```

## Frontend Implementation

### 1. Files Created

#### **facebook.service.js** (`frontend/src/services/`)

```javascript
// Facebook API service layer
-connectFacebook(connectionData) -
  disconnectFacebook() -
  sendFacebookMessage(messageData) -
  updateFacebookConfig(configData) -
  getFacebookStatus();
```

### 2. Files Updated

#### **Settings.jsx** (`frontend/src/pages/`)

- Added Facebook icon import from lucide-react
- Added `facebookForm` state for page connection
- Added `handleFacebookConnect()` handler
- Added Facebook tab to settings sidebar
- Added complete Facebook connection form with:
  - Page Name input
  - Page ID input
  - Page Access Token input (password field)
  - Connection instructions and link to Facebook Developers

#### **Messages.jsx** (`frontend/src/pages/`)

- Added Facebook icon import
- Updated platform filter to include "facebook"
- Added Facebook filter button (blue styling)
- Updated conversation platform badges to show Facebook icon
- Updated broadcast functionality to include Facebook

#### **Dashboard.jsx** (`frontend/src/pages/`)

- Added Facebook integration checkmark to features list
- Added Facebook Status connection card
- Added "Connect Facebook" button
- Updated customer form platform select to include Facebook option

#### **Customers.jsx** (`frontend/src/pages/`)

- Updated platform badge display to include Facebook (blue badge with 📘 icon)
- Added Facebook to platform select dropdown in add/edit customer form

#### **LandingPage.jsx** (Already updated in previous work)

- Facebook messaging demo in hero section
- Facebook feature descriptions
- Facebook platform statistics display

#### **Chatbot.jsx** (Already updated in previous work)

- Facebook-specific responses
- Updated greetings to mention Facebook
- Updated features and pricing to include Facebook

## Environment Configuration

### Backend (.env)

Add the following environment variable:

```env
FACEBOOK_VERIFY_TOKEN=your_webhook_verify_token_here
```

## Facebook Setup Instructions

### 1. Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Click "My Apps" → "Create App"
3. Select "Business" as app type
4. Fill in app details and create

### 2. Add Messenger Product

1. In your app dashboard, click "Add Product"
2. Find "Messenger" and click "Set Up"
3. This enables Messenger Platform for your app

### 3. Generate Page Access Token

1. Go to Messenger Settings
2. Under "Access Tokens", select your Facebook Page
3. Click "Generate Token"
4. Copy and save this token (needed for connection)

### 4. Setup Webhook

1. In Messenger Settings, go to "Webhooks"
2. Click "Add Callback URL"
3. Enter your webhook URL: `https://yourdomain.com/api/facebook/webhook`
4. Enter Verify Token (same as FACEBOOK_VERIFY_TOKEN in .env)
5. Click "Verify and Save"

### 5. Subscribe to Webhook Events

Subscribe to these events:

- `messages` - Receive incoming messages
- `messaging_postbacks` - Receive postback events
- `message_deliveries` - Track message delivery
- `message_reads` - Track message read status

### 6. Submit for Review (Production)

For production use:

1. Complete App Review process
2. Request permissions: `pages_messaging`, `pages_manage_metadata`
3. Add Privacy Policy URL
4. Submit for review

## API Endpoints

### Connect Facebook

```http
POST /api/facebook/connect
Authorization: Bearer {token}
Content-Type: application/json

{
  "pageName": "Your Business Page",
  "pageId": "123456789012345",
  "accessToken": "your_page_access_token"
}
```

### Send Message

```http
POST /api/facebook/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "recipientId": "recipient_psid",
  "text": "Hello from ChatShop AI!",
  "type": "text"
}
```

### Send Media

```http
POST /api/facebook/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "recipientId": "recipient_psid",
  "type": "image",
  "mediaUrl": "https://example.com/image.jpg"
}
```

## Database Schema Updates

### User Model

```javascript
facebookConfig: {
  isConnected: Boolean,
  pageName: String,
  pageId: String,
  accessToken: String
}
```

### Message Model

```javascript
platform: {
  enum: ["whatsapp", "instagram", "facebook"];
}
```

### Customer Model

```javascript
platform: {
  enum: ["whatsapp", "instagram", "facebook"];
}
```

## Features Supported

### ✅ Messaging

- Send text messages
- Send images
- Send videos
- Send audio files
- Send documents
- Quick replies
- Button templates

### ✅ Webhook Handling

- Receive incoming messages
- Process text messages
- Process media attachments
- Auto-create customers
- Save message history
- Update user statistics

### ✅ Integration Management

- Connect Facebook Page
- Disconnect Facebook Page
- Update configuration
- Display connection status
- Error handling

### ✅ UI Components

- Settings page Facebook tab
- Messages page Facebook filter
- Dashboard Facebook status card
- Customer platform badges
- Platform selection dropdowns

## Testing Checklist

### Backend

- [ ] Connect Facebook Page successfully
- [ ] Disconnect Facebook Page
- [ ] Send text message via API
- [ ] Send media message via API
- [ ] Webhook verification works
- [ ] Webhook receives incoming messages
- [ ] Messages saved to database
- [ ] Customer auto-created on first message
- [ ] User stats updated correctly

### Frontend

- [ ] Settings page displays Facebook tab
- [ ] Facebook connection form works
- [ ] Connection status displays correctly
- [ ] Messages page shows Facebook filter
- [ ] Facebook conversations display properly
- [ ] Facebook badge appears on conversations
- [ ] Dashboard shows Facebook status card
- [ ] Customer form includes Facebook option
- [ ] Platform badges show Facebook correctly

## Known Limitations

1. **Page Access Token Expiry**: Long-lived tokens expire after 60 days. Implement token refresh mechanism for production.
2. **Rate Limits**: Facebook API has rate limits. Implement queuing for bulk messages.
3. **Rich Media**: Templates and carousels require additional implementation.
4. **Analytics**: Advanced analytics require Facebook Business Manager integration.

## Security Considerations

1. **Token Storage**: Access tokens are stored encrypted in database
2. **Webhook Verification**: Verify token prevents unauthorized webhook calls
3. **HTTPS Required**: Facebook webhooks require HTTPS endpoints
4. **Input Validation**: All inputs validated before processing
5. **Error Handling**: Sensitive errors not exposed to client

## Support & Documentation

- [Facebook Messenger Platform Docs](https://developers.facebook.com/docs/messenger-platform)
- [Graph API Reference](https://developers.facebook.com/docs/graph-api)
- [Webhook Reference](https://developers.facebook.com/docs/messenger-platform/webhooks)
- [Send API Reference](https://developers.facebook.com/docs/messenger-platform/reference/send-api)

## Troubleshooting

### Connection Issues

- Verify Page Access Token is valid
- Ensure Page ID is correct
- Check token permissions include `pages_messaging`

### Webhook Not Receiving Messages

- Verify webhook URL is accessible
- Check verify token matches environment variable
- Ensure subscribed to correct webhook fields
- Verify app is in production mode or page is in development mode

### Messages Not Sending

- Check access token validity
- Verify recipient PSID is correct
- Ensure message content meets Facebook requirements
- Check for rate limit errors in logs

---

**Status**: ✅ Complete Implementation
**Version**: 1.0.0
**Last Updated**: January 2, 2026
