const { test } = require("node:test");
const assert = require("node:assert/strict");
const { executeTaskGraph } = require("../src/assistant/taskExecutor");

test("runs independent tasks in parallel and preserves results in plan order", async () => {
  const tasks = [
    { id: "first", dependsOn: [] },
    { id: "second", dependsOn: [] },
    { id: "third", dependsOn: [] },
  ];
  let active = 0;
  let peak = 0;
  const outcomes = await executeTaskGraph(
    tasks,
    async (task) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, task.id === "first" ? 15 : 2));
      active -= 1;
      return task.id;
    },
    { concurrency: 2 },
  );
  assert.equal(peak, 2);
  assert.deepEqual(outcomes.map((outcome) => outcome.result), ["first", "second", "third"]);
});

test("waits for dependencies and blocks downstream tasks after failure", async () => {
  const started = [];
  const outcomes = await executeTaskGraph(
    [
      { id: "root", dependsOn: [] },
      { id: "child", dependsOn: ["root"] },
      { id: "independent", dependsOn: [] },
      { id: "blocked", dependsOn: ["failed"] },
      { id: "failed", dependsOn: [] },
    ],
    async (task) => {
      started.push(task.id);
      if (task.id === "failed") throw new Error("no result");
      return task.id;
    },
    { concurrency: 3 },
  );
  const byId = new Map(outcomes.map((outcome) => [outcome.taskId, outcome]));
  assert.equal(started.includes("child"), true);
  assert.equal(started.includes("blocked"), false);
  assert.equal(byId.get("failed").status, "failed");
  assert.equal(byId.get("blocked").status, "blocked");
});

test("rejects malformed or cyclic dependency graphs", async () => {
  await assert.rejects(
    executeTaskGraph([{ id: "a", dependsOn: ["missing"] }], async () => null),
    /unknown task/,
  );
  await assert.rejects(
    executeTaskGraph(
      [
        { id: "a", dependsOn: ["b"] },
        { id: "b", dependsOn: ["a"] },
      ],
      async () => null,
    ),
    /cycle/,
  );
});
