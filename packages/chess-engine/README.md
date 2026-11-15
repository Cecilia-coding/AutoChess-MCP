# 共享战斗引擎

从正式棋室提取的同一套战斗实现。棋室通过原有导出入口注入内置内容，棋谱工坊通过编译适配器注入自创内容。每个 `createBattleEngine(content)` 实例拥有独立解析器，无全局可变棋谱注册表。

```sh
npm ci
npm run build
```

`createBattleEngine` 接收 `BattleContent`（棋子、技能、面板、羁绊与装备解析），返回接受 `BattleInput` 的同步纯战斗函数，输出完整 `BattleOutput` 事件和统计。固定种子与相同输入可复现战斗。这个包不读文件、环境变量、账号或网络；宿主负责验证输入及保存结果。

`targeted` 技能积木支持按阵营、距离、生命比例和攻击排序选取目标，接收预先编译的三星伤害、治疗、护盾、控制时长，以及临时属性变化。规则时间、棋盘尺寸、加时与护盾上限位于 `src/constants.ts`。

原项目的 `lib/autochess/combat.ts` 是内置内容适配器，其余旧导入路径保留薄重导出，所有实际实现仅在本包维护。
