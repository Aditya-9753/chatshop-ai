const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startApp, stopApp, registerUser, postWebhook, sign, stub } = require("./helpers");

let app, User, Message, Conversation, Customer, Product, WhatsAppAIUsage, WhatsAppWebhookJob, WhatsAppBillJob, WhatsAppBillDraft, whatsappApi, realtime;
let owner, events, restoreEmit;

const PHONE_NUMBER_ID = "100200300";
const CUSTOMER_WA_ID = "919876500001";

const explainUsesIndex = (explain, name) =>
  `${JSON.stringify(explain.queryPlanner.winningPlan)}${JSON.stringify(explain.executionStats.executionStages)}`.includes(name);

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
  Product = require("../src/models/Product.model");
  WhatsAppAIUsage = require("../src/models/WhatsAppAIUsage.model");
  WhatsAppWebhookJob = require("../src/models/WhatsAppWebhookJob.model");
  WhatsAppBillJob = require("../src/models/WhatsAppBillJob.model");
  WhatsAppBillDraft = require("../src/models/WhatsAppBillDraft.model");
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
  await Promise.all([
    Message.deleteMany({}),
    Conversation.deleteMany({}),
    Customer.deleteMany({}),
    WhatsAppWebhookJob.deleteMany({}),
    WhatsAppBillJob.deleteMany({}),
    WhatsAppBillDraft.deleteMany({}),
    require("../src/emi/models/sales").Invoice.deleteMany({ tenantId: owner.user.id }),
    require("../src/emi/models/platform").Store.deleteMany({ tenantId: owner.user.id }),
    require("../src/emi/models/platform").Tenant.deleteMany({ _id: owner.user.id }),
    require("../src/models/WhatsAppWebhookLock.model").deleteMany({}),
    User.updateOne(
      { _id: owner.user.id },
      {
        $set: {
          "aiConfig.isEnabled": true,
          "aiConfig.whatsappAutoReplyEnabled": false,
          "aiConfig.whatsappBillCreationEnabled": false,
        },
      },
    ),
  ]);
  events = [];
  restoreEmit?.();
  restoreEmit = stub(realtime, "emitToUser", (userId, event, payload) =>
    events.push({ userId: String(userId), event, payload })
  );
});

test("webhook is acknowledged after durable enqueue and processed by the worker later", async () => {
  const body = inboundText("wamid.QUEUED", "Does the shop have this in stock?");
  const raw = JSON.stringify(body);
  const response = await request(app)
    .post("/api/whatsapp/webhook")
    .set("Content-Type", "application/json")
    .set("X-Hub-Signature-256", sign(raw))
    .send(raw);

  assert.equal(response.status, 200);
  assert.equal(await WhatsAppWebhookJob.countDocuments({ status: "queued" }), 1);
  assert.equal(await Message.countDocuments({}), 0);

  await require("../src/services/whatsappWebhookQueue.service").drain();
  assert.equal(await Message.countDocuments({ "metadata.platformMessageId": "wamid.QUEUED" }), 1);
});

test("the worker retains a transient failure for retry", async () => {
  const queue = require("../src/services/whatsappWebhookQueue.service");
  const service = require("../src/services/whatsapp.service");
  const restore = stub(service, "handleWebhook", async () => {
    throw new Error("temporary database failure");
  });

  try {
    await queue.enqueueWebhook(inboundText("wamid.RETRY_JOB", "Hello"));
    await queue.drain();

    const job = await WhatsAppWebhookJob.findOne({
      idempotencyKey: "message:wamid.RETRY_JOB",
    });
    assert.equal(job.status, "queued");
    assert.equal(job.attempts, 1);
    assert.match(job.lastError, /temporary database failure/);
  } finally {
    restore();
  }
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

test("shop opt-in sends one deterministic WhatsApp catalog reply per new message", async () => {
  await User.updateOne(
    { _id: owner.user.id },
    { $set: { "aiConfig.isEnabled": true, "aiConfig.whatsappAutoReplyEnabled": true } },
  );
  await Product.create({
    userId: owner.user.id,
    name: "Redmi Note 13",
    price: 14999,
    stock: 4,
  });
  const productPlan = await Product.find({
    userId: owner.user.id,
    isActive: true,
    $text: { $search: "Redmi Note 13" },
  })
    .explain("executionStats");
  assert.equal(explainUsesIndex(productPlan, "shop_active_product_text"), true);
  let sendCount = 0;
  const restore = stub(whatsappApi, "sendMessage", async () => {
    sendCount += 1;
    return { messages: [{ id: `wamid.AI${sendCount}` }] };
  });

  try {
    await postWebhook(
      app,
      "/api/whatsapp/webhook",
      inboundText("wamid.AI_IN", "What is the price of Redmi Note 13?"),
    );

    const reply = await Message.findOne({ direction: "outgoing", isAIGenerated: true });
    assert.ok(reply);
    assert.match(reply.content.text, /Redmi Note 13: ₹14,999/);
    assert.equal(reply.status, "sent");
    assert.equal(sendCount, 1);
    assert.equal(await WhatsAppAIUsage.countDocuments({ userId: owner.user.id }), 0);
    const customerPlan = await Customer.find({
      userId: owner.user.id,
      platform: "whatsapp",
      platformId: CUSTOMER_WA_ID,
    })
      .hint("shop_platform_contact")
      .explain("executionStats");
    assert.equal(explainUsesIndex(customerPlan, "shop_platform_contact"), true);

    await postWebhook(
      app,
      "/api/whatsapp/webhook",
      inboundText("wamid.AI_IN", "What is the price of Redmi Note 13?"),
    );
    assert.equal(await Message.countDocuments({ direction: "outgoing" }), 1);
    assert.equal(sendCount, 1);
  } finally {
    restore();
  }
});

test("invoice PDF delivery is queued and becomes one idempotent document reply", async () => {
  const { Store } = require("../src/emi/models/platform");
  const { Tenant } = require("../src/emi/models/platform");
  const { Invoice } = require("../src/emi/models/sales");
  const billQueue = require("../src/services/whatsappBillQueue.service");
  const customer = await Customer.create({
    userId: owner.user.id,
    name: "Bill Customer",
    phone: "+919876500001",
    platform: "whatsapp",
    platformId: CUSTOMER_WA_ID,
  });
  const store = await Store.create({
    tenantId: owner.user.id,
    name: "Main",
    stateCode: "23",
    invoicePrefix: "WABILL",
  });
  const invoice = await Invoice.create({
    tenantId: owner.user.id,
    storeId: store._id,
    invoiceNo: "WABILL-000001",
    date: "2026-11-17",
    customerId: customer._id,
    status: "PAID",
    grossTotal: 11800,
    amountPaid: 11800,
  });
  const duePlan = await Invoice.find({
    tenantId: owner.user.id,
    status: { $in: ["UNPAID", "PARTIALLY_PAID"] },
    balanceDue: { $gt: 0 },
  })
    .sort({ dueDate: 1 })
    .hint("shop_due_list")
    .explain("executionStats");
  assert.equal(explainUsesIndex(duePlan, "shop_due_list"), true);
  await Tenant.create({ _id: owner.user.id, name: "Main", status: "ACTIVE" });
  await User.updateOne(
    { _id: owner.user.id },
    { $set: { "subscription.status": "active" } },
  );
  const oldBase = process.env.PUBLIC_BASE_URL;
  const oldSecret = process.env.WHATSAPP_BILL_URL_SECRET;
  process.env.PUBLIC_BASE_URL = "https://api.example.test";
  process.env.WHATSAPP_BILL_URL_SECRET = "test-bill-link-secret";
  let sentPayload;
  const restore = stub(whatsappApi, "sendMessage", async (payload) => {
    sentPayload = payload;
    return { messages: [{ id: "wamid.BILL" }] };
  });

  try {
    const auth = `Bearer ${owner.token}`;
    const privatePdf = await request(app)
      .get(`/api/emi/invoices/${invoice._id}/pdf`)
      .set("Authorization", auth);
    assert.equal(privatePdf.status, 200);
    assert.match(privatePdf.headers["content-type"], /application\/pdf/);
    assert.ok(privatePdf.body.subarray(0, 5).toString("ascii") === "%PDF-");

    const signedUrl = new URL(require("../src/emi/services/invoicePdf.service").createSignedUrl(invoice._id));
    const publicPdf = await request(app).get(`${signedUrl.pathname}${signedUrl.search}`);
    assert.equal(publicPdf.status, 200);
    const invalidLink = await request(app).get(
      `${signedUrl.pathname}?expires=${signedUrl.searchParams.get("expires")}&sig=${"0".repeat(64)}`,
    );
    assert.equal(invalidLink.status, 401);

    const queueRequest = () => request(app)
      .post(`/api/emi/invoices/${invoice._id}/send-whatsapp`)
      .set("Authorization", auth)
      .set("Idempotency-Key", "bill-send-001")
      .send({});
    const queued = await queueRequest();
    const duplicate = await queueRequest();
    assert.equal(queued.status, 202, JSON.stringify(queued.body));
    assert.equal(duplicate.status, 202);
    assert.equal(duplicate.body.data.jobId, queued.body.data.jobId);
    assert.equal(await WhatsAppBillJob.countDocuments({}), 1);
    await billQueue.drain();

    const completed = await WhatsAppBillJob.findById(queued.body.data.jobId);
    assert.equal(completed.status, "completed");
    assert.equal(sentPayload.type, "document");
    assert.equal(sentPayload.to, CUSTOMER_WA_ID);
    assert.match(sentPayload.mediaUrl, /\/api\/emi\/public\/whatsapp-bills\//);
    assert.ok(completed.pdfFileId);
    const queuedPdfUrl = new URL(sentPayload.mediaUrl);
    const queuedPdf = await request(app).get(
      `${queuedPdfUrl.pathname}${queuedPdfUrl.search}`,
    );
    assert.equal(queuedPdf.status, 200);
    assert.equal(queuedPdf.headers["content-type"], "application/pdf");
    assert.equal(queuedPdf.body.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(completed.messageId);
  } finally {
    restore();
    if (oldBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = oldBase;
    if (oldSecret === undefined) delete process.env.WHATSAPP_BILL_URL_SECRET;
    else process.env.WHATSAPP_BILL_URL_SECRET = oldSecret;
  }
});

test("WhatsApp bill quotes require customer confirmation before transactional invoice creation", async () => {
  const { Store, Tenant } = require("../src/emi/models/platform");
  const { Invoice, Payment } = require("../src/emi/models/sales");
  const { JournalEntry } = require("../src/emi/models/finance");
  const Order = require("../src/models/Order.model");
  const billQueue = require("../src/services/whatsappBillQueue.service");
  const product = await Product.create({
    userId: owner.user.id,
    name: "WhatsApp Bill Test Phone",
    price: 1250,
    stock: 5,
  });
  const customer = await Customer.create({
    userId: owner.user.id,
    name: "Invoice Customer",
    phone: `+${CUSTOMER_WA_ID}`,
    platform: "whatsapp",
    platformId: CUSTOMER_WA_ID,
    stateCode: "23",
  });
  await Tenant.create({
    _id: owner.user.id,
    name: "WhatsApp Bill Shop",
    stateCode: "23",
    status: "ACTIVE",
  });
  await Store.create({
    tenantId: owner.user.id,
    name: "Main",
    stateCode: "23",
    invoicePrefix: "WABOT",
  });
  await User.updateOne(
    { _id: owner.user.id },
    {
      $set: {
        "subscription.status": "active",
        "aiConfig.isEnabled": true,
        "aiConfig.whatsappAutoReplyEnabled": true,
        "aiConfig.whatsappBillCreationEnabled": true,
      },
    },
  );

  const oldBase = process.env.PUBLIC_BASE_URL;
  const oldSecret = process.env.WHATSAPP_BILL_URL_SECRET;
  process.env.PUBLIC_BASE_URL = "https://api.example.test";
  process.env.WHATSAPP_BILL_URL_SECRET = "test-bill-link-secret";
  const sentPayloads = [];
  const restore = stub(whatsappApi, "sendMessage", async (payload) => {
    sentPayloads.push(payload);
    return { messages: [{ id: `wamid.BOT${sentPayloads.length}` }] };
  });

  try {
    await postWebhook(
      app,
      "/api/whatsapp/webhook",
      inboundText("wamid.BILL_QUOTE", "BILL:\n2 x WhatsApp Bill Test Phone"),
    );
    const quote = await Message.findOne({
      direction: "outgoing",
      "content.text": /Unpaid bill ka quote/,
    });
    assert.ok(quote);
    const code = quote.content.text.match(/CONFIRM ([A-F\d]{12})/i)?.[1];
    assert.ok(code);
    assert.equal(await Invoice.countDocuments({ tenantId: owner.user.id }), 0);
    assert.equal((await Product.findById(product._id)).stock, 5);

    await postWebhook(
      app,
      "/api/whatsapp/webhook",
      inboundText("wamid.BILL_CONFIRM", `CONFIRM ${code}`),
    );
    const invoice = await Invoice.findOne({ tenantId: owner.user.id });
    assert.ok(invoice);
    assert.equal(invoice.status, "UNPAID");
    assert.equal(invoice.grossTotal, 250000);
    assert.equal(invoice.balanceDue, 250000);
    assert.equal((await Product.findById(product._id)).stock, 3);
    assert.ok(await Order.exists({ invoiceId: invoice._id }));
    assert.ok(
      await JournalEntry.exists({ tenantId: owner.user.id, refId: invoice._id }),
    );
    assert.equal(
      await Payment.countDocuments({
        tenantId: owner.user.id,
        invoiceId: invoice._id,
      }),
      0,
    );

    await postWebhook(
      app,
      "/api/whatsapp/webhook",
      inboundText("wamid.BILL_CONFIRM", `CONFIRM ${code}`),
    );
    assert.equal(await Invoice.countDocuments({ tenantId: owner.user.id }), 1);
    await billQueue.drain();

    const job = await WhatsAppBillJob.findOne({ tenantId: owner.user.id });
    assert.equal(job.status, "completed");
    assert.ok(job.pdfFileId);
    assert.ok(sentPayloads.some((payload) => payload.type === "document"));
  } finally {
    restore();
    if (oldBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = oldBase;
    if (oldSecret === undefined) delete process.env.WHATSAPP_BILL_URL_SECRET;
    else process.env.WHATSAPP_BILL_URL_SECRET = oldSecret;
  }
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

test("WhatsApp auto-reply requires an explicit valid shop opt-in", async () => {
  const auth = { Authorization: `Bearer ${owner.token}` };
  const profile = await request(app).get("/api/users/profile").set(auth);
  assert.equal(profile.body.data.aiConfig.whatsappAutoReplyEnabled, false);

  const invalid = await request(app)
    .put("/api/users/ai-config")
    .set(auth)
    .send({ whatsappAutoReplyEnabled: "true" });
  assert.equal(invalid.status, 400);

  const billBeforeReply = await request(app)
    .put("/api/users/ai-config")
    .set(auth)
    .send({ whatsappBillCreationEnabled: true });
  assert.equal(billBeforeReply.status, 400);

  const enabled = await request(app)
    .put("/api/users/ai-config")
    .set(auth)
    .send({ whatsappAutoReplyEnabled: true });
  assert.equal(enabled.status, 200);
  assert.equal(enabled.body.data.whatsappAutoReplyEnabled, true);

  const billEnabled = await request(app)
    .put("/api/users/ai-config")
    .set(auth)
    .send({ whatsappBillCreationEnabled: true });
  assert.equal(billEnabled.status, 200);
  assert.equal(billEnabled.body.data.whatsappBillCreationEnabled, true);
});

test("manual WhatsApp setup encrypts tokens and subscribes the selected WABA", async () => {
  const axios = require("axios");
  const whatsappService = require("../src/services/whatsapp.service");
  const tokenVault = require("../src/utils/tokenVault");
  const oldKey = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = require("node:crypto")
    .randomBytes(32)
    .toString("hex");
  const restorePhone = stub(whatsappApi, "getPhoneNumber", async () => ({
    display_phone_number: "+1 555 000 1111",
    verified_name: "Test Shop",
  }));
  const restoreGet = stub(axios, "get", async () => ({
    data: { data: [{ id: PHONE_NUMBER_ID }] },
  }));
  let subscribed = false;
  const restorePost = stub(axios, "post", async () => {
    subscribed = true;
    return { data: { success: true } };
  });

  try {
    await whatsappService.connectAccount(owner.user.id, {
      phoneNumberId: PHONE_NUMBER_ID,
      businessAccountId: "123456789",
      accessToken: "test-permanent-system-user-token",
    });
    const user = await User.findById(owner.user.id).select("+whatsappConfig.accessToken");
    assert.equal(tokenVault.isEncrypted(user.whatsappConfig.accessToken), true);
    assert.equal(
      tokenVault.decrypt(user.whatsappConfig.accessToken),
      "test-permanent-system-user-token",
    );
    assert.equal(user.whatsappConfig.webhookSubscribed, true);
    assert.equal(subscribed, true);
  } finally {
    restorePhone();
    restoreGet();
    restorePost();
    if (oldKey === undefined) delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
    else process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = oldKey;
  }
});
