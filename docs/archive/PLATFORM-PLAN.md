# 多平台与收费计划

> **已归档 2026-07-20** — 多平台矩阵已被 2026-07-20 的发行决定取代:只做 itch 免费引流 → Apple 付费 App;CrazyGames/Poki 不上架(不要广告);Discord/Facebook/Steam 未列入计划。现行计划见 ../MONETIZATION-BUILD.md;嵌入平台的 API 会话适配要点保留在 ../ARCHITECTURE.md。

## 结论

“同一款网页游戏发布到多个入口”是优势，但不应在验证前同时维护四套上线流程。正确结构是一个共享游戏客户端、一个 API、一个 entitlement 模型，加薄的平台适配器。

推荐顺序：

1. **直接网页/PWA**：最快验证手机分享闭环，也是所有平台的基础构建。
2. **Discord Activity**：当核心留存成立后验证群体传播和原生一次性购买。
3. **itch.io 页面**：用于独立游戏社区曝光、试玩和支持性购买实验。
4. **CrazyGames 或 Poki 二选一试投**：在有数据后测试门户流量，不要同时接入。
5. **Facebook Instant Games**：只在取得 Approved Partner/提交资格并理解审核要求后评估，不把它当作近期自助发行渠道。

平台数量不是核心指标。每加一个平台，都必须证明它能带来新增 Hider，而不仅是一次性 Seeker 流量。

## 统一服务器还是分平台服务器

默认使用统一 Worker API 和独立 D1：

- 挑战链接可以从一个平台发到另一个平台并在普通浏览器打开。
- 房间目录、TTL、举报和内容版本只有一份。
- 匿名挑战不绑定平台身份。
- 购买凭证由各平台适配器验证，再映射为统一 entitlement。

分离的是身份和支付凭证，不是游戏服务器。只有某个平台合同明确要求数据隔离、特定地区存储或独立构建时，才增加独立部署。

## 平台矩阵

| 平台 | 主要价值 | 收费路径 | 主要风险 | 当前决定 |
|---|---|---|---|---|
| 直接网页/PWA | 分享链接、手机、完全控制产品 | 后续接网页一次性购买 | 自带曝光弱，需要分享循环 | MVP 首发 |
| Discord Activity | 群聊/频道天然多人，桌面、网页和手机 iframe | Discord durable SKU / entitlement | 资格、审核、SDK、13+ 边界 | 第二阶段 |
| itch.io | 独立游戏用户和产品页 | HTML5 原生付款当前主要是 donation；付费访问需用 Downloadable 等替代结构 | 不适合作为统一网页 IAP 的唯一商店 | 页面与试玩实验 |
| CrazyGames | 大型网页门户流量 | 以该平台当前 SDK、邀请和合同为准 | 审核、广告导向、跨站分享限制 | 有留存数据后申请 |
| Poki | 大型网页门户流量 | 以合同为准 | 独家条款和外链/跨平台限制可能与多平台策略冲突 | 只考虑非独家条款 |
| Facebook Instant Games | Feed/Messenger 中的 HTML5 传播 | 以当前 Meta 资格、审核和支付政策为准 | 仅 Approved Partners 可提交，且新游戏仍需质量审核 | 最后评估 |
| Steam | 购买与 PC 游戏库 | Steam DLC/IAP/一次购买 | 打包、审核、客户端购买摩擦，对手机分享不自然 | 暂缓 |

平台规则会变化，提交前必须逐项复核开发者条款；本文不是对未来审批结果的保证。

## 统一 Game Stage，而不是纯 Canvas 页面

下一项客户端里程碑是把创建和寻找流程整理为一个**全屏、响应式 Game Stage**。它在视觉上应像一个完整的 Canvas 游戏，但实现上保持混合结构：

- 房间、角色、移动、碰撞、绘画和 Close Look 图像由一个或多个 Canvas 渲染。
- 操作按钮、状态、提示、表单、分享、登录、购买、举报、Turnstile 和可访问性文本继续使用 HTML/DOM，并作为 stage 内 overlay 或 panel 呈现。
- 不要求把现有 main、paint、inspection Canvas 合并成一个物理 Canvas；统一的是 viewport、缩放和视觉边界。
- 游戏世界坐标保持稳定，viewport 变化只影响显示缩放和布局，不能改变碰撞、检查命中或 challenge 坐标。
- 直接网页可以保留 landing、Explore 和 admin 页面；平台构建应使用最小 shell，启动后直接进入同一个 Game Stage。
- 键盘、触摸、摇杆、系统分享、屏幕阅读器和 `prefers-reduced-motion` 必须继续工作。

这比“所有 UI 都画进 Canvas”更容易跨平台：平台 SDK、购买弹窗、OAuth、Turnstile、举报和多语言文本都需要可交互 DOM。平台只应替换 stage 外围能力，不应分叉游戏机制。

### Stage 适配原则

- 当前 960×640 逻辑游戏世界不因页面尺寸变化而改写。
- Stage 填满可用 viewport，并尊重手机 safe-area；逻辑画面按比例 `contain`，多余区域使用与房间一致的背景/装饰承接，不裁掉可玩区域。
- HUD 和触屏控制可按窄屏重排，但必须留在同一个视觉 stage 内，不能造成整页横向滚动。
- iframe/platform build 必须能在尺寸变化、失焦、暂停和恢复后重新布局。
- 平台若要求特定外部比例（例如门户的 16:9 容器），由 shell 提供容器和安全区域，不修改游戏世界比例或命中计算。

### 当前实现与平台构建之间仍缺的一层

把页面变成 Game Stage 并不自动让当前构建可以上传到所有平台。当前客户端使用同源 `/api`，匿名会话使用 `SameSite=Lax` cookie；上传到第三方 iframe/CDN 后，API origin、cookie、Turnstile hostname 和平台身份都会变化。

在第二个平台真正接入前增加：

- `PlatformAdapter`：`init`、locale、lifecycle、share、identity、commerce capabilities。
- 可配置 `API_BASE_URL` 和平台 build target，例如 `web`、`discord`、`itch`、`crazygames`、`poki`、`facebook`。
- 受 allowlist 约束的 CORS，以及适合嵌入环境的短期 bearer session/已验证平台 identity exchange；不能依赖第三方 cookie。
- 每个平台独立验证支付凭证，再映射到统一内部 entitlement。
- 平台专用 Turnstile/滥用防护策略；不能假设官网 hostname 的 widget 能直接搬进所有 iframe。

后端仍默认只有一个 Worker API 和一个 D1，不为每个平台复制服务器或数据库。

## 游戏内收费怎么设计

可以在游戏内展示房间商店，但结账方式按入口变化：

- 直接网页：跳转或嵌入合规的成人购买流程，服务端 webhook 授权。
- Discord：使用 Discord SKU 和 Entitlement API，并由 Worker 通过服务端 API复核。
- itch.io：先把 HTML5 版本当免费试玩/捐赠入口；如果使用购买密钥或可下载 Museum Pass，需要单独验证购买并遵循 itch.io 规则。
- CrazyGames/Poki：只有平台明确允许且已开通对应能力时才显示购买按钮。

不要在不支持 IAP 的平台偷偷打开外部结账。客户端通过 `commerceCapabilities` 决定展示什么，核心游戏不能假设支付一定可用。

## 推荐商品

### 免费

- 一个完整艺术房间。
- 所有收到的邀请，无论房间是否高级。
- 基础创意画笔。

### 一次性耐久购买

- 单个艺术房间。
- Museum Pass 房间组合。

### 暂不使用

- 消耗币、抽奖、能量、复活、加时。
- Seeker 入场费。
- 订阅，除非将来持续更新内容且用户明确需要。

购买主体是 Hider/创作者。付费房间的传播价值来自“一个人购买，许多人免费参与”，不是向每个朋友重复收费。

## 跨平台购买现实

不应承诺所有商店购买天然跨平台。每个平台可能限制身份、退款、SKU 和跨平台权益。

先采取保守规则：

- 同一平台、同一身份可恢复购买。
- 邀请挑战始终跨平台免费可玩。
- 是否允许网页购买在 Discord 或其他门户中创建高级挑战，要在合同和平台政策确认后决定。
- 内部 entitlement 可以表示多个 provider，但不伪造或绕过平台购买要求。

这保留了统一后端的技术能力，同时不提前作出违反商店规则的商业承诺。

## 上线闸门

每个平台只有满足以下条件才接入：

- 手机直接网页的发布、打开、开始和完成漏斗已经稳定。
- 平台带来的目标用户与产品年龄边界一致。
- 已理解支付、分成、退款、税务、数据和独家条款。
- 适配工作不会分叉游戏核心。
- 能记录该平台带来的 Hider、挑战和付费转化。

## 当前官方参考

- [Discord Activities 是桌面、手机和网页中的 iframe Web 应用](https://docs.discord.com/developers/activities/how-activities-work)
- [Discord Premium Apps 支持一次性 durable SKU 和 entitlement](https://docs.discord.com/developers/platform/app-monetization)
- [Discord Activity IAP 的服务端验证建议](https://docs.discord.com/developers/monetization/implementing-iap-for-activities)
- [itch.io HTML5 上传与当前付款限制](https://itch.io/docs/creators/html5)
- [CrazyGames HTML5 技术要求](https://docs.crazygames.com/requirements/technical/)
- [Poki 的响应式、外部请求与 SDK 要求](https://sdk.poki.com/new-requirements)
- [Meta Instant Games 当前资格与 HTML5 入口](https://developers.facebook.com/docs/games/build/instant-games/)
