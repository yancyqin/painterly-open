# 收费与发行（现行计划）

> 决策记录见 [DECISIONS.md](DECISIONS.md) 的 D-014（收费模型）与 D-015（发行顺序）。

## 模型（2026-07-20 定稿）
- **前三层免费**：`van-gogh-house`（匿名可玩可创建）+ `monet-garden-house` + `outdoor-masters-journey`（免费但需登录）。收到的邀请永远免费；**来找（seek）在所有房间永远免费**。
- **一次解锁全部**：其余所有房间（现在的 world-remembers-color / luminous-tide / unfinished-morning，以及**将来新增的任何房间**）用**一次性 $2.99** 一起解锁，只解锁"来藏（hide/创建）"。不按房间单卖。
- 买的主体是 **Hider/创作者**："一人解锁、多人免费来找"。
- 售卖真相只有两处：**网页 Stripe** + **Apple 付费 App**（$2.99 买断，无内购）。同一个内部权益 `bundle:all-houses`。

> 上线闸门：只有 `provenance.commercial_use=approved` 的房间才可随解锁出售（只卡付费房，免费前三层不出售）。**当前 6 个房间全部 approved**（reviewer: Yanxiang Qin, 2026-07-20）；将来新增房间按 [archive/RIGHTS-REVIEW.md](archive/RIGHTS-REVIEW.md) 的五步法过审后再入解锁包。

## 发行顺序（D-015）
1. **itch.io 免费版**（下一步）：免费网页版上架做曝光，引流回 `pc.lucasacademy.org`；itch 不做任何付费。页面文案与素材清单见 [ITCH-PAGE.md](ITCH-PAGE.md)。
2. **Apple App Store**（之后）：**$2.99 一次性买断付费 App，无 IAP**。买 App 即含全部房间；App 内不出现购买流程。需要 Apple 开发者账号（$99/年）+ Xcode。开工时要定的实现点：
   - "已购 App"如何映射服务端权益：iOS 构建视为已解锁（最简）或首启用 App 收据换一条 `bundle:all-houses`（跨设备一致）。
   - 儿童品类其余规则照守：无外链、无三方分析、隐私标签。
3. **不上 CrazyGames / Poki**（owner 不要广告门户）；Discord / Facebook Instant / Steam 不在当前计划。

## Entitlement 模型（用 owner 已建好的表，无新迁移）
`migrations/0005_accounts_and_art_houses.sql`（已上线）的 `entitlements` 表，**product_id 制**：
```
entitlements(id, account_id→accounts, product_id, source_provider, source_reference,
             status CHECK('active'|'refunded'|'revoked'), created_at, updated_at,
             UNIQUE(source_provider, source_reference))
INDEX (account_id, product_id, status)
```
- `source_provider`+`source_reference` UNIQUE → 每笔支付只映射一次，幂等、可退款撤销。
- 无 `products` 表：目录在代码里（worker 权威），唯一售卖产品 `product_id = "bundle:all-houses"`。
- 可创建判定：`FREE_HOUSES → 放行；其余 → 需登录 且 有 active 的 bundle:all-houses`。新增房间自动进付费集合。
- 价格常量 `UNLOCK_PRICE_CENTS = 299`；目录经 `/api/config` 下发客户端（单一来源）。

## 已实现（全部本地验证过）
- **worker**：`FREE_HOUSES` / `isPaidHouse()` / `accountHasUnlock()`；`/api/config products` = `{freeHouses, unlockProduct, unlockPriceCents, checkout, devGrant}`（`checkout = Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET)`，两把密钥齐自动开）；`GET /api/account/entitlements` → `{unlocked}`；创建挑战双闸门（登录 401 / 未解锁 402）；`POST /api/dev/grant-entitlement`（仅 localhost）。
- **Stripe**：`POST /api/checkout`（raw fetch 建托管 Checkout Session，内联 `price_data`=$2.99，无需在 Stripe 建 Product；带 `client_reference_id`/metadata；`success_url=/?unlocked=1&art=<house>`；商品名/描述用客户端发来的本地化文案，`locale=auto`）+ `POST /api/webhooks/stripe`（`src/stripe.js` 验签：HMAC-SHA256、5 分钟防重放、常数时间比较；`checkout.session.completed`/`async_payment_succeeded` → 写权益（按 `payment_intent` 幂等）；`charge.refunded` → 反写 refunded）。5 个签名单测。
- **客户端**：大厅付费房卡 = 变暗 + 🔒（**不带价**，防"按房收费"误读）；架下小灰字"来找永远免费"（`store.seekFree`）；点锁 → 确认弹窗 `#unlock-dialog`（"解锁全部房间来藏 / 一次性 $2.99。来找朋友的房间永远免费 / 前往 Stripe 付款 / 以后再说"，16 语言）→ Stripe（本地为 dev 授权）；回跳 `/?unlocked=1` 轮询权益后进房。
- **线上状态**：付费闸门已由 Codex 部署；`sk_live_` + webhook（`whsec_`）已配 → 线上 checkout **已开**。owner 的两个账号（yancyqin/yancyqin2@gmail.com）已手工授予 bundle。

## 待办
1. **Stripe 测试模式跑一遍**（owner 暂缓）：切 `sk_test_` + 测试 webhook，用第三个未解锁邮箱 + 测试卡 4242 走通 付款→解锁→退款撤销。
2. **支付费率**：按 Stripe 当前美国标准线上卡费率 2.9%+30¢，$2.99 约收 39¢（约 13%）；定制/微支付费率需直接向 Stripe 确认，属于账号级定价，代码无需改。
3. **合规页面**：隐私政策 + 退款/服务条款 + 购买前家长门（见 [COMPLIANCE.md](COMPLIANCE.md)）。
4. **解锁 UI 收尾**：恢复购买入口；已解锁后的状态展示。
5. **itch 免费版上架**（见 ITCH-PAGE.md）→ 之后 **Apple 付费 App**。

## ⚠️ 部署前必读：先迁移 D1
仓库已恢复线上记录过的 `0009_lobby_preview.sql`，迁移历史重新对齐。Live Painting 又新增 `0010_live_painting.sql`；部署读取 `is_live` 的 Worker 前必须先运行远端 migration。线上 `accounts` 无 email 列（auth 走 `auth_identities`+`auth_otp_codes`）——worker 用的正是 `auth_identities`，行为一致。
