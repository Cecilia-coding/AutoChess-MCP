export function trialSummary(match, inspectedId) {
  const names = new Map(match.pack.units.map((unit) => [unit.id, unit]));
  const panels = new Map(match.panels.map((panel) => [panel.pieceId, panel]));
  return {
    phase: "trial",
    revision: match.revision,
    title: match.pack.name.slice(0, 200),
    unitCount: match.pack.units.length,
    ...(inspectedId && names.has(inspectedId) ? { selectedUnit: names.get(inspectedId) } : {}),
    trial: {
      id: match.id,
      round: match.round,
      phase: match.phase,
      ...(match.result ? { result: match.result } : {}),
      health: match.player.health,
      opponentHealth: match.opponent.health,
      gold: match.player.gold,
      level: match.player.level,
      xp: match.player.xp,
      shop: match.player.shop.map((id) => {
        const unit = names.get(id);
        return unit ? { unitId: unit.id, name: unit.name.slice(0, 200), cost: unit.cost } : null;
      }),
      pieces: match.player.pieces.map((piece) => ({
        id: piece.id,
        unitId: piece.unitId,
        name: names.get(piece.unitId).name.slice(0, 200),
        star: piece.star,
        row: piece.row,
        col: piece.col,
        health: panels.get(piece.id).maxHp,
        attack: panels.get(piece.id).atk,
      })),
      ...(match.battle
        ? {
            battle: {
              outcome: match.battle.outcome,
              durationMs: match.battle.durationMs,
              events: match.battle.events
                .filter((event) => ["cast", "death", "end"].includes(event.type))
                .slice(-12)
                .map(({ timeMs, text }) => ({ timeMs, text: text.slice(0, 500) })),
            },
          }
        : {}),
    },
  };
}
/** The relay is opt-in. Only this module sends network requests, always using a projected summary. */
export function createRelay({ snapshot, execute, onStatus }) {
  const storageKey = "autochess-relay-v1";
  let credentials = null,
    stopped = true,
    abort,
    timer;
  try {
    credentials = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
  } catch {}
  const status = (text) => onStatus?.(text);
  async function request(path, method = "GET", body) {
    const response = await fetch(new URL(path, location.href), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(credentials ? { Authorization: `Bearer ${credentials.ownerKey}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: abort?.signal,
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error?.message ?? "接力失败");
    return value;
  }
  async function publish(ack) {
    if (!credentials) return;
    return request(`api/relay/${credentials.sessionId}/state`, "POST", {
      state: await snapshot(),
      ...(ack ? { ack } : {}),
    });
  }
  async function loop() {
    while (!stopped && credentials) {
      try {
        const reply = await request(`api/relay/${credentials.sessionId}/commands`);
        if (reply.closed) throw new Error("接力连接已关闭，请重新开启。");
        if (!reply.command) continue;
        const command = reply.command;
        let error, result;
        try {
          if ((await snapshot()).revision !== command.expectedRevision)
            throw new Error("本机内容已更新，请机重新读取修订。");
          result = await execute(command.command, command);
        } catch (reason) {
          error = reason.message;
        }
        await publish({ requestId: command.requestId, ...(error ? { error } : {}) });
        status(error ? `机的操作未执行：${error}` : "已执行机的操作。");
        if (result?.navigate) {
          location.href = new URL(result.navigate, location.href).href;
          return;
        }
      } catch (error) {
        if (!stopped) {
          stopped = true;
          credentials = null;
          sessionStorage.removeItem(storageKey);
          status(`云端接力已断开：${error.message} 本机内容仍在。`);
        }
        return;
      }
    }
  }
  async function resume() {
    if (!credentials) return;
    stopped = false;
    abort = new AbortController();
    try {
      await publish();
      void loop();
      status("云端接力已连接；仅临时中转当前局面。");
    } catch (error) {
      credentials = null;
      stopped = true;
      sessionStorage.removeItem(storageKey);
      status(`请重新开启云端接力：${error.message}`);
    }
  }
  async function start() {
    if (credentials && !stopped) return credentials;
    abort = new AbortController();
    credentials = await request("api/relay", "POST", { state: await snapshot() });
    sessionStorage.setItem(storageKey, JSON.stringify(credentials));
    stopped = false;
    void loop();
    status("接力已开启，保持本页打开。关闭后两分钟内清除云端摘要。");
    return credentials;
  }
  async function close() {
    stopped = true;
    abort?.abort();
    abort = undefined;
    clearTimeout(timer);
    try {
      if (credentials) await request(`api/relay/${credentials.sessionId}`, "DELETE");
    } finally {
      credentials = null;
      sessionStorage.removeItem(storageKey);
      status("云端接力已关闭。");
    }
  }
  function changed() {
    clearTimeout(timer);
    if (!credentials || stopped) return;
    timer = setTimeout(() => {
      void publish().catch((error) => status(error.message));
    }, 400);
  }
  const suspend = () => {
    stopped = true;
    abort?.abort();
    clearTimeout(timer);
  };
  window.addEventListener("beforeunload", suspend);
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void resume();
  });
  return {
    start,
    resume,
    close,
    changed,
    get credentials() {
      return credentials;
    },
    machineAccess() {
      return credentials
        ? {
            sessionId: credentials.sessionId,
            accessKey: credentials.accessKey,
            mcp: new URL("mcp", location.href).href,
          }
        : null;
    },
  };
}
