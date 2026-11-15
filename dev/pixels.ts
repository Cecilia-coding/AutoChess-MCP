import { createArena } from "../lib/autochess/pixel-arena";
import { simulateBattle } from "../lib/autochess/combat";
import { pixelManifest, aiPixelAppearance } from "../packs/ai/presentation/appearance";
import { packTerms } from "../packs/registry";
import type { Props } from "../components/autochess/arena-types";
import type { Combatant } from "../lib/autochess/types";
import { mountPreviewLayout } from "./pixel-layout";
import { findUnit } from "../content/autochess/units";
import { unitSkill } from "../content/autochess/unit-skills";
import { findTrait } from "../content/autochess/traits";
import { uniqueTraitCounts } from "../lib/autochess/stats";

const previewLayout = mountPreviewLayout();

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fighter = (
  templateId: string,
  id: string,
  row: number,
  col: number,
  star: 1 | 2 | 3 = 1,
): Combatant => ({ templateId, id, localRow: row, localCol: col, star, itemIds: [] });
const home = [
  fighter("ai-gpt", "gpt", 3, 2, 2),
  fighter("ai-musespark", "muse", 1, 1),
  fighter("ai-gemini", "gemini", 1, 3),
  fighter("ai-glm", "glm", 2, 4),
];
const away = [
  fighter("ai-doubao", "doubao", 3, 2, 2),
  fighter("ai-claude", "claude", 2, 1, 2),
  fighter("ai-grok", "grok", 1, 3),
  fighter("ai-deepseek", "deepseek", 2, 4),
];
let props: Props;
let gold = 20,
  purchase = 0,
  shopPage = 0;
const notes: unknown[] = [];
const status = (text: string) => {
  element("status").textContent = text;
};
function inspect(piece: Combatant) {
  const unit = findUnit(piece.templateId);
  if (!unit) return;
  const character = aiPixelAppearance.manifest.units.find((u) => u.id === piece.templateId)!;
  element<HTMLImageElement>("profile-art").src = aiPixelAppearance.publicPath + character.portrait;
  element("profile-name").textContent = unit.name;
  element("profile-star").textContent = `${piece.star} 星`;
  element("profile-skill").textContent = unitSkill(unit.id)?.name ?? "";
  element("profile-note").textContent = unit.skillNote ?? "";
  for (const [key, value] of Object.entries({
    hp: unit.statTemplate?.hp,
    atk: unit.statTemplate?.atk,
    armor: unit.statTemplate?.armor,
    range: unit.statTemplate?.range,
  }))
    element(`profile-${key}`).textContent = String(value ?? "—");
}
function syncPanels() {
  element("gold").textContent = String(gold);
  document.querySelectorAll("[data-preview-gold]").forEach((el) => (el.textContent = String(gold)));
  element("army-count").textContent = String(props.board.length);
  element("bench-count").textContent = String(props.bench.length);
  const traits = element("traits");
  traits.replaceChildren();
  for (const [id, count] of uniqueTraitCounts(props.board)) {
    const row = document.createElement("div"),
      label = document.createElement("span"),
      value = document.createElement("b");
    label.textContent = findTrait(id)?.name ?? id;
    value.textContent = String(count);
    row.append(label, value);
    traits.append(row);
  }
  document
    .querySelectorAll<HTMLButtonElement>(".pixel-shop-card")
    .forEach(
      (button) =>
        (button.disabled =
          !props.editable || props.bench.length >= 9 || gold < Number(button.dataset.cost)),
    );
  element<HTMLButtonElement>("refresh-shop").disabled = !props.editable || gold < 2;
}
const api = createArena(
  element<HTMLDivElement>("arena"),
  {
    onCell(row, col) {
      status(`己方落点：${row + 1} 行 ${col + 1} 列`);
    },
    onBench(id) {
      props.selectedId = id;
      api.setView(props);
    },
    onWithdraw() {},
    onInspect(piece) {
      inspect(piece);
      previewLayout.showInfo();
      status(
        `${pixelManifest.units.find((u) => u.id === piece.templateId)?.name ?? piece.templateId} · ${piece.star}★`,
      );
    },
    onDrop(source, target) {
      notes.push({ source, target });
      const unit = [...props.board, ...props.bench].find((p) => p.id === source.id);
      if (!unit) return;
      if (target.kind === "cell") {
        const occupant = props.board.find(
          (p) => p.localRow === target.row && p.localCol === target.col && p.id !== unit.id,
        );
        if (occupant) {
          status("此格已有棋子");
          return;
        }
      }
      props = {
        ...props,
        board: props.board.filter((p) => p.id !== unit.id),
        bench: props.bench.filter((p) => p.id !== unit.id),
      };
      if (target.kind === "cell")
        props.board.push({ ...unit, localRow: target.row, localCol: target.col });
      if (target.kind === "bench") props.bench.push(unit);
      if (target.kind === "sell") gold += findUnit(unit.templateId)?.cost ?? 1;
      status(target.kind === "sell" ? "已出售（预览）" : "布阵已更新");
      api.setView(props);
      syncPanels();
    },
    saleHitTest(x, y) {
      const r = element("sell").getBoundingClientRect();
      return props.editable && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    },
    onSaleHover(active) {
      element("sell").classList.toggle("drop-ready", active);
    },
  },
  undefined,
  { standalone: true },
);
element("zoom-in").onclick = () => api.zoomBy(1 / 1.25);
element("zoom-out").onclick = () => api.zoomBy(1.25);
element("fit").onclick = () => api.resetCamera();
element("arena")
  .querySelector("canvas")!
  .addEventListener("viewchange", (event) => {
    element("zoom-level").textContent = `${Math.round((event as CustomEvent).detail.zoom * 100)}%`;
  });
function reset() {
  gold = 20;
  props = {
    appearanceId: aiPixelAppearance.id,
    board: structuredClone(home),
    enemyBoard: structuredClone(away),
    bench: [
      fighter("ai-kimi", "bench-0", 0, 0),
      fighter("ai-codex", "bench-1", 0, 0),
      fighter("ai-musespark", "bench-2", 0, 0),
    ],
    enemyBench: [],
    opponentName: "模型乱斗",
    battle: null,
    timeMs: 0,
    running: false,
    editable: true,
    terms: packTerms("ai"),
    selectedId: undefined,
    onCell() {},
    onBench() {},
    onWithdraw() {},
    onDrop() {},
    controls: null,
    inventory: null,
    topPanel: null,
    notice: "",
    inspectorActions: () => null,
    onDismiss() {},
    onInspect() {},
    shopOpen: false,
    shopEnabled: true,
    onShopToggle() {},
  };
  api.setView(props);
  syncPanels();
  inspect(props.board[1]!);
}
reset();
const select = element<HTMLSelectElement>("character");
for (const character of pixelManifest.units) {
  const option = document.createElement("option");
  option.value = character.id;
  option.textContent = character.name;
  select.append(option);
}
select.value = "ai-kimi";
select.onchange = () => {
  if (props.battle) reset();
  props.bench[0] = fighter(select.value, "bench-0", 0, 0);
  api.setView({ ...props });
  inspect(props.bench[0]!);
};
element("deploy").onclick = () => {
  props = { ...props, battle: null, timeMs: 0, running: false, editable: true };
  api.setView(props);
  syncPanels();
};
element("battle").onclick = () => {
  const battle = simulateBattle({
    battleId: "pixel-preview",
    seed: 42,
    left: props.board,
    right: props.enemyBoard,
  });
  props = { ...props, battle, timeMs: 0, running: true, editable: false };
  element<HTMLInputElement>("seek").max = String(battle.durationMs);
  api.setView(props);
  syncPanels();
  const journal = element("journal");
  journal.replaceChildren();
  for (const event of battle.keyEvents.slice(0, 8)) {
    const p = document.createElement("p");
    p.textContent = `${(event.timeMs / 1000).toFixed(1)}s · ${event.text}`;
    journal.append(p);
  }
};
element("reset").onclick = reset;
element("play").onclick = () => {
  props = { ...props, running: !props.running };
  api.setView(props);
};
element<HTMLInputElement>("seek").oninput = (event) => {
  props = { ...props, running: false, timeMs: Number((event.target as HTMLInputElement).value) };
  api.setView(props);
};
let last = performance.now();
function tick(now: number) {
  if (props.battle && props.running) {
    const duration = props.battle.durationMs;
    props = { ...props, timeMs: Math.min(duration, props.timeMs + now - last) };
    if (props.timeMs >= duration) props.running = false;
    api.setView(props);
  }
  last = now;
  element("time").textContent = props.battle ? `${(props.timeMs / 1000).toFixed(1)}s` : "备战";
  element<HTMLButtonElement>("play").querySelector("span")!.textContent = props.running
    ? "暂停"
    : "播放";
  element("stage-label").textContent = props.battle
    ? props.running
      ? "战斗进行中"
      : "战斗回放"
    : "布阵阶段";
  element<HTMLInputElement>("seek").value = String(props.timeMs);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
document.querySelectorAll<HTMLButtonElement>(".pixel-shop-card").forEach(
  (button) =>
    (button.onclick = () => {
      const id = button.dataset.template!,
        cost = Number(button.dataset.cost);
      if (!props.editable || gold < cost || props.bench.length >= 9) return;
      const unit = fighter(id, `purchase-${++purchase}`, 0, 0);
      gold -= cost;
      props = { ...props, bench: [...props.bench, unit] };
      api.setView(props);
      inspect(unit);
      syncPanels();
      status(`已招募 ${findUnit(id)?.name}`);
    }),
);
element("refresh-shop").onclick = () => {
  if (!props.editable || gold < 2) return;
  gold -= 2;
  shopPage++;
  document.querySelectorAll<HTMLButtonElement>(".pixel-shop-card").forEach((button, i) => {
    const actor = pixelManifest.units[(shopPage * 5 + i) % pixelManifest.units.length]!,
      unit = findUnit(actor.id)!;
    button.dataset.template = actor.id;
    button.dataset.cost = String(unit.cost);
    button.querySelector("img")!.src = aiPixelAppearance.publicPath + actor.portrait;
    button.querySelector("strong")!.textContent = unit.name;
    button.querySelector("small")!.textContent = unitSkill(unit.id)?.name ?? "";
    const price = button.querySelector(".pixel-price")!;
    price.lastChild!.textContent = String(unit.cost);
  });
  syncPanels();
  status("商店已刷新");
};
// Local preview automation uses the real renderer and battle output.
Object.assign(window, {
  pixelPreview: {
    get props() {
      return props;
    },
    notes,
    screenPoint: api.screenPoint,
    screenCell: api.screenCell,
    screenBench: api.screenBench,
    setView(next: Partial<Props>) {
      props = { ...props, ...next };
      api.setView(props);
    },
    dispose: api.dispose,
  },
});
