const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startApp, stopApp, registerUser } = require("./helpers");

let app;
let token;
let Incident;
let GuardianNotification;
let AuditLog;

before(async () => {
  app = await startApp("chatshop-test-guardian-incidents");
  const account = await registerUser(app);
  const User = require("../src/models/User.model");
  await User.updateOne({ _id: account.user.id }, { $set: { role: "admin" } });
  token = account.token;
  Incident = require("../src/modules/systemGuardian/models/Incident");
  GuardianNotification = require("../src/modules/systemGuardian/models/Notification").GuardianNotification;
  AuditLog = require("../src/modules/systemGuardian/models/AuditLog");
});

after(stopApp);

const adminRequest = (method, path) =>
  request(app)[method](path).set("Authorization", `Bearer ${token}`);

test("resolving an incident clears it from active alerts but preserves its history", async () => {
  const incident = await Incident.create({
    title: "Test API incident",
    category: "API",
    severity: "HIGH",
    status: "OPEN",
    fingerprint: `guardian-test-${Date.now()}`,
  });
  const notification = await GuardianNotification.create({
    incidentId: incident._id,
    eventType: "incident:new",
    title: incident.title,
    severity: incident.severity,
  });

  const activeBefore = await adminRequest("get", "/api/admin/guardian/incidents?status=ACTIVE");
  assert.equal(activeBefore.status, 200);
  assert.ok(activeBefore.body.incidents.some((item) => String(item._id) === String(incident._id)));

  const resolveWithoutNote = await adminRequest(
    "patch",
    `/api/admin/guardian/incidents/${incident._id}/status`
  ).send({ status: "RESOLVED" });
  assert.equal(resolveWithoutNote.status, 400);

  for (const status of ["ACKNOWLEDGED", "INVESTIGATING"]) {
    const response = await adminRequest(
      "patch",
      `/api/admin/guardian/incidents/${incident._id}/status`
    ).send({ status });
    assert.equal(response.status, 200, JSON.stringify(response.body));
  }
  const resolved = await adminRequest(
    "patch",
    `/api/admin/guardian/incidents/${incident._id}/status`
  ).send({ status: "RESOLVED", note: "The service has recovered." });
  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));

  const activeAfter = await adminRequest("get", "/api/admin/guardian/incidents?status=ACTIVE");
  assert.equal(activeAfter.body.incidents.some((item) => String(item._id) === String(incident._id)), false);
  const resolvedHistory = await adminRequest(
    "get",
    "/api/admin/guardian/incidents?status=RESOLVED"
  );
  assert.ok(resolvedHistory.body.incidents.some((item) => String(item._id) === String(incident._id)));
  assert.ok(await GuardianNotification.findOne({ _id: notification._id, readAt: { $ne: null } }));
  assert.equal(await AuditLog.countDocuments({ incidentId: incident._id }), 3);
});
