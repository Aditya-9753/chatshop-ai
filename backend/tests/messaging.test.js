const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startApp, stopApp, registerUser, postWebhook, stub } = require("./helpers");

let app, User, Message, Conversation, Customer, whatsappApi, realtime;
let owner, events, restoreEmit;

const PHONE_NUMBER_ID = "100200300";
const CUSTOMER_WA_ID = "919876500001";

const inboundText = (id, text, from = CUSTOMER_WA_ID) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA_ID",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "15550001111", phone_number_id: PHONE_NUMBER_ID },
            contacts: [{ profile: { name: "Priya Sharma" }, wa_id: from }],
            messages: [
              {
                from,
                id,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: text },
              },
            ],
          },
        },
      ],
    },
  ],
});

const statusUpdate = (id, status, errors) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA_ID",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: PHONE_NUMBER_ID },
            statuses: [
              {
                id,
                status,
                timestamp: String(Math.floor(Date.now() / 1000)),
                recipient_id: CUSTOMER_WA_ID,
                ...(errors && { errors }),
              },
            ],
          },
        },
      ],
    },
  ],
});

before(async () => {
  app = await startApp("chatshop-test-messaging");
  User = require("../src/models/User.model");
  Message = require("../src/models/Message.model");
  Conversation = require("../src/models/Conversation.model");
  Customer = require("../src/models/Customer.model");
  whatsappApi = require("../src/utils/whatsapp.api");
  realtime = require("../src/realtime/socket");

  owner = await registerUser(app);
  await User.updateOne(
    { _id: owner.user.id },
    {
      whatsappConfig: {
        isConnected: true,
        phoneNumberId: PHONE_NUMBER_ID,
        phoneNumber: "+1 555 000 1111",
        accessToken: "test-access-token",
      },
    }
  );
});

after(stopApp);

beforeEach(async () => {
  await Promise.all([Message.deleteMany({}), Conversation.deleteMany({}), Customer.deleteMany({})]);
  events = [];
  restoreEmit?.();
  restoreEmit = stub(realtime, "emitToUser", (userId, event, payload) =>
    events.push({ userId: String(userId), event, payload })
  );
});

test("inbound WhatsApp text is saved, threaded and pushed to the inbox", async () => {
  const res = await postWebhook(app, "/api/whatsapp/webhook", inboundText("wamid.IN1", "Hi, is this in stock?"));
  assert.equal(res.status, 200);

  const message = await Message.findOne({ "metadata.platformMessageId": "wamid.IN1" });
  assert.ok(message, "message saved");
  assert.equal(message.status, "received");
  assert.equal(message.direction, "incoming");
  assert.equal(message.content.text, "Hi, is this in stock?");

  const customer = await Customer.findById(message.customerId);
  assert.equal(customer.name, "Priya Sharma");
  assert.equal(customer.platformId, CUSTOMER_WA_ID);

  const conversation = await Conversation.findById(message.conversationId);
  assert.equal(conversation.unreadCount, 1);
  assert.equal(conversation.lastMessage.content, "Hi, is this in stock?");

  const pushed = events.find((e) => e.event === "message:new");
  assert.ok(pushed, "message:new emitted");
  assert.equal(pushed.userId, String(owner.user.id));
  assert.equal(pushed.payload.conversation.customerId.name, "Priya Sharma");
});

test("re-delivering the same webhook does not create a duplicate", async () => {
  const body = inboundText("wamid.DUP", "Hello");
  await postWebhook(app, "/api/whatsapp/webhook", body);
  const again = await postWebhook(app, "/api/whatsapp/webhook", body);

  assert.equal(again.status, 200);
  assert.equal(await Message.countDocuments({ "metadata.platformMessageId": "wamid.DUP" }), 1);
  const conversation = await Conversation.findOne({});
  assert.equal(conversation.unreadCount, 1);
});

test("an inbound message matches a customer added by hand with a formatted number", async () => {
  const manual = await Customer.create({
    userId: owner.user.id,
    name: "Rahul (added by hand)",
    phone: "+91 98765 00001",
    platform: "whatsapp",
  });

  await postWebhook(app, "/api/whatsapp/webhook", inboundText("wamid.MATCH", "It's Rahul"));

  const message = await Message.findOne({ "metadata.platformMessageId": "wamid.MATCH" });
  assert.equal(String(message.customerId), String(manual._id));
  assert.equal(await Customer.countDocuments({}), 1);
});

test("a webhook with a wrong or missing signature returns 401", async () => {
  const body = inboundText("wamid.FAKE", "fake");
  const wrong = await postWebhook(app, "/api/whatsapp/webhook", body, "sha256=" + "0".repeat(64));
  const missing = await postWebhook(app, "/api/whatsapp/webhook", body, "");
  const facebook = await postWebhook(app, "/api/facebook/webhook", { object: "page", entry: [] }, "sha256=abcd");

  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.equal(facebook.status, 401);
  assert.equal(await Message.countDocuments({}), 0);
});

test("a dashboard reply is sent through WhatsApp and moves sent → delivered → read", async () => {
  let sentPayload;
  const restore = stub(whatsappApi, "sendMessage", async (payload) => {
    sentPayload = payload;
    return { messages: [{ id: "wamid.OUT1" }] };
  });

  try {
    await postWebhook(app, "/api/whatsapp/webhook", inboundText("wamid.IN2", "Price?"));
    const customer = await Customer.findOne({});

    const res = await request(app)
      .post("/api/messages/send")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ customerId: customer._id, type: "text", content: { text: "₹499, in stock" } });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, "sent");
    assert.equal(sentPayload.phoneNumberId, PHONE_NUMBER_ID);
    assert.equal(sentPayload.to, CUSTOMER_WA_ID);
    assert.equal(sentPayload.message, "₹499, in stock");

    await postWebhook(app, "/api/whatsapp/webhook", statusUpdate("wamid.OUT1", "delivered"));
    assert.equal((await Message.findById(res.body.data._id)).status, "delivered");

    await postWebhook(app, "/api/whatsapp/webhook", statusUpdate("wamid.OUT1", "read"));
    assert.equal((await Message.findById(res.body.data._id)).status, "read");

    // A late "delivered" must not move the message back
    await postWebhook(app, "/api/whatsapp/webhook", statusUpdate("wamid.OUT1", "delivered"));
    assert.equal((await Message.findById(res.body.data._id)).status, "read");

    const statuses = events.filter((e) => e.event === "message:status").map((e) => e.payload.status);
    assert.deepEqual(statuses, ["sent", "delivered", "read"]);
  } finally {
    restore();
  }
});

test("a failed send is saved as failed with Meta's error, and can be retried", async () => {
  const { ChannelError } = require("../src/utils/meta");
  let attempts = 0;
  const restore = stub(whatsappApi, "sendMessage", async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new ChannelError("131047", "Re-engagement message: more than 24 hours have passed");
    }
    return { messages: [{ id: "wamid.RETRY" }] };
  });

  try {
    const customer = await Customer.create({
      userId: owner.user.id,
      name: "Old customer",
      phone: "+91 90000 00000",
      platform: "whatsapp",
    });

    const res = await request(app)
      .post("/api/messages/send")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ customerId: customer._id, content: { text: "Are you still interested?" } });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, "Message not delivered");
    assert.equal(res.body.data.status, "failed");
    assert.equal(res.body.data.errorDetails.code, "131047");
    assert.match(res.body.data.errorDetails.message, /24 hours/);

    const retry = await request(app)
      .post(`/api/messages/${res.body.data._id}/retry`)
      .set("Authorization", `Bearer ${owner.token}`);

    assert.equal(retry.status, 200);
    assert.equal(retry.body.data.status, "sent");
    assert.equal(retry.body.data.metadata.platformMessageId, "wamid.RETRY");
  } finally {
    restore();
  }
});

test("a failed delivery status from Meta marks a sent message failed", async () => {
  const restore = stub(whatsappApi, "sendMessage", async () => ({ messages: [{ id: "wamid.LATEFAIL" }] }));
  try {
    const customer = await Customer.create({
      userId: owner.user.id,
      name: "Someone",
      phone: "+91 90000 00001",
      platform: "whatsapp",
    });
    const res = await request(app)
      .post("/api/messages/send")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ customerId: customer._id, content: { text: "Hello" } });

    await postWebhook(
      app,
      "/api/whatsapp/webhook",
      statusUpdate("wamid.LATEFAIL", "failed", [
        { code: 131026, title: "Message undeliverable", error_data: { details: "Receiver is not on WhatsApp" } },
      ])
    );

    const message = await Message.findById(res.body.data._id);
    assert.equal(message.status, "failed");
    assert.equal(message.errorDetails.code, "131026");
    assert.equal(message.errorDetails.message, "Receiver is not on WhatsApp");
  } finally {
    restore();
  }
});

test("sending on a channel that is not connected fails with a clear reason", async () => {
  const customer = await Customer.create({
    userId: owner.user.id,
    name: "IG customer",
    platform: "instagram",
    platformId: "17841400000000000",
  });

  const res = await request(app)
    .post("/api/messages/send")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ customerId: customer._id, content: { text: "Hi" } });

  assert.equal(res.body.data.status, "failed");
  assert.equal(res.body.data.errorDetails.code, "NOT_CONNECTED");
  assert.match(res.body.data.errorDetails.message, /Instagram is not connected/);
});

test("a user cannot send to another user's customer", async () => {
  const other = await registerUser(app);
  const customer = await Customer.create({
    userId: owner.user.id,
    name: "Private",
    phone: "+91 90000 00002",
    platform: "whatsapp",
  });

  const res = await request(app)
    .post("/api/messages/send")
    .set("Authorization", `Bearer ${other.token}`)
    .send({ customerId: customer._id, content: { text: "Hi" } });

  assert.equal(res.status, 400);
  assert.equal(await Message.countDocuments({}), 0);
});

test("opening a chat resets the unread count and sends a read receipt", async () => {
  const receipts = [];
  const restore = stub(whatsappApi, "markAsRead", async (...args) => receipts.push(args));

  try {
    await postWebhook(app, "/api/whatsapp/webhook", inboundText("wamid.UNREAD", "Hello?"));
    const customer = await Customer.findOne({});

    const res = await request(app)
      .get(`/api/messages/${customer._id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal((await Conversation.findOne({})).unreadCount, 0);
    assert.equal((await Message.findOne({})).isRead, true);

    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(receipts, [[PHONE_NUMBER_ID, "test-access-token", "wamid.UNREAD"]]);
  } finally {
    restore();
  }
});

test("the profile API never returns platform access tokens", async () => {
  const res = await request(app)
    .get("/api/users/profile")
    .set("Authorization", `Bearer ${owner.token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.whatsappConfig.accessToken, undefined);
  assert.equal(res.body.data.whatsappConfig.hasAccessToken, true);
  assert.equal(res.body.data.whatsappConfig.phoneNumberId, PHONE_NUMBER_ID);
});
