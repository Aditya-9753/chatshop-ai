const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { io: connect } = require("socket.io-client");
const { startApp, stopApp, registerUser, postWebhook } = require("./helpers");

let app, server, url, owner, realtime;

const PHONE_NUMBER_ID = "555000111";

const connectAs = (token) =>
  new Promise((resolve, reject) => {
    const socket = connect(url, { auth: { token }, transports: ["websocket"], reconnection: false });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (error) => {
      socket.close();
      reject(error);
    });
  });

before(async () => {
  app = await startApp("chatshop-test-realtime");
  realtime = require("../src/realtime/socket");
  const User = require("../src/models/User.model");

  server = http.createServer(app);
  realtime.init(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;

  owner = await registerUser(app);
  await User.updateOne(
    { _id: owner.user.id },
    { whatsappConfig: { isConnected: true, phoneNumberId: PHONE_NUMBER_ID, accessToken: "t" } }
  );
});

after(async () => {
  realtime.close();
  await new Promise((resolve) => server.close(resolve));
  await stopApp();
});

test("a socket without a valid token is refused", async () => {
  await assert.rejects(connectAs("not-a-jwt"), /Not authorized/);
});

test("an incoming WhatsApp message is pushed to the owner's open inbox", async () => {
  const socket = await connectAs(owner.token);
  const received = new Promise((resolve) => socket.on("message:new", resolve));

  await postWebhook(app, "/api/whatsapp/webhook", {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ profile: { name: "Live Customer" }, wa_id: "15551234567" }],
              messages: [
                { from: "15551234567", id: "wamid.LIVE", type: "text", text: { body: "Live hello" } },
              ],
            },
          },
        ],
      },
    ],
  });

  const event = await received;
  socket.close();

  assert.equal(event.message.content.text, "Live hello");
  assert.equal(event.conversation.unreadCount, 1);
  assert.equal(event.conversation.customerId.name, "Live Customer");
});
