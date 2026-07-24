# 商用版权审查 (Rights Review)

> **已归档 2026-07-20** — 审查已完成:6 个房间 provenance 全部 approved(reviewer: Yanxiang Qin, 2026-07-20)。将来新增房间的审查方法(五步法)仍按本文执行;上线闸门保留在 ../COMPLIANCE.md。

**目的**：在对任何艺术房间收费之前（网页按房间卖、App 一次价），把每个房间的
`content/art-houses/<id>/provenance.json` 从 `commercial_use: "unclear_pending_review"`
推进到 `"approved"`（或换掉素材）。**这是收费上线前的硬闸门** —— 卖"商用权利不明"的 AI 素材有法律风险。

> ⚠️ 这不是法律意见。真正商用上线前，建议找一次 IP 律师快速过一遍，尤其是"用艺术家姓氏做房间品牌"这一块。

**收费模型（2026-07-20）**：前三层免费（van-gogh / monet / outdoor），其余用一次性 $1.99 一起解锁（网页 + App 同一个）。所以**只有付费的三层需要在开卖前过审**：`world-remembers-color`、`luminous-tide-dreamscape`、`unfinished-morning`。免费的前三层不出售、不触发这条（虽然为稳妥也可顺手确认）。当前 6 个全 pending。

---

## 五步法（每个房间做一遍）

### 1. 生成来源与商用权利
- 确认每个素材是用**你自己的 OpenAI 账号 / 项目自有 ImageGen 工作流**生成的。
- OpenAI 使用条款：你拥有并可**商用**你账号生成的输出（output 归属用户、允许商业使用）。→ 只要是你账号生成的，通常可商用。把生成账号/工具记进 provenance。
- **例外（需单独确认权利）——只有一张**：`luminous-tide-dreamscape` 的
  `src/game/assets/rooms/luminous-tide/luminous-tide-dream-river-shell-v1.jpg`，迁移账本（CREDITS.md）把它记为 **"accepted user-supplied project concept raster"**，即它**不是**走标准 ImageGen 工作流生成的，而是"用户提供的概念图"。（unfinished-morning 全部背景都是 ImageGen，无此例外——之前本文档误列，已更正。）
  - 你说"都是我生成的"——那就只需**确认这一张的实际来源**：若是你自己账号生成 / 你自己画的 → 你拥有，把真实来源写进 provenance 并标 approved 即可；若其实是从别处拿的（下载/他人作品）→ 要么拿到许可，要么**用你自己的 ImageGen 重新生成一张 dream-river 背景替换它**（把文件放回原路径，我来接线）。luminous-tide 属付费房，这张不清掉，解锁就不能开卖。

### 2. 相似性 / IP 风险
- 参考的画家全部是**公共领域**：Van Gogh(1890)、Monet(1926)、Raphael(1520)、Michelangelo(1564)、古代山水手卷 —— 均去世 >70 年，作品进入公共领域；**"画风"本身不受版权保护**。
- 逐张人工核对：是"某幅具体名作的近似复制"（有风险，要重做）还是"该风格的原创合成"（没问题）。provenance 已声称是原创合成 —— 核对一次即可。
- 竞品相似性：对照 MECCHA CHAMELEON 等竞品，确认美术/UI 没有直接照搬。

### 3. 命名与背书暗示
- 房间用了艺术家姓氏（"Van Gogh House"、"Monet Garden House"）。人已故 + 姓名未注册为该品类商标 → 法律风险低；但要避免**暗示"官方 / 博物馆授权"**。
- 建议：对外文案统一用 "inspired by / 致敬" 措辞；不用任何美术馆 logo、"official"、真实机构名。房间内 `room title` 已是中性名（Sunflower Parlor 等），可考虑对外主打中性名，艺术家名只做说明性副标题。

### 4. 第三方库 / 字体 / 服务
- **代码依赖**：仅 `qr`（MIT OR Apache-2.0，商用 OK）；构建依赖 typescript / vite / wrangler（商用 OK）。✅
- **字体**：CSS 只引用 Georgia / "Times New Roman" / system-ui / -apple-system（系统字体，无需授权）+ Inter（**未打包字体文件**，缺失时回退 system-ui）。→ 确认仓库没有内嵌任何字体文件；若将来想内嵌 Inter，它是 OFL（商用 OK，保留许可文件）。✅
- **Cloudflare / Turnstile**：服务，按其条款使用，OK。✅
- **头像 / 道具 / UI 图标**：确认全部你生成或自制（同第 1、2 步）。

### 5. 儿童合规（收费 + 面向孩子必查）
- **COPPA / GDPR-K**：你已经无广告、无第三方分析、成人邮箱 OTP —— 底子是对的。
- **收费要加"家长门"**：Apple 儿童品类强制（购买前家长验证）；网页收费同理建议加。
- **必备页面**：隐私政策 + 退款/服务条款（收费的法律前提）。

---

## 签字收尾（每个 provenance.json）

审完把每个 `provenance.json` 改成：
- `commercial_use`: `"approved"`（或 `"blocked"` + 替换素材）
- `reviewer`: 你的名字 / 法务
- `reviewed_at`: 日期
- `blocking_checks`: 逐项标注结论或清空
- 补上每个素材的生成来源 ID + 人工修改说明

**代码侧建议**：新增一个"已过审可售"白名单（例如 `SELLABLE_HOUSES`），**只有 `commercial_use=approved` 的房间才允许标价出售**；未过审的即便上线也只能保持免费/登录，不能挂价。这样"版权审查"和"能不能收费"在代码里强绑定，避免误卖。

---

## 各房间当前状态

| 房间 id | 收费? | 参考 | 公共领域? | 特别注意 | 现状 |
|---|---|---|---|---|---|
| van-gogh-house | 免费 | Van Gogh 1890 | ✅ | 前三层，不出售（不卡出售闸门） | pending |
| monet-garden-house | 免费 | Monet 1926 | ✅ | 前三层，不出售 | pending |
| outdoor-masters-journey | 免费 | 户外印象派大师 | ✅（核对具体参考） | 前三层，不出售 | pending |
| world-remembers-color（显示名 Color Rebirth） | **付费** | 原创为主 | 核对参考来源 | 对外名已中性 | pending |
| luminous-tide-dreamscape | **付费** | 原创月夜/星云合成 | ⚠️ 一张=用户概念图 | `dream-river-shell-v1.jpg` 权利单独确认 | pending |
| unfinished-morning | **付费** | Raphael/Michelangelo/手卷 | ✅ | School of Athens / Sistine 相似性复查 | pending |

**优先级**：只有加粗的 3 个**付费房间**需要在解锁开卖前过审（免费的前三层不出售、不卡闸门）。其中 luminous-tide 的 dream-river 那一张 raster 是唯一的硬结点。
