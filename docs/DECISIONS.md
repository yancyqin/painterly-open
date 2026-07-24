# 已作出的决策

这些决策用于防止实现过程中悄悄回到原来的产品假设。若要改变，先记录原因和验证证据。

## D-001：建立独立商业仓库

**状态：接受**

Painterly Chameleon 是单一商业游戏，与 Snake Lab 教育门户分离。这样可以独立部署、定价、合规审查和平台适配，也不会把 Academy 的门户、Code Brush 或课程身份带进商业客户端。

初次迁移后，适合 Academy 的艺术内容通过显式导出同步回 Snake Lab。

## D-002：异步一对多是默认玩法

**状态：接受**

一个 Hider 创建挑战，多名 Seeker 在 24 小时内独立游玩。它不依赖同时在线，适合短信、家庭群、课堂和手机链接。

实时双人或多人模式不是 MVP 的前提。

## D-003：不使用 WebSocket

**状态：接受**

不可变挑战、独立尝试和结果查询都可通过 HTTP 完成。增加 WebSocket 只有在已经验证的实时 Party 模式中才合理。

## D-004：Cloudflare Worker + 独立 D1

**状态：接受用于 MVP**

Lucas Academy 已使用 Cloudflare，异步架构又适合 Worker 和 D1。新建独立数据库能共享账户免费额度而不共享 schema 和删除风险。

Render 保留为未来实时服务的备选，不作为 MVP 固定成本。

## D-005：挑战发布后 24 小时失效

**状态：接受**

API 读取时硬过期，Cron 每小时清理。草稿在客户端，购买权益持久保存。不能把购买和挑战放在同一个 TTL 规则里。

## D-006：Hider 付费，受邀 Seeker 免费

**状态：接受；具体模型由 D-014 定稿**

免费房间完整可玩。Hider 付费解锁高级房间并用它创建挑战；邀请链接授予所有 Seeker 临时游玩权限。这样付费不会阻塞传播。

## D-007：MVP 不使用代币经济

**状态：接受**

房间使用 durable entitlement。画笔先免费、房间自带或通过游玩成就解锁。代币会增加退款、余额、儿童购买和跨平台同步成本，当前没有验证价值。

## D-008：多平台共用后端，平台能力适配

**状态：接受；平台名单已被 D-015 收窄**

各发行入口不各建一套数据库。客户端共享核心，平台适配器负责身份、支付、分享和 iframe 生命周期。

不承诺所有平台的购买跨平台通用；要逐个平台遵守政策。

## D-009：艺术家名称和素材逐项清权

**状态：接受**

公版底层作品、现代扫描使用条款、商标/背书暗示和新创作表达是不同问题。没有完整 provenance 和发布前复核的房间不能收费。

## D-010：首个独立客户端使用 Canvas 异步切片

**状态：接受用于验证**

首个迁移不复用 Snake Lab 的 Colyseus `ChameleonScene`，因为它把实时移动、门户框架和服务器阶段机耦合在一起。独立客户端提取绘画与房间内容，用响应式 Canvas 渲染不可变挑战。

这是有意的产品机制变化，不是临时删功能：Hider 无倒计时；多个 Seeker 独立点击 Start 后计时；一个 challenge 只存压缩角色和小型坐标元数据。未来若加入实时 Party 模式，必须作为单独模式和决策，不得破坏异步链接玩法。

## D-011：使用 hybrid Game Stage，不做纯 Canvas UI

**状态：已被实现演进部分取代（2026-07-19）**

原决定：Canvas 负责画面，DOM 负责所有按钮/文字。实际实现走得更远——**创建与寻找两个 play 视图的 HUD、joystick、Close Look、按钮和覆盖层全部由 GameCanvas 直接绘制**（"everything on canvas"），效果更好并被 owner 采纳。仍保留 DOM 的部分：绘画工作室、举报面板、登录/分享/解锁弹窗、语言选择器、Turnstile 和可访问性文本。960×640 逻辑世界与 challenge 坐标不因 viewport 改变的原则不变。

## D-012：消费者界面采用 action-first 最小文案

**状态：接受用于验证**

创建和寻找页面不再使用网页式标题、副标题和玩法说明；品牌标题进入 Game Stage 左上，不再保留独立网站页头或重复的 Explore 导航。`hide-and-seek!` 只作为 Canvas 内的轻量标识，Paint、Mix、Start、Close Look、Make Link 与 Explore 依靠控件名称和视觉状态完成引导。必要的错误、倒计时、举报结果和可访问性提示仍保留，但不占据主视觉。

Explore 同样不做落地页叙事，只保留创建入口、Sneaky/New/Random 三个短分类和可直接进入的挑战按钮。关于未来房间、账户和收费的说明继续留在产品计划中，不放进当前验证界面。

## D-013：用固定两词英文名支持安全搜索

**状态：接受用于验证**

每个挑战获得一个由审核过的儿童友好形容词和名词组成的英文名。Hider 可以换一个组合，但不能输入或发布任意文字。Explore 使用独立规范化索引做名称前缀搜索，并继续执行公开状态、moderation 和 24 小时 TTL 过滤。

英文名在所有 locale 中保持一致，便于家庭群、课堂和跨平台口头分享。名称不要求唯一；相同名称由艺术房间缩略图和剩余时间区分。详细理由和影响见 [`decisions/0001-curated-room-names.md`](decisions/0001-curated-room-names.md)。

## D-014：收费模型定稿——前三层免费，$2.99 一次解锁全部

**状态：接受（2026-07-20 定稿；2026-07-21 价格修订为 $2.99）**

- **免费**：`van-gogh-house`（匿名）、`monet-garden-house`、`outdoor-masters-journey`（后两个免费但需登录）。收到的邀请永远免费；来找（seek）在所有房间永远免费。
- **付费**：其余所有房间（含将来新增）用**一次性 $2.99** 的 `bundle:all-houses` 权益一起解锁，只解锁"来藏（hide/创建）"。不按房间单卖，不订阅，不代币。
- 网页走 Stripe 托管结账（点锁着的房 → 应用内确认弹窗 → Stripe）；权益写在 owner 的 `entitlements` 表（migration 0005），webhook 验签授予、退款撤销。
- 争取 Stripe 微支付费率（账号级设置，代码无需改动）。
- 取代 PRODUCT-PLAN 中按房间单卖 / Museum Pass 的早期实验方案。

## D-015：发行顺序——itch 免费引流 → Apple 付费 App；不上广告门户

**状态：接受（2026-07-20，owner 定稿）**

1. **先 itch.io**：上架**免费网页版**做曝光/试玩，引流到 `pc.lucasacademy.org`（itch 不做付费墙——它没有游戏内单项解锁能力，iframe 里第三方 cookie 和 Stripe 跳转也走不通）。
2. **后 Apple App Store**：**$2.99 一次性买断的付费 App，无内购（无 IAP）**。买 App 即含全部房间；实现时 App 内不出现任何购买流程（也因此避开 IAP 审核与家长门的内购要求，但仍守儿童品类其余规则）。iOS 端如何把"已购 App"映射到服务端权益（收据换 `bundle:all-houses`，或 iOS 构建直接视为已解锁）在开工时定。
3. **不上 CrazyGames、不上 Poki**（owner 不要广告驱动的门户）；Facebook Instant/Steam/Discord 均不在当前计划。

每个入口只有一套收费真相：网页 Stripe + Apple 付费 App，同一个内部权益模型。

## D-016：Live Painting 使用固定审定强度

**状态：接受（2026-07-20）；2026-07-21 修订——Hider Studio 增加 quiet→live force 幅度滑杆**

- **2026-07-21 修订（滑杆语义定稿）**：Hider Studio 的 Live Brush 面板共三个滑杆——**size** = 笔触范围；**flow** = 颜料浓度/密度（原始语义：透明度系数 + dab 间距）；**force（quiet → live）= 变化速率**（动画时钟倍率：10 ≈ 0.35×，默认 68 = 审定节奏 1×，100 = 2×），只作用于变色龙，房间背景仍用固定审定节奏。force 取值随挑战保存为 `livePainting.strength`（可选整数 10–100，缺省按 68 处理，旧挑战不受影响）。
- **2026-07-21 修订（White Mist 取消）**：`white-mist` 笔刷退役——效果特殊且做不对，从 Studio、笔刷 id 白名单和 API 校验中移除；已存挑战中的旧 white-mist marks 在客户端 normalize 时回落为 liquid-color。Live Brush 只剩 Blue Current、Liquid Color、Graphite Whisper 三种。

- 房间背景的 Live force、强度和构图由 Art Lab 编辑器预先审定，随静态 `.livepaint.json` 资产发布，仍不接受玩家调节；quiet→live 滑杆只调节变色龙身上 Live Brush 的变化速率。
- **6A–6C 临时作者路径（2026-07-21）**：在 Art Lab 导出器完成前，三间房使用固定、声明式的内置 preset。为避免 donor 与不同 study 的细微几何差产生重影，6A 原 v1/v2 文件内容互换，使三间房 Live 底层统一固定为 v1；普通非 Live 模式仍可选择 v1/v2/v3。正式 donor 只使用 owner 最新提供的 `2.jpg`（6A）、`1.jpg`（6B）、`6cnew.jpg`（6C），早期 donor 和 ImageGen 6B 实验全部退出运行时。白色与近白色像素必须在全图严格变成 alpha 0，白边外保留纯透明 gutter；禁止白色、近白色或白雾在任何 opacity 下参与动画层。每个白色连通区必须建立独立的边界距离场；donor 的纯 alpha 烟圈从整条真实白边（distance 0→1）向外传播，禁止从白区中心缩放图章。6C 必须直接采用 owner 在 donor 中画出的 7 个独立白色判定区域，不再聚类、合并或重切。烟圈使用宽阔双边羽化，经过区域重新透明，opacity 先升后降并最终消失；各周期相对前一版统一减速 20%，禁止全屏网格和同步呼吸。6A 另保留 Blue Current 与地面 Graphite Whisper；6B/6C 省略这两层。原白雾资产退出全部正式运行时。该 preset 不接受 challenge 代码/项目/mask，不读取玩家强度。
- Hider Studio 在 Live 开启时才显示独立的 **Live Brush** 标签；笔刷菜单按艺术房间拥有。Van Gogh 第一层由 owner 选定 **Firefly / Growth / Color Liquify Splash**，第六层 Unfinished Morning 保留 **Blue Current / Liquid Color / Graphite Whisper**。已经发布的 id 继续被 API 与 renderer 接受，房间换菜单不能让旧 challenge 作废。
- Live Brush 是局部画笔而非整只龙的滤镜：每一笔只保存受控 brush id、标准化坐标、size、flow、seed 与 angle；挑战最多 320 笔，不保存 strength。背景与变色龙共用游戏内审定的固定强度。Studio 必须提供 Size、Flow、Undo、Clear。
- Live Brush 只提供运动，颜色始终取自已经完成的普通绘画；White/Blue/Graphite 等名称不能向变色龙注入固有颜色。
- Live Brush 只描述 force，不拥有颜色。运行时按 Art Lab `rebuildPhoto()` 的语义，在每个 mark 落点采样已经完成的变色龙 paint 底色，再让该颜色运动；不同 force 不得偷偷混入蓝色、石墨色或花瓣色。Paint 与 Live 两个标签都显示与画布缩放一致的真实尺寸圆形 brush cursor。
- 背景与角色必须调用 `livePainting.ts` 的同一套审定 timing state，禁止再次复制早期 demo 参数。Liquid Color 使用 donor 距离波节奏的局部 annulus；Blue Current 使用正式 current 节奏；Graphite 使用固定矢量的逐步绘制/擦除。Van Gogh 的 Firefly / Growth / Splash 只采样龙已经完成的颜料，prepare 时把所有 mark（Splash 含四档 softness）烘焙进同一张有界 atlas，逐帧禁止创建 gradient 或逐 mark canvas。
- 普通 Paint 继续保留上半身外轮廓约 1px 的保护；Live 开启后这是全身动态绘画模式，取消该 1px 保护并显示完整的用户 paint。关闭 Live 后恢复普通保护规则。
- D1 另存 `is_live` 供 Lobby、搜索和账户列表快速显示 **Live Painting** 标识。挑战可以携带上述有界的声明式 marks，但不能携带 mask、Art Lab 项目文件、Function Brush 源码或任何可执行代码。
- 尚未经过编辑器审定的背景实验不得进入正式房间；有审定资产的艺术房间和对应挑战都必须在缩略图上显示小型 **Live Painting** 标识。
- **1A Sunflower Parlor 首个 `.lpp` 正式导入（2026-07-21）**：owner 在 Lucas Visual Art Lab 完成的 `1A.lpp` 是可继续编辑的审计源；构建脚本只接受 960×640、内嵌 shell 与游戏 v6c 像素哈希完全一致、并且每个 Function Brush revision 的完整 SHA-256 都在显式白名单中的项目。浏览器不解压 `.lpp`、不读取 Function Brush source，也不执行动态代码；只加载生成的 626 个声明式 marks、5 个液化 mask 和对应的静态 TypeScript adapter。Live 开启时 1A 固定使用与项目匹配的 v6c（surface C）作为底图，普通模式仍保留 A/B/C 选择。
- **curated 手机性能结论（2026-07-23，取代 2026-07-22 的 0.5×/30Hz/freeze 结论）**：真机 additive A/B 证明 canvas/mark 数、backing resolution 和 15/30Hz 都不是单独根因；618 flat 与 204 soft glow 丝滑、618 per-frame glow 卡、同样 618 glow 进入一张 shared atlas 后丝滑，完整 1A 与扩展 atlas 后的 1C 也通过。正式 renderer 因而保持 Live 移动，不再把降 resolution、冻结 underlay/avatar 或 frame cap 当作导入硬约束；大量静态颜色 soft marks 必须进入一张 bounded atlas，静态房间层与 actor/HUD 分开复用。
- **1A/1B/1C owner-final 导入（2026-07-23）**：三个 960×640 archive 与对应 game shell byte-identical，final runtime stats 为 1A 626 marks/17 strokes/5 warps、1B 1,426/91/0、1C 553/15/2。1B 的 12 个 Color Liquify revisions 在 archived source 中含 `move()` 时 `photo()`，但 `PATH_COLOR_MIX=0`，runtime 明确化简为 prepare-time birth pigment；Stars/Galaxy/Splash 共用 atlas。1C 的 Growth/Firefly/Twinkle 共用同一 atlas，两条 Liquid warp 共用一张 prepare-time blur source。所有 revisions 仍按完整 SHA-256 审批，Function Brush source 不进 browser。
- **1B owner 手机验收与 6A Liquid 定位（2026-07-23）**：final 1B 的 BASE / SPLASH / STARS / GALAXY / FULL ATLAS 五档全部丝滑，shared-atlas production 路径通过。6A avatar 在 20 Liquid marks 下丝滑，高数量 `RE-LAY ONLY` 与 `FULL` 卡；原 `EROSION ONLY` 因重叠 marks 把龙完全擦空而没有形成有效性能结论。下一轮用不计时的淡参考龙恢复 Erosion 可见性，并用 `TINT RE-LAY` 区分 bounded `source-in` 本身与逐 mark transformed full-source pigment draw 的成本。
- **1B owner correction 导入（2026-07-23）**：新 archive 保持同一 960×640 v6a shell，把 runtime 更新为 1,233 marks/88 strokes/0 warps。旧 Galaxy 被 184 + 496 个 directional Color Liquify Breakout streaks 替换；两个新 Function Brush revision 按完整 SHA-256 分别映射到 SIZE 11/7 的静态 adapter，并与 Splash/Twinkle 共用一张 atlas。旧 1B fixture 独立保留，correction 的视觉和手机流畅度等待 owner QA。
- **1B Curve Current 导入及 owner 通过（2026-07-24）**：owner archive `1b-fff.lpp` 与同一 v6a shell byte-identical，runtime 为 4,910 marks/227 strokes/0 warps。三个新完整 SHA-256 revisions 均是 FLOW 3 的 Curve Current（SIZE 8/16/9）；browser 不执行 source，而是在 prepare 阶段从每组三个可见 marks 重建路径并预计算起点/顺序/侧距，逐帧只移动同一 shared atlas 中的色片。由于 archive 没保留 `EVERY=2` 跳过的手势点，这是可见 mark cohorts 间的折线近似。只给 1B 精确的 4,910 marks/3 MB room-scoped 上限，并在 `live-1b` 增加 CURVE CURRENT additive tab；owner 真机确认视觉没有问题且移动很流畅，production approval 通过。
- **1B Source Cover 导入，等待 owner 闸门（2026-07-24）**：owner archive `1b-ffff.lpp` 继续与 v6a shell byte-identical，runtime 更新为 6,140 marks/112 strokes/0 warps。三个新完整 revision 是 FLOW 2/3/4 的 Curve Current + Source Cover，共含 1,691 个静态 cover 与 3,896 个移动 source-color fragments；prepare 直接用 cohort 首枚 cover 的真实手势点重建路径并预计算 role/起点/顺序/侧距，全部 soft geometry 进入同一 2,688×2,688 atlas。逐帧不读像素、不建 gradient/canvas。只给 1B 精确的 6,140 marks/4 MB room-scoped 上限；`live-1b` 用 SOURCE COVER / MOVING CURRENT 分档，视觉和手机移动流畅度等待 owner 明确通过。上一版已通过的 4,910-mark archive 保存在 immutable fixture。
- **冷房间 loader 归属（2026-07-24）**：从 1A 穿门到 lazy-loaded 1B 时，destination room 先同步进入 immediate loading 并显示现有 painting-chameleon overlay，下一帧才允许 1B JSON parse、source sampling 和 atlas prepare。这样等待明确属于 1B，不再让 1A 最后一帧承担同步 prepare；普通 cached-room readiness 仍保留 150ms anti-flash delay。
- **Portrait Hider Done 位置（2026-07-24）**：移动端底部控制行只保留左侧 joystick 与右侧绘画板；Studio 打开后出现的 Done 改为居中放在 3:2 房间画面正下方，不再占用两项主要控制之间的横向通道。桌面 split-action 布局不变。
- **Hider Canvas 控件语义（2026-07-23）**：Live 不再借用调色板图标，改用 6A 已采用的 pulse dot + 本地化 Live 标签，作为与 Lobby 同宽同高的第二行按钮。Paint 成为右下角较大的彩色调色板图标按钮；两个动作的图形与点击区域不再混用。
- **6A Liquid 第二轮与 Seeker Close Look（2026-07-23）**：owner 真机确认高 mark 数下 `TINT RE-LAY` 和带参考龙的 `EROSION ONLY` 都卡，排除“只有 transformed full-source pigment draw 才卡”；两档共同的逐 mark organic ring mask、scratch composite 和 bounded blit 成为下一轮目标。Close Look 关闭后 Seeker 仍卡，证明它不是主因；恢复 Close Look，并恢复 `Space` / `R` inspect 快捷键，快捷键提示与 zoom card 放在一起。
- **6A Liquid 第三轮（2026-07-23）**：owner 真机确认 320 marks 下 `BATCH EROSION` 与 `BATCH TINT` 均丝滑，锁定原逐 mark ring-mask/scratch composite/bounded blit 为瓶颈；共享预烘焙 ring atlas 与单帧合并 mask 路径通过。Liquid Bench 继续故意冻结 6A 房间动画以隔离 avatar renderer。production `FULL` 暂不替换，下一闸门为共享 mask + 单次自身颜料 re-lay 的 `BATCH FULL`。
- **6A Liquid production promotion（2026-07-23）**：owner 真机确认 `BATCH FULL` 的拖动流畅度与 Liquid 外观均正常。production `FULL` 正式改为共享 ring atlas、单帧合并 mask、一次 erosion 与一次自身颜料 re-lay；旧逐 mark 完整路径只保留为 6A `LEGACY FULL` 诊断对照，不再进入游戏或 Studio。
- **6A room movement 重新打开（2026-07-23）**：此前 Liquid Bench 冻结了 room animation，因此只完成 avatar renderer 验收，不能代表正式第六层房间。owner 后续确认 `ROOM FROZEN` 与 `CACHED MASK` 丝滑，主线程 `ROOM LIVE 30HZ` 微卡，锁定 `UnfinishedMorningLiveRoomRenderer` 的 480×320 distance-mask 像素重建。下一闸门为完全相同视觉/30Hz cadence 的 `WORKER MASK 30HZ`；通过前不得提升为 production。
- **6A room mask worker production promotion（2026-07-23）**：owner 确认 `WORKER MASK 30HZ`“非常丝滑”。`UnfinishedMorningLiveRoomRenderer` 默认把完全相同的 distance field/noise/wave mask 像素循环移到 module worker，并以 `ImageBitmap` 回贴；主 canvas、room cache、视觉参数和 30Hz cadence 不变。Worker 不可用或加载失败自动回退 sync；`live-6a` 对照页显式以 sync 开始，保留历史 A/B。
- **Hider walking avatar Live 复测（2026-07-23）**：第六层正式 Worker 复测通过后，移除“走路时把 Hider 龙切回静态画”的旧性能保护。curated avatar atlas、Liquid batched mask 与 room worker 已分别通过，Hider/Seeker 移动现在都保持 avatar Live；Studio 手指按住期间的 preview draw-calm 属另一条路径，继续保留。

## D-017：首个稳定版本为 1.0.0

**状态：接受（2026-07-24，owner 定稿）**

Painterly Chameleon 的首个稳定网页版本标记为 `1.0.0`。本版本包含异步 Hide/Seek、房间分享、付费权益、默认 Live Painting、移动端渲染优化，以及经白名单和性能契约导入的 1A/1B/1C curated 项目。后续行为或数据格式不兼容的改动必须明确记录迁移方案。
