import { compute, previewLocal, startLocal, writeLocal } from "./local.js";
import { createRelay, trialSummary } from "./relay.js";
const $ = (id) => document.getElementById(id);
const clone = (value) => structuredClone(value);
const storageKey = "autochess-authoring-v1";
const growthNames = {
  health: "生命",
  attack: "攻击",
  damage: "技能伤害",
  healing: "治疗",
  shield: "护盾",
  controlDuration: "控制时长",
};
const effects = {
  damage: "伤害",
  heal: "治疗",
  shield: "护盾",
  stun: "眩晕",
  stat_change: "属性变化",
};
let relay,
  editRevision = 0,
  catalogOffset = 0,
  trialForRelay;
let guide,
  pack,
  selected = 0,
  draft = null,
  dirty = true,
  jsonDraft = null;
let mode = null,
  wizardStep = 1,
  chosenPreset = "",
  rosterPrepared = false;

function node(tag, text, parent) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (parent) parent.append(el);
  return el;
}
function status(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}
function persist() {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        pack,
        editRevision,
        draft,
        dirty,
        jsonDraft,
        mode,
        wizardStep,
        chosenPreset,
        rosterPrepared,
        starterSize: $("starter-size").value,
      }),
    );
  } catch {
    status("浏览器无法保存本地记录，请及时导出 JSON，并另存草稿编辑凭据。", true);
  }
}
function markDirty() {
  editRevision++;
  relay?.changed();
  dirty = true;
  persist();
  $("preview-state").textContent = "内容已修改，等待重新校验";
  document.querySelector(".preview-panel").classList.add("stale");
  updateRevision();
}
function updateRevision() {
  $("revision").textContent =
    `${draft ? `已存修订 ${draft.revision}` : "本地草稿"}${dirty ? " · 有未保存修改" : ""}`;
}
function syncCredentials() {
  $("draft-id").value = relay?.credentials?.sessionId ?? "";
  $("draft-key").value = relay?.credentials?.accessKey ?? "";
  updateRevision();
}
function field(parent, label, object, key, type = "number", choices) {
  const wrap = node("label", label, parent);
  const input = node(choices ? "select" : "input", null, wrap);
  if (choices)
    for (const [value, name] of Object.entries(choices)) {
      const option = node("option", name, input);
      option.value = value;
    }
  else {
    input.type = type;
    if (type === "number") input.step = "any";
  }
  input.value = object[key] ?? "";
  input.addEventListener(choices ? "change" : "input", () => {
    object[key] = type === "number" && !choices ? input.valueAsNumber : input.value;
    markDirty();
  });
  return input;
}
function renderGrowth() {
  $("growth").replaceChildren();
  for (const [key, label] of Object.entries(growthNames)) {
    const row = node("tr", null, $("growth"));
    node("td", label, row);
    pack.rules.starGrowth[key].forEach((value, index) => {
      const input = node("input", null, node("td", null, row));
      input.type = "number";
      input.step = "any";
      input.value = value;
      input.setAttribute("aria-label", `${label} ${index + 1} 星倍率`);
      input.readOnly = index === 0;
      input.addEventListener("input", () => {
        pack.rules.starGrowth[key][index] = input.valueAsNumber;
        chosenPreset = "";
        $("preset").value = "";
        markDirty();
      });
    });
  }
}
function renderUnitList() {
  $("unit-select").replaceChildren();
  pack.units.forEach((unit, i) => {
    const option = node("option", `${unit.name} · ${unit.cost}费`, $("unit-select"));
    option.value = i;
  });
  selected = Math.min(selected, pack.units.length - 1);
  $("unit-select").value = selected;
  $("remove-unit").disabled = pack.units.length === 1;
}
function effectTemplate(type) {
  if (type === "stun") return { type, durationMs: 1000 };
  if (type === "stat_change")
    return { type, stat: "attack", operation: "percent", value: 0.1, durationMs: 5000 };
  return {
    type,
    ...(type === "damage" ? { damageType: "magic" } : {}),
    amount: { flat: 100, attackRatio: 0, healthRatio: 0 },
    ...(type === "shield" ? { durationMs: 5000 } : {}),
  };
}
function renderUnit() {
  renderUnitList();
  const root = $("unit-editor");
  root.replaceChildren();
  const unit = pack.units[selected];
  let group = node("div", null, root);
  group.className = "fields two";
  field(group, "名称", unit, "name", "text").addEventListener("change", renderUnitList);
  field(group, "稳定 ID", unit, "id", "text");
  field(group, "费用", unit, "cost").addEventListener("change", renderUnitList);
  field(group, "定位", unit, "role", "text", {
    tank: "前排",
    melee: "近战",
    ranged: "远程",
    caster: "法师",
    support: "辅助",
  });
  node("h3", "一星基础属性", root).className = "subheading";
  group = node("div", null, root);
  group.className = "fields";
  for (const [key, label] of Object.entries({
    health: "生命",
    attack: "攻击",
    attackIntervalMs: "攻击间隔 / 毫秒",
    range: "射程 / 格",
    armor: "护甲",
    magicResist: "魔抗",
  }))
    field(group, label, unit.stats, key);
  node("h3", "技能", root).className = "subheading";
  field(root, "技能名称", unit.skill, "name", "text");
  const trigger = unit.skill.trigger;
  const triggerSelect = field(root, "什么时候触发", { type: trigger.type }, "type", "text", {
    battle_start: "开战时",
    interval: "每隔一段时间",
    every_attacks: "每攻击若干次",
    mana_full: "满法力时",
  });
  triggerSelect.addEventListener("change", () => {
    const defaults = {
      battle_start: {},
      interval: { intervalMs: 5000 },
      every_attacks: { count: 3 },
      mana_full: { maxMana: 100, startMana: 0 },
    };
    unit.skill.trigger = { type: triggerSelect.value, ...defaults[triggerSelect.value] };
    markDirty();
    renderUnit();
  });
  group = node("div", null, root);
  group.className = "fields two";
  for (const [key, label] of Object.entries({
    intervalMs: "触发间隔 / 毫秒",
    count: "攻击次数",
    maxMana: "法力上限",
    startMana: "初始法力",
  }))
    if (key in trigger) field(group, label, trigger, key);
  group = node("div", null, root);
  group.className = "fields two";
  const target = unit.skill.target;
  field(group, "作用阵营", target, "team", "text", {
    ally: "友军",
    enemy: "敌方",
    self: "自身",
  }).addEventListener("change", () => {
    if (target.team !== "ally") target.includeSelf = false;
    if (target.team !== "enemy" && target.selector === "current") target.selector = "nearest";
    if (target.team === "self") target.count = 1;
    markDirty();
    renderUnit();
  });
  field(group, "选取方式", target, "selector", "text", {
    current: "当前攻击目标",
    nearest: "最近",
    lowest_health_ratio: "血量比例最低",
    highest_attack: "攻击最高",
  });
  field(group, "目标数量", target, "count");
  const include = field(
    group,
    "友军选取包含自己",
    { value: String(target.includeSelf) },
    "value",
    "text",
    { false: "否", true: "是" },
  );
  include.addEventListener("change", () => {
    target.includeSelf = include.value === "true";
    markDirty();
  });
  unit.skill.effects.forEach((effect, index) => {
    const box = node("div", null, root);
    box.className = "effect";
    const row = node("div", null, box);
    row.className = "row";
    node("h3", `效果 ${index + 1}`, row);
    const remove = node("button", "移除效果", row);
    remove.disabled = unit.skill.effects.length === 1;
    remove.onclick = () => {
      unit.skill.effects.splice(index, 1);
      markDirty();
      renderUnit();
    };
    const kind = field(box, "效果类型", { type: effect.type }, "type", "text", effects);
    kind.addEventListener("change", () => {
      unit.skill.effects[index] = effectTemplate(kind.value);
      markDirty();
      renderUnit();
    });
    const cells = node("div", null, box);
    cells.className = "fields";
    if (effect.type === "damage")
      field(cells, "伤害类型", effect, "damageType", "text", { physical: "物理", magic: "魔法" });
    if (effect.amount) {
      field(cells, "固定值", effect.amount, "flat");
      field(cells, "一星攻击系数", effect.amount, "attackRatio");
      field(cells, "一星生命系数", effect.amount, "healthRatio");
    }
    if ("durationMs" in effect) field(cells, "持续 / 毫秒", effect, "durationMs");
    if (effect.type === "stat_change") {
      field(cells, "属性", effect, "stat", "text", {
        attack: "攻击",
        armor: "护甲",
        magicResist: "魔抗",
        attackSpeed: "攻速",
      });
      field(cells, "运算", effect, "operation", "text", {
        flat: "固定加减值",
        percent: "比例加减（0.1=10%）",
      });
      field(cells, "变化值", effect, "value");
    }
  });
  const add = node("button", "＋ 技能效果", root);
  add.style.marginTop = "12px";
  add.onclick = () => {
    unit.skill.effects.push(effectTemplate("damage"));
    markDirty();
    renderUnit();
  };
}
function render() {
  $("pack-name").value = pack.name;
  $("pack-description").value = pack.description;
  renderGrowth();
  renderUnit();
  syncCredentials();
  $("json-editor").value = jsonDraft ?? JSON.stringify(pack, null, 2);
  $("preset").value = matchingPreset();
  if (rosterPrepared) chosenPreset = matchingPreset();
  renderBeginner();
  applyMode();
}

function matchingPreset() {
  return (
    Object.keys(guide.presets).find((key) =>
      Object.keys(growthNames).every(
        (stat) =>
          JSON.stringify(guide.presets[key][stat]) === JSON.stringify(pack.rules.starGrowth[stat]),
      ),
    ) ?? ""
  );
}
function applyPreset(key) {
  const preset = guide.presets[key];
  if (!preset) return;
  const { name: _name, ...growth } = preset;
  pack.rules.starGrowth = clone(growth);
  chosenPreset = key;
  $("preset").value = key;
  renderGrowth();
  markDirty();
}

function applyMode() {
  $("entry-choices").hidden = mode !== null;
  document.querySelector(".mode-switch").hidden = mode === null;
  $("collaboration").hidden = mode === null;
  $("beginner").hidden = mode !== "beginner";
  document.querySelectorAll(".expert-only").forEach((el) => {
    el.hidden = mode !== "expert";
  });
  $("mode-beginner").setAttribute("aria-pressed", String(mode === "beginner"));
  $("mode-expert").setAttribute("aria-pressed", String(mode === "expert"));
  $("toolbar").hidden = mode === null || (mode === "beginner" && wizardStep < 3);
  document.querySelector(".preview-panel").hidden =
    mode === null || (mode === "beginner" && wizardStep < 3);
  for (let i = 1; i <= 3; i++) {
    $(`wizard-${i}`).hidden = wizardStep !== i;
    $(`step-${i}`).classList.toggle("active", wizardStep === i);
    $(`step-${i}`).setAttribute("aria-current", wizardStep === i ? "step" : "false");
  }
  $("step-3").disabled = !rosterPrepared;
}
function renderBeginnerRoster() {
  const list = $("beginner-roster");
  list.replaceChildren();
  pack.units.forEach((unit, i) => {
    const button = node("button", `${unit.name} · ${unit.cost}费`, list);
    button.setAttribute("aria-pressed", String(i === selected));
    button.onclick = () => {
      selected = i;
      renderBeginner();
    };
  });
}
function suggestedStats(unit) {
  const blueprint = guide.starter.blueprints[unit.role]?.[unit.cost];
  if (blueprint) unit.stats = clone(blueprint.stats);
}
function skillSignature(skill) {
  const copy = clone(skill);
  delete copy.name;
  copy.target.includeSelf ??= false;
  if (copy.trigger.type === "mana_full") copy.trigger.startMana ??= 0;
  copy.effects.forEach((effect) => {
    if (effect.amount)
      effect.amount = { flat: 0, attackRatio: 0, healthRatio: 0, ...effect.amount };
  });
  const sort = (value) =>
    Array.isArray(value)
      ? value.map(sort)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, sort(value[key])]),
          )
        : value;
  return JSON.stringify(sort(copy));
}
function updateRosterHint() {
  const missing = [];
  if (!Object.hasOwn(guide.presets, chosenPreset)) missing.push("选择一个成长模板");
  if (!$("beginner-name").value.trim()) missing.push("填写棋谱名称");
  $("roster-hint").textContent = missing.length ? `请${missing.join("，并")}。` : "";
  return missing.length === 0;
}
function renderBeginner() {
  if (!guide?.starter) return;
  $("beginner-name").value = pack.name;
  $("beginner-description").value = pack.description;
  const cards = $("preset-cards");
  cards.replaceChildren();
  const descriptions = {
    endurance: ["升星主要加生命", "攻击和单次技能效果保持不变，棋子更耐打。"],
    balanced: ["生存与输出一起成长", "生命、攻击和技能同步提升，适合从这里开始。"],
    skill: ["升星强化技能", "普攻攻击保持不变，技能伤害、治疗与护盾提高。"],
  };
  for (const [key, preset] of Object.entries(guide.presets)) {
    const card = node("label", null, cards);
    card.className = "preset-card";
    const radio = node("input", null, card);
    radio.type = "radio";
    radio.name = "growth-preset";
    radio.value = key;
    radio.checked = chosenPreset === key;
    radio.required = true;
    radio.setAttribute("aria-describedby", "roster-hint");
    node("strong", preset.name, card);
    for (const line of descriptions[key] ?? []) node("span", line, card);
    radio.onchange = () => {
      applyPreset(key);
      updateRosterHint();
      persist();
    };
  }
  updateRosterHint();
  renderBeginnerRoster();
  const root = $("beginner-editor");
  root.replaceChildren();
  const unit = pack.units[selected];
  if (!unit) return;
  let group = node("div", null, root);
  group.className = "fields two";
  field(group, "棋子名称", unit, "name", "text").addEventListener("input", renderBeginnerRoster);
  const cost = field(group, "费用", { cost: String(unit.cost) }, "cost", "text", {
    1: "1费",
    2: "2费",
    3: "3费",
    4: "4费",
    5: "5费",
  });
  cost.addEventListener("change", () => {
    unit.cost = Number(cost.value);
    suggestedStats(unit);
    markDirty();
    renderBeginner();
  });
  field(
    group,
    "棋子定位",
    unit,
    "role",
    "text",
    Object.fromEntries(
      Object.entries(guide.starter.roles).map(([key, recipe]) => [key, recipe.name]),
    ),
  ).addEventListener("change", () => {
    suggestedStats(unit);
    markDirty();
    renderBeginner();
  });
  const signature = skillSignature(unit.skill);
  const recipeId =
    Object.keys(guide.starter.skillRecipes).find(
      (key) => skillSignature(guide.starter.skillRecipes[key].skill) === signature,
    ) ?? "";
  const recipeSelect = field(group, "技能类型", { recipe: recipeId }, "recipe", "text", {
    "": "自定义技能（保留当前）",
    ...Object.fromEntries(
      Object.entries(guide.starter.skillRecipes).map(([key, recipe]) => [key, recipe.name]),
    ),
  });
  recipeSelect.addEventListener("change", () => {
    if (recipeSelect.value) {
      unit.skill = clone(guide.starter.skillRecipes[recipeSelect.value].skill);
      markDirty();
      renderBeginner();
    }
  });
  field(root, "技能名称", unit.skill, "name", "text");
  const summary = node("div", null, root);
  summary.className = "beginner-summary";
  node(
    "div",
    recipeId
      ? guide.starter.skillRecipes[recipeId].description
      : "这枚棋子使用自定义技能，可切到进阶编辑查看完整效果。",
    summary,
  );
  node(
    "div",
    `一星：生命 ${unit.stats.health}，攻击 ${unit.stats.attack}，射程 ${unit.stats.range} 格。`,
    summary,
  );
  node("p", "调整费用或定位会重新填写建议基础属性。技能单独选择，名称会保留。", root).className =
    "hint";
  $("beginner-remove").disabled = pack.units.length === 1;
  $("next-unit").textContent = selected === pack.units.length - 1 ? "查看整套预览" : "下一枚";
}
function showPreview(result) {
  if (!result.valid)
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  const root = $("preview-result");
  root.replaceChildren();
  $("warnings").replaceChildren();
  result.warnings.forEach(
    (warning) => (node("div", warning.message, $("warnings")).className = "warning"),
  );
  for (const unit of result.preview) {
    const card = node("div", null, root);
    card.className = "preview-card";
    node("h3", `${unit.name} · ${unit.cost}费 · ${unit.skillName}`, card);
    const scroll = node("div", null, card);
    scroll.className = "table-wrap";
    const table = node("table", null, scroll);
    const head = node("tr", null, node("thead", null, table));
    ["星级", "生命", "攻击", "技能效果（减伤前）"].forEach((text) => node("th", text, head));
    const body = node("tbody", null, table);
    for (const row of unit.stars) {
      const tr = node("tr", null, body);
      [row.star, row.stats.health, row.stats.attack].forEach((value) =>
        node("td", String(value), tr),
      );
      node(
        "td",
        row.effects
          .map(
            (effect) =>
              `${effects[effect.type]} ${"value" in effect ? effect.value : ""}${"durationMs" in effect ? ` / ${effect.durationMs}ms` : ""}${effect.stat ? ` ${effect.stat} (${effect.operation})` : ""}`,
          )
          .join("；"),
        tr,
      );
    }
  }
  $("preview-state").textContent = "与当前输入一致";
  document.querySelector(".preview-panel").classList.remove("stale");
}
async function request(path, method, body) {
  if (path === "api/guide") return compute("guide");
  if (path === "api/preview") return previewLocal(body.pack);
  if (path === "api/starter") {
    const result = await compute("starter", body);
    if (!result.valid) throw new Error("起步内容无效");
    return result;
  }
  throw new Error("此操作已改为本机处理，请刷新页面。");
}
async function run(fn) {
  $("workspace").disabled = true;
  try {
    await fn();
  } catch (error) {
    status(error.message, true);
  } finally {
    $("workspace").disabled = false;
  }
}
function requireAppliedJson() {
  if (jsonDraft !== null) throw new Error("JSON 有待应用的修改，请先点击「应用 JSON」。");
}
const verify = () => {
  requireAppliedJson();
  return request("api/preview", "POST", { pack });
};
function accept(result, accessKey, clearDirty = false) {
  editRevision++;
  pack = result.pack;
  jsonDraft = null;
  selected = 0;
  if (result.id) draft = { id: result.id, revision: result.revision, accessKey };
  if (clearDirty) dirty = false;
  rosterPrepared = true;
  wizardStep = 3;
  render();
  showPreview({ ...result, valid: true });
  persist();
  relay?.changed();
}
async function clipboard(text) {
  await navigator.clipboard.writeText(text);
  status("已复制。");
}
function canReplace() {
  return (!dirty && jsonDraft === null) || confirm("当前有未保存修改。确定替换编辑内容吗？");
}

$("pack-name").addEventListener("input", (event) => {
  pack.name = event.target.value;
  markDirty();
});
$("pack-description").addEventListener("input", (event) => {
  pack.description = event.target.value;
  markDirty();
});
$("unit-select").onchange = () => {
  selected = Number($("unit-select").value);
  renderUnit();
};
$("preset").onchange = () => {
  applyPreset($("preset").value);
};
$("preview").onclick = () =>
  run(async () => {
    const result = await verify();
    pack = result.pack;
    render();
    showPreview(result);
    persist();
    status("校验通过，已生成全体棋子的三星预览。");
  });
$("start-trial").onclick = () =>
  run(async () => {
    requireAppliedJson();
    await previewLocal(pack);
    await startLocal(pack);
    persist();
    location.href = new URL("play.html", location.href).href;
  });
$("save").onclick = () =>
  run(async () => {
    requireAppliedJson();
    const result = await previewLocal(pack);
    draft = { id: "local", revision: (draft?.revision ?? 0) + 1 };
    await writeLocal("pack", result.pack);
    accept({ ...result, id: "local", revision: draft.revision }, undefined, true);
    status(`已保存到本机 · 修订 ${draft.revision}。可导出 JSON 备份或换设备。`);
  });
$("export").onclick = () =>
  run(async () => {
    const result = await verify();
    showPreview(result);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result.pack, null, 2) + "\n"], { type: "application/json" }),
    );
    const link = node("a", null, document.body);
    link.href = url;
    link.download = "chess-pack.json";
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("已导出当前棋谱。文件只含规则与内容，可导入其他兼容工坊。");
  });
async function importPack(input) {
  const result = await request("api/preview", "POST", { pack: input });
  draft = null;
  dirty = true;
  accept(result);
  status("已导入为本机草稿，可以保存或开始试下。");
}
$("import").onclick = () => $("file").click();
$("file").onchange = () =>
  run(async () => {
    const file = $("file").files[0];
    try {
      if (file && canReplace()) await importPack(JSON.parse(await file.text()));
    } finally {
      $("file").value = "";
    }
  });
$("example").onclick = () => {
  if (canReplace()) run(() => importPack(clone(guide.example)));
};
$("apply-json").onclick = () =>
  run(async () => {
    const result = await request("api/preview", "POST", {
      pack: JSON.parse($("json-editor").value),
    });
    dirty = true;
    accept(result);
    status("JSON 已应用到当前草稿，尚未保存。");
  });
$("json-editor").addEventListener("input", (event) => {
  jsonDraft = event.target.value;
  persist();
});
$("refresh-json").onclick = () => {
  if (jsonDraft !== null && !confirm("放弃尚未应用的 JSON 修改，改用当前表单内容？")) return;
  jsonDraft = null;
  $("json-editor").value = JSON.stringify(pack, null, 2);
  persist();
  status("已从当前表单刷新 JSON。");
};
$("add-unit").onclick = () => {
  const unit = clone(guide.example.units[1]);
  unit.id = `unit_${crypto.randomUUID().slice(0, 8)}`;
  unit.name = "新棋子";
  pack.units.push(unit);
  selected = pack.units.length - 1;
  markDirty();
  renderUnit();
};
$("remove-unit").onclick = () => {
  if (pack.units.length > 1) {
    pack.units.splice(selected, 1);
    markDirty();
    renderUnit();
  }
};
$("copy-mcp").onclick = () => run(() => clipboard($("mcp-url").value));
$("copy-access").onclick = () =>
  run(async () => {
    await relay.start();
    syncCredentials();
    await clipboard(JSON.stringify(relay.machineAccess(), null, 2));
  });
$("open-draft").onclick = () =>
  run(async () => {
    await relay.close();
    syncCredentials();
  });
$("forget").onclick = () => {
  if (confirm("清除本浏览器的编辑记录？请先导出 JSON 备份。")) {
    localStorage.removeItem(storageKey);
    draft = null;
    dirty = true;
    syncCredentials();
    status("已清除此浏览器编辑记录。当前表单仍可导出。");
  }
};

$("back-entry").onclick = () => {
  mode = null;
  applyMode();
  persist();
  status("当前棋谱已保留，请选择编辑方式。");
};
$("step-1").onclick = () => $("back-template").click();
$("step-3").onclick = () => {
  if (!rosterPrepared) return;
  wizardStep = 3;
  renderBeginner();
  applyMode();
  persist();
};
$("mode-beginner").onclick = () => {
  if (mode === "expert") {
    wizardStep = 3;
    rosterPrepared = true;
  }
  mode = "beginner";
  renderBeginner();
  applyMode();
  persist();
};
$("mode-expert").onclick = () => {
  mode = "expert";
  render();
  persist();
};
$("enter-guided").onclick = () => {
  mode = "beginner";
  renderBeginner();
  applyMode();
  status("按步骤选择模板和名单。");
};
$("enter-expert").onclick = () => {
  mode = "expert";
  render();
  status("当前棋谱已打开，可以直接编辑。");
};
$("beginner-name").addEventListener("input", (event) => {
  pack.name = event.target.value;
  updateRosterHint();
  markDirty();
});
$("beginner-description").addEventListener("input", (event) => {
  pack.description = event.target.value;
  markDirty();
});
function openRosterStep() {
  if (!updateRosterHint()) {
    wizardStep = 1;
    applyMode();
    const missingField = $("preset-cards").querySelector(":checked")
      ? $("beginner-name")
      : $("preset-cards").querySelector("input");
    missingField.focus();
    return;
  }
  wizardStep = 2;
  applyMode();
  persist();
  status("选择起步数量。生成后可以继续增删棋子。");
  const heading = $("wizard-2").querySelector("h2");
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: "nearest" });
}
$("to-roster").onclick = openRosterStep;
$("step-2").onclick = openRosterStep;
$("back-template").onclick = () => {
  wizardStep = 1;
  applyMode();
  persist();
};
$("back-roster").onclick = () => {
  wizardStep = 1;
  renderBeginner();
  applyMode();
  persist();
};
$("starter-size").onchange = () => {
  $("size-explanation").textContent =
    `${$("starter-size").value} 枚棋子，每个费用档 ${Number($("starter-size").value) / 5} 枚。`;
  if (pack) persist();
};
$("build-roster").onclick = () => {
  if (rosterPrepared && !confirm("重新生成会替换当前名单和技能。继续吗？")) return;
  run(async () => {
    const result = await request("api/starter", "POST", {
      name: pack.name,
      description: pack.description,
      preset: chosenPreset,
      size: Number($("starter-size").value),
    });
    dirty = true;
    accept(result);
    status("名单已生成。可以改名字、选定位和技能，再查看整套预览。");
  });
};
$("beginner-add").onclick = () => {
  const unit = clone(pack.units[selected]);
  unit.id = `unit_${crypto.randomUUID().slice(0, 8)}`;
  unit.name = "新棋子";
  pack.units.push(unit);
  selected = pack.units.length - 1;
  markDirty();
  renderBeginner();
};
$("beginner-remove").onclick = () => {
  if (pack.units.length > 1) {
    pack.units.splice(selected, 1);
    selected = Math.min(selected, pack.units.length - 1);
    markDirty();
    renderBeginner();
  }
};
$("next-unit").onclick = () => {
  if (selected < pack.units.length - 1) {
    selected++;
    renderBeginner();
  } else
    run(async () => {
      const result = await verify();
      pack = result.pack;
      renderBeginner();
      showPreview(result);
      persist();
      document
        .querySelector(".preview-panel")
        .scrollIntoView({ behavior: "smooth", block: "start" });
      status("整套预览已更新，可以保存或导出。");
    });
};

async function editorSummary() {
  if (trialForRelay) return trialSummary(trialForRelay);
  const unit = pack?.units[selected];
  return compute("summary", {
    phase: "editor",
    revision: editRevision,
    title: pack.name.slice(0, 200),
    unitCount: pack.units.length,
    catalogOffset,
    catalog: pack.units
      .slice(catalogOffset, catalogOffset + 100)
      .map(({ id, name, cost }) => ({ id, name: name.slice(0, 200), cost })),
    ...(unit ? { selectedUnit: unit } : {}),
    growth: pack.rules.starGrowth,
  });
}
async function executeEditor(command, envelope) {
  requireAppliedJson();
  if (envelope.expectedRevision !== editRevision)
    throw new Error("本机内容已更新，请重新读取后再修改。");
  const revision = editRevision;
  if (command.kind === "start_trial") {
    trialForRelay = await startLocal(pack);
    persist();
    return { navigate: "play.html" };
  }
  if (command.kind === "inspect_unit") {
    const index = pack.units.findIndex((unit) => unit.id === command.unitId);
    if (index < 0) throw new Error("找不到棋子");
    selected = index;
    renderUnit();
    return;
  }
  if (command.kind !== "edit") throw new Error("请先开启试下局");
  const action = command.action;
  if (action.type === "catalog_page") {
    catalogOffset = action.offset;
    return;
  }
  if (action.type === "select_unit") {
    const index = pack.units.findIndex((unit) => unit.id === action.unitId);
    if (index < 0) throw new Error("找不到棋子");
    selected = index;
    renderUnit();
    return;
  }
  let next = clone(pack);
  if (action.type === "prepare") next = (await compute("starter", action.options)).pack;
  else if (action.type === "metadata") {
    if (action.name !== undefined) next.name = action.name;
    if (action.description !== undefined) next.description = action.description;
  } else if (action.type === "growth") next.rules.starGrowth = action.growth;
  else if (action.type === "put_unit") {
    const index = next.units.findIndex((unit) => unit.id === action.unit.id);
    if (index < 0) next.units.push(action.unit);
    else next.units[index] = action.unit;
  } else if (action.type === "remove_unit")
    next.units = next.units.filter((unit) => unit.id !== action.unitId);
  const result = await previewLocal(next);
  if (editRevision !== revision) throw new Error("编辑过程中本机内容发生变化，请重新读取");
  accept(result);
  if (action.type === "put_unit") {
    selected = pack.units.findIndex((unit) => unit.id === action.unit.id);
    render();
  }
  markDirty();
  status("机的修改已应用到本机棋谱。");
}
relay = createRelay({
  snapshot: editorSummary,
  execute: executeEditor,
  onStatus: (message) => {
    $("relay-status").textContent = message;
    syncCredentials();
  },
});
try {
  guide = await request("api/guide");
  for (const size of guide.starter.sizes) {
    const option = node("option", `${size} 枚`, $("starter-size"));
    option.value = size;
  }
  $("starter-size").onchange();
  for (const [key, preset] of Object.entries(guide.presets)) {
    const option = node("option", preset.name, $("preset"));
    option.value = key;
  }
  let previous;
  try {
    previous = JSON.parse(localStorage.getItem(storageKey) ?? "null");
  } catch {
    /* Storage may be unavailable. */
  }
  let result, recoveryError;
  if (previous?.pack) {
    try {
      result = await request("api/preview", "POST", { pack: previous.pack });
    } catch (error) {
      recoveryError = error;
    }
  }
  if (previous?.pack) {
    pack = result?.pack ?? previous.pack;
    draft = previous.draft?.id === "local" ? previous.draft : null;
    editRevision = previous.editRevision ?? 0;
    dirty = previous.dirty;
    jsonDraft = previous.jsonDraft ?? null;
    wizardStep = previous.wizardStep ?? 3;
    chosenPreset = previous.chosenPreset ?? "";
    rosterPrepared = previous.rosterPrepared ?? true;
    if (guide.starter.sizes.includes(Number(previous.starterSize))) {
      $("starter-size").value = previous.starterSize;
      $("starter-size").onchange();
    }
  } else {
    result = await request("api/preview", "POST", { pack: guide.example });
    pack = result.pack;
  }
  render();
  if (result) showPreview(result);
  else $("preview-state").textContent = "草稿尚未通过校验，请修正后重新预览";
  $("mcp-url").value = new URL("mcp", location.href).href;
  $("workspace").disabled = false;
  void relay.resume();
  status(
    recoveryError
      ? `已恢复未完成的草稿，请继续修改。\n${recoveryError.message}`
      : previous?.pack
        ? "已恢复本浏览器的棋谱。请选择编辑方式。"
        : "请选择编辑方式。",
    Boolean(recoveryError),
  );
} catch (error) {
  status(`工坊连接失败：${error.message}。刷新页面可重试。`, true);
}
