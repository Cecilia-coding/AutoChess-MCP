# 夜航船 Pixel Pack (`jianghu-pixels`)

`jianghu`（《夜航船》）全套 40 名江湖棋子与 12 件江湖装备的低饱和古籍像素外观资源包。

## 目录结构

- `scripts/build_pixels.py` — 零第三方依赖的纯 Python RGBA 像素图集与特效生成器
- `atlases/jh-*.png` — 40 张 `512x1088`（`8 列 × 17 行` × `64x64`，锚点 `(32, 40)`）单位动画图集
- `portraits/jh-*.png` — 40 张 `72x72` 透明背景棋子像素肖像
- `effects/ward.png` — `64x64` 河灯护阵结界图
- `effects/*.png`, `effects/attacks/*.png`, `effects/symbols/*.png` — `384x96`（4 帧 × `96x96`）技能与普攻特效
- `effects/events/*.png` — `512x128`（4 帧 × `128x128`）登场/受击/治疗/护盾/退场事件特效
- `manifest.json`, `effects/manifest.json`, `effects/events/manifest.json` — 运行时清单

## 重新生成

```bash
python3 assets/pixel-jianghu/scripts/build_pixels.py
npm run prepare:assets
```
