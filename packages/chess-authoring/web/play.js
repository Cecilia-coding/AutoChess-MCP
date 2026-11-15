import { readLocal, startLocal, actLocal } from "./local.js";
import { createRelay, trialSummary } from "./relay.js";
const $ = (id) => document.getElementById(id);
let match, selected, inspectedId, relay;
const node = (tag, text, parent) => {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  parent?.append(el);
  return el;
};
function status(text, error = false) {
  $("play-status").textContent = text;
  $("play-status").classList.toggle("error", error);
}
async function run(fn) {
  $("play-workspace").disabled = true;
  $("reload").disabled = true;

  try {
    await fn();
  } catch (error) {
    status(error.message, true);
  } finally {
    $("play-workspace").disabled = !match;
    $("reload").disabled = false;
  }
}
const name = (id) => match.pack.units.find((unit) => unit.id === id)?.name ?? id;
const pieceLabel = (piece) => `${name(piece.unitId)}\n${"★".repeat(piece.star)}`;
function selectPiece(piece) {
  selected = selected === piece.id ? null : piece.id;
  render();
  relay?.changed();
}
function render() {
  $("pack-title").textContent = match.pack.name;
  $("match-summary").textContent =
    `第 ${match.round} 回合 · 你 ${match.player.health} 生命 / 对手 ${match.opponent.health} 生命${match.phase === "finished" ? ` · ${{ win: "获胜", loss: "落败", draw: "平局" }[match.result]}` : ""}`;
  $("economy").textContent =
    `金币 ${match.player.gold} · 等级 ${match.player.level} · 经验 ${match.player.xp} · 上场 ${match.player.pieces.filter((piece) => piece.row !== null).length}/${match.player.level}`;
  $("ready").disabled = match.phase === "finished";
  $("upgrade").disabled = match.phase === "finished" || match.player.level >= match.rules.maxLevel;
  $("upgrade").textContent = `购买 ${match.rules.upgradeXp} 经验（${match.rules.upgradeCost} 金）`;
  $("refresh").textContent = `刷新商店（${match.rules.refreshCost} 金）`;
  $("refresh").disabled = match.phase === "finished" || match.player.gold < match.rules.refreshCost;
  $("shop").replaceChildren();
  match.player.shop.forEach((id, slot) => {
    const unit = match.pack.units.find((unit) => unit.id === id);
    const button = node(
      "button",
      unit ? `${unit.name}\n${unit.cost} 金 · 购买` : "已售出",
      $("shop"),
    );
    button.disabled = !unit || match.phase === "finished" || match.player.gold < unit.cost;
    button.onclick = () => act({ type: "buy", slot });
  });
  $("board").replaceChildren();
  for (let row = match.board.rows - 1; row >= 0; row--)
    for (let col = 0; col < match.board.cols; col++) {
      const piece = match.player.pieces.find((piece) => piece.row === row && piece.col === col);
      const button = node("button", piece ? pieceLabel(piece) : "·", $("board"));
      button.setAttribute(
        "aria-label",
        `第 ${row + 1} 行第 ${col + 1} 列${piece ? ` ${name(piece.unitId)}` : " 空位"}`,
      );
      button.setAttribute("aria-pressed", String(Boolean(piece && selected === piece.id)));
      button.onclick = () => {
        if (selected && selected !== piece?.id) act({ type: "move", pieceId: selected, row, col });
        else if (piece) selectPiece(piece);
        else status("先选择备战席或棋盘上的棋子。");
      };
    }
  $("bench").replaceChildren();
  for (const piece of match.player.pieces.filter((piece) => piece.row === null)) {
    const button = node("button", pieceLabel(piece), $("bench"));
    button.setAttribute("aria-pressed", String(selected === piece.id));
    button.onclick = () => selectPiece(piece);
  }
  if (!$("bench").children.length) node("p", "备战席为空", $("bench"));
  const piece = match.player.pieces.find((piece) => piece.id === selected);
  if (!piece) selected = null;
  const panel = match.panels.find((panel) => panel.pieceId === selected);
  $("piece-detail").textContent =
    piece && panel
      ? `${pieceLabel(piece).replace("\n", " ")} · 生命 ${panel.maxHp} · 攻击 ${panel.atk} · 每秒攻击 ${Number(panel.aspd.toFixed(3))} 次 · 护甲 ${panel.armor} · 魔抗 ${panel.mr}`
      : "选中棋子可查看升星后的实际面板。";
  $("sell").disabled = !piece || match.phase === "finished";
  $("to-bench").disabled = !piece || piece.row === null || match.phase === "finished";
  $("rules").textContent =
    `双方 ${match.rules.startHealth} 生命、${match.rules.startGold} 起始金币。每回合收入 ${match.rules.income} 金，每 ${match.rules.interestPerGold} 存款增加 1 金利息，最多 ${match.rules.maxInterest} 金。三枚同名同星自动合成；三星封顶。等级决定上场数量，每回合获得 ${match.rules.roundXp} 经验。败者扣 ${match.rules.lossBase} 加敌方存活棋子数的生命，平局双方扣 ${match.rules.lossBase}。至多 ${match.rules.maxRounds} 回合，届时生命较多者胜。缺少的费用档自动从商店抽取池排除。技能按一星属性和整套成长表计算；战斗每 100ms 推进，护盾沿用引擎上限（最大生命的 40%）。试下使用开局棋谱快照，创作中的后续修改在新局生效。`;
  $("trial-mcp").value = new URL("mcp", location.href).href;
  $("trial-id").value = relay?.credentials?.sessionId ?? "";
  $("trial-key").value = relay?.credentials?.accessKey ?? "";
  $("battle-log").replaceChildren();
  $("battle-units").replaceChildren();
  $("history").replaceChildren();
  $("battle-summary").textContent = "布阵后点击开战。";
  if (match.battle) {
    const battle = match.battle;
    $("battle-summary").textContent =
      `第 ${match.history.at(-1).round} 回合：${{ left: "你赢了", right: "对手获胜", draw: "平局" }[battle.outcome]} · ${(battle.durationMs / 1000).toFixed(1)} 秒`;
    const table = node("table", null, $("battle-units"));
    const head = node("tr", null, node("thead", null, table));
    for (const title of ["棋子", "阵营", "最大生命", "剩余生命", "伤害", "治疗"])
      node("th", title, head);
    const body = node("tbody", null, table);
    for (const unit of battle.units) {
      const tr = node("tr", null, body);
      for (const value of [
        unit.name,
        unit.team === "left" ? "你" : "对手",
        unit.maxHp,
        unit.survivingHp,
        unit.damageDealt,
        unit.healingDone,
      ])
        node("td", String(value), tr);
    }
    for (const event of battle.events)
      node("li", `${(event.timeMs / 1000).toFixed(1)}s ${event.text}`, $("battle-log"));
  }
  for (const row of match.history)
    node(
      "li",
      `第 ${row.round} 回合：${{ left: "胜", right: "负", draw: "平" }[row.outcome]}，生命 ${row.playerHealth} : ${row.opponentHealth}`,
      $("history"),
    );
}
async function load() {
  match = await readLocal("trial");
  if (!match) {
    status("本机还没有试下局。返回创作，点击「试下这套棋」。");
    return;
  }
  render();
  status(`已读取本机存档 · 修订 ${match.revision}`);
}
async function applyAction(
  action,
  expectedRevision = match.revision,
  requestId = crypto.randomUUID(),
) {
  match = await actLocal(action, expectedRevision, requestId);
  render();
  relay?.changed();
  status(
    match.phase === "finished"
      ? "本局已结束，可查看战报或再开一局。"
      : `本机已保存 · 修订 ${match.revision}`,
  );
}
function act(action) {
  return run(() => applyAction(action));
}
$("reload").onclick = () => run(load);
$("ready").onclick = () => act({ type: "ready" });
$("refresh").onclick = () => act({ type: "refresh" });
$("upgrade").onclick = () => act({ type: "upgrade" });
$("sell").onclick = () => act({ type: "sell", pieceId: selected });
$("to-bench").onclick = () => act({ type: "move", pieceId: selected, row: null, col: null });
$("new-game").onclick = () =>
  run(async () => {
    if (!match) throw new Error("请先从创作页面开局");
    if (match.phase !== "finished" && !confirm("另开一局会替换本机当前试下存档，继续吗？")) return;
    match = await startLocal(match.pack);
    selected = null;
    render();
    relay.changed();
    status("已在本机开始新局。");
  });
$("copy-trial").onclick = () =>
  run(async () => {
    if (!match) throw new Error("请先从创作页面开局");
    await relay.start();
    render();
    await navigator.clipboard.writeText(JSON.stringify(relay.machineAccess()));
    status("机的接力凭据已复制，请保持本页打开。");
  });
$("open-trial").onclick = () =>
  run(async () => {
    await relay.close();
    if (match) render();
  });
relay = createRelay({
  snapshot: () => {
    if (!match) throw new Error("本机没有试下局");
    return trialSummary(
      match,
      inspectedId ?? match.player.pieces.find((piece) => piece.id === selected)?.unitId,
    );
  },
  execute: async (command, envelope) => {
    if (command.kind === "inspect_unit") {
      if (!match.pack.units.some((unit) => unit.id === command.unitId))
        throw new Error("找不到棋子");
      inspectedId = command.unitId;
      return;
    }
    if (command.kind !== "play") throw new Error("当前处于试下页；要编辑棋谱，请玩家返回创作页。");
    $("play-workspace").disabled = true;
    try {
      await applyAction(command.action, envelope.expectedRevision, envelope.requestId);
    } finally {
      $("play-workspace").disabled = false;
    }
  },
  onStatus: (text) => {
    $("relay-status").textContent = text;
  },
});
run(async () => {
  await load();
  if (match) await relay.resume();
});
