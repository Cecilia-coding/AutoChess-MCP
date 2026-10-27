import assert from "node:assert/strict";
import test from "node:test";
import { goldAmount, levelLabel, packTerms, starLabel } from "../packs/terms";

test("the AI pack exposes its themed display vocabulary", () => {
  const terms = packTerms("ai");
  assert.equal(terms.gold.name, "Token");
  assert.equal(terms.level.name, "参数规模");
  assert.equal(terms.reroll.name, "重新生成");
  assert.equal(goldAmount(terms, 4), "4 Token");
  assert.equal(levelLabel(terms, 2), "14B");
  assert.equal(starLabel(terms, 1), "INT4");
  assert.equal(starLabel(terms, 3), "FP32");
});

test("other packs keep the generic display vocabulary", () => {
  const terms = packTerms("jianghu");
  assert.equal(terms.gold.name, "金币");
  assert.equal(terms.level.name, "等级");
  assert.equal(terms.reroll.name, "刷新");
  assert.equal(goldAmount(terms, 4), "4 金");
  assert.equal(levelLabel(terms, 2), "Lv2");
  assert.equal(starLabel(terms, 2), "2★");
});
