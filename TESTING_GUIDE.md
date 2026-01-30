# Testing Guide - Feature Message

## Prerequisites
1. Switch to the feature branch:
   ```bash
   git checkout feature_message
   ```

2. Install dependencies (if needed):
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. Start the backend server:
   ```bash
   cd backend
   npm start
   ```

4. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

---

## Test Scenarios

### 1. Conversation List (Inbox)
**Endpoint:** `GET /api/conversations`

**Test Steps:**
1. Navigate to Messages page
2. Verify conversation list loads
3. Check each conversation shows:
   - Customer name
   - Platform badge (WhatsApp/Instagram/Facebook)
   - Last message text
   - Timestamp
   - Unread count badge (if > 0)

**Expected Result:**
- Conversations sorted by newest first
- Unread badge visible in red with count number

---

### 2. Mark Conversation as Read
**Endpoint:** `PUT /api/conversations/:id/read`

**Test Steps:**
1. Find a conversation with unread count > 0
2. Click on the conversation
3. Verify unread badge disappears

**Expected Result:**
- Unread count resets to 0
- Badge disappears from UI

---

### 3. Send Message
**Endpoint:** `POST /api/messages/send`

**Test Steps:**
1. Select a conversation
2. Type a message in the input field
3. Click Send or press Enter
4. Verify message appears in chat

**Expected Result:**
- Message appears in blue bubble on right side
- Conversation list updates with new last message
- Timestamp shows current time

---

### 4. Edit Message
**Endpoint:** `PUT /api/messages/:id/edit`

**Test Steps:**
1. Hover over your own message (outgoing)
2. Click the three-dot menu icon
3. Select "Edit"
4. Modify the text
5. Click "Save" or press Enter

**Expected Result:**
- Message updates with new text
- "(edited)" label appears next to timestamp
- Edit menu closes

**API Test:**
```bash
curl -X PUT http://localhost:5000/api/messages/MESSAGE_ID/edit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Updated message text"}'
```

---

### 5. Delete Message (Soft Delete)
**Endpoint:** `DELETE /api/messages/:id`

**Test Steps:**
1. Hover over your own message
2. Click three-dot menu
3. Select "Delete"
4. Verify message shows deletion notice

**Expected Result:**
- Message text replaced with "This message was deleted"
- Text appears grey and italic
- Message NOT removed from database

**API Test:**
```bash
curl -X DELETE http://localhost:5000/api/messages/MESSAGE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Database Verification:**
```javascript
// Check in MongoDB that message still exists
db.messages.findOne({ _id: ObjectId("MESSAGE_ID") })
// Should show: isDeleted: true, deletedAt: Date, deletedBy: "user"
```

---

### 6. Conversation Filters
**Test Steps:**
1. Click "All" filter - shows all conversations
2. Click "WhatsApp" - shows only WhatsApp conversations
3. Click "Instagram" - shows only Instagram conversations
4. Click "Facebook" - shows only Facebook conversations

**Expected Result:**
- Conversation list filters correctly
- Platform badge matches filter selection

---

### 7. Search Conversations
**Test Steps:**
1. Type customer name in search box
2. Verify matching conversations appear
3. Type phone number
4. Verify matching conversations appear

**Expected Result:**
- Real-time filtering as you type
- Both name and phone number search works

---

### 8. Broadcast Message
**Test Steps:**
1. Click "Broadcast" button
2. Select platform (All/WhatsApp/Instagram/Facebook)
3. Type message
4. Click Send
5. Verify success message

**Expected Result:**
- Message sent to all conversations matching platform filter
- Success toast shows number of recipients

---

### 9. Canned Responses
**Test Steps:**
1. Click lightning icon (Canned Responses)
2. Select category (Greetings, Pricing, etc.)
3. Click a template
4. Verify text populates input field

**Expected Result:**
- Template text inserted into message input
- Ready to send or modify

---

### 10. Message Types Display
**Test Steps:**
1. Send different message types:
   - Text message
   - Reply to message (if replyTo implemented)
2. Verify each displays correctly

**Expected Result:**
- Text messages show normally
- Deleted messages show deletion notice
- Edited messages show "(edited)" label

---

## API Testing with Postman/cURL

### Get Conversations
```bash
GET http://localhost:5000/api/conversations
Headers: Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "conversation_id",
      "userId": "user_id",
      "customerId": {
        "_id": "customer_id",
        "name": "John Doe",
        "phone": "+1234567890"
      },
      "platform": "whatsapp",
      "lastMessage": {
        "content": "Hello!",
        "type": "text",
        "timestamp": "2026-01-30T10:30:00Z"
      },
      "unreadCount": 3,
      "status": "open"
    }
  ]
}
```

### Mark as Read
```bash
PUT http://localhost:5000/api/conversations/CONVERSATION_ID/read
Headers: Authorization: Bearer YOUR_TOKEN
```

### Edit Message
```bash
PUT http://localhost:5000/api/messages/MESSAGE_ID/edit
Headers: 
  Authorization: Bearer YOUR_TOKEN
  Content-Type: application/json
Body:
{
  "text": "Updated message text"
}
```

### Delete Message
```bash
DELETE http://localhost:5000/api/messages/MESSAGE_ID
Headers: Authorization: Bearer YOUR_TOKEN
```

---

## Database Verification Queries

### Check Conversation Creation
```javascript
db.conversations.find({ userId: ObjectId("USER_ID") }).pretty()
```

### Verify Soft Delete
```javascript
// Find deleted messages
db.messages.find({ isDeleted: true }).pretty()
```

### Check Edit History
```javascript
db.messages.find({ isEdited: true }).pretty()
// Look at editHistory array
```

### Verify Conversation Linking
```javascript
// Check if messages have conversationId
db.messages.find({ conversationId: { $exists: true } }).count()
```

---

## Edge Cases to Test

### 1. Edit Empty Message
- Try to edit message with empty text
- Should show error: "Message text is required"

### 2. Delete Already Deleted Message
- Try to delete a message twice
- Should show error: "Message not found or already deleted"

### 3. Edit Incoming Message
- Try to edit a customer's message
- Should show error: "Message not found or cannot be edited"

### 4. Conversation with No Messages
- Select conversation
- Should show "No messages yet"

### 5. Send Empty Message
- Try to send blank message
- Send button should be disabled or show error

---

## Performance Testing

### Load Test
1. Create 100+ conversations
2. Verify list loads quickly (< 2 seconds)
3. Search should be instant

### Message History
1. Load conversation with 1000+ messages
2. Verify pagination works (if implemented)
3. Scroll performance should be smooth

---

## Browser Compatibility

Test on:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers

---

## Checklist

- [ ] Conversation list displays correctly
- [ ] Unread count shows and resets
- [ ] Mark as read works
- [ ] Send message updates conversation
- [ ] Edit message works with history
- [ ] Delete message soft deletes
- [ ] "(edited)" label shows
- [ ] Deleted messages show grey text
- [ ] Only own messages show edit/delete
- [ ] Search filters conversations
- [ ] Platform filter works
- [ ] Broadcast sends to multiple users
- [ ] Canned responses insert text
- [ ] Mobile responsive
- [ ] No console errors

---

## Known Issues / Limitations

1. **Real-time updates**: Messages don't auto-refresh (need WebSocket)
2. **Pagination**: Large message lists not paginated yet
3. **File uploads**: Only text messages supported
4. **Typing indicators**: Not implemented
5. **Read receipts**: Only local read status

---

## Troubleshooting

### Conversation list not loading
- Check backend is running
- Verify `/api/conversations` endpoint responds
- Check authentication token is valid

### Edit/Delete buttons not appearing
- Ensure message direction is "outgoing"
- Hover over message to reveal menu
- Check message is not already deleted

### Unread count not resetting
- Verify `/api/conversations/:id/read` endpoint is called
- Check browser console for errors
- Ensure conversation ID is correct

---

## Next Steps After Testing

1. Fix any bugs found during testing
2. Add unit tests for new endpoints
3. Implement real-time updates with WebSocket
4. Add message pagination
5. Implement file upload support
6. Add typing indicators
7. Create admin dashboard for conversation management

---

**Happy Testing!** 🧪✨
