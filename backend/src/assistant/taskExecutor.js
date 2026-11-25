function createAbortError() {
  return Object.assign(new Error("Task execution cancelled"), { name: "AbortError" });
}

async function executeTaskGraph(tasks, execute, options = {}) {
  const concurrency = Number(options.concurrency || 1);
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Task concurrency must be a positive integer");
  }

  const byId = new Map(tasks.map((task) => [task.id, task]));
  if (byId.size !== tasks.length) throw new Error("Task IDs must be unique");
  for (const task of tasks) {
    for (const dependency of task.dependsOn || []) {
      if (!byId.has(dependency)) {
        throw new Error(`Task ${task.id} depends on unknown task ${dependency}`);
      }
      if (dependency === task.id) throw new Error(`Task ${task.id} cannot depend on itself`);
    }
  }

  const states = new Map(tasks.map((task) => [task.id, "pending"]));
  const outcomes = new Map();
  const inFlight = new Set();
  const signal = options.signal;

  async function run(task) {
    states.set(task.id, "running");
    await options.onTaskStarted?.(task);
    let outcome;
    try {
      const result = await execute(task, {
        signal,
        dependencies: Object.fromEntries(
          (task.dependsOn || []).map((id) => [id, outcomes.get(id)?.result]),
        ),
      });
      outcome = { taskId: task.id, status: "completed", result };
    } catch (error) {
      if (signal?.aborted || error.name === "AbortError") throw error;
      outcome = { taskId: task.id, status: "failed", error };
    }
    states.set(task.id, outcome.status);
    outcomes.set(task.id, outcome);
    await options.onTaskCompleted?.(task, outcome);
    return outcome;
  }

  while (outcomes.size < tasks.length) {
    if (signal?.aborted) throw createAbortError();

    for (const task of tasks) {
      if (states.get(task.id) !== "pending") continue;
      const dependencyOutcomes = (task.dependsOn || []).map((id) => outcomes.get(id));
      if (dependencyOutcomes.some((outcome) => outcome && outcome.status !== "completed")) {
        const outcome = {
          taskId: task.id,
          status: "blocked",
          error: new Error("A dependency did not complete successfully"),
        };
        states.set(task.id, "blocked");
        outcomes.set(task.id, outcome);
        await options.onTaskCompleted?.(task, outcome);
      }
    }

    const ready = tasks.filter(
      (task) =>
        states.get(task.id) === "pending" &&
        (task.dependsOn || []).every((id) => outcomes.get(id)?.status === "completed"),
    );
    for (const task of ready.slice(0, Math.max(0, concurrency - inFlight.size))) {
      let promise;
      promise = run(task).finally(() => inFlight.delete(promise));
      inFlight.add(promise);
    }

    if (!inFlight.size) {
      if (outcomes.size === tasks.length) break;
      throw new Error("Task dependency graph contains a cycle");
    }
    await Promise.race(inFlight);
  }

  return tasks.map((task) => outcomes.get(task.id));
}

module.exports = { executeTaskGraph };
