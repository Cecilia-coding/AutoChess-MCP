let worker;
let sequence = 0;
const pending = new Map();
function runtime() {
  if (worker) return worker;
  worker = new Worker(new URL("runtime.js", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }) => {
    const job = pending.get(data.id);
    if (!job) return;
    pending.delete(data.id);
    clearTimeout(job.timer);
    if (data.error) job.reject(new Error(data.error));
    else job.resolve(data.value);
  };
  worker.onerror = () => reset("本地计算进程异常，请重试。");
  return worker;
}
function reset(message) {
  worker?.terminate();
  worker = null;
  for (const job of pending.values()) {
    clearTimeout(job.timer);
    job.reject(new Error(message));
  }
  pending.clear();
}
export function compute(operation, input) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const target = runtime();
    const timer = setTimeout(() => reset("本地计算超时，存档仍在。请简化这套技能后重试。"), 10000);
    pending.set(id, { resolve, reject, timer });
    target.postMessage({ id, operation, input });
  });
}
let dbPromise;
function database() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("autochess-local", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("records");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
export async function readLocal(key) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction("records").objectStore("records").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function writeLocal(key, value) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    tx.objectStore("records").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("本机存储失败"));
  });
}
export async function startLocal(pack) {
  const match = await compute("start", {
    id: crypto.randomUUID(),
    seed: crypto.getRandomValues(new Uint32Array(1))[0],
    pack,
  });
  await writeLocal("trial", match);
  return match;
}
export async function actLocal(action, expectedRevision, requestId) {
  return navigator.locks.request("autochess-local-trial", async () => {
    const match = await readLocal("trial");
    if (!match) throw new Error("本机没有试下局");
    if (
      match.lastRequest?.id === requestId &&
      match.lastRequest.revision === expectedRevision &&
      JSON.stringify(match.lastRequest.action) === JSON.stringify(action)
    )
      return match;
    if (match.revision !== expectedRevision) throw new Error("本机棋局已更新，请重新读取");
    const next = await compute("act", { match, action });
    next.lastRequest = { id: requestId, revision: expectedRevision, action };
    await writeLocal("trial", next);
    return next;
  });
}
export async function previewLocal(pack) {
  const result = await compute("preview", pack);
  if (!result.valid)
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  return result;
}
