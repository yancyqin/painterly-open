# Painterly Chameleon

Painterly Chameleon 是从 Snake Lab 的 Chameleon 原型拆出的独立商业游戏仓库。

> 当前状态：可玩的异步验证版。包含免费的 Van Gogh House、登录后免费的 Monet Garden House、Outdoor Masters Journey、Color Rebirth 与 The Tide Dreams in Starlight 五层内容，以及 Hider 绘画、分享、Seeker 寻找、16 种语言、Worker API、专用 D1 和 24 小时 TTL；尚未接入支付，也尚未完成正式商业清权。

验证入口：<https://pc.lucasacademy.org>

## 已确定的产品方向

- 一个 Hider 创作伪装挑战，通过链接发给多人。
- 多个 Seeker 可在不同时间独立游玩，不要求双方同时在线。
- Hider 创作时不倒计时；Seeker 加载完成并点击“开始”后才倒计时。
- Hider 和 Seeker 都可用键盘或触屏摇杆连续行走；房间切换和 inspection 放大完全在本地完成，不增加服务器连接。
- 每个挑战发布 24 小时后失效并删除。
- 24 小时挑战默认加入 Explore，Hider 可取消勾选改为私人链接；每个挑战使用固定儿童友好词库生成两词英文房间名，可按名称前缀搜索，但不接受自由文本。
- Explore 列表和名称搜索都只返回轻量元数据，并在 Worker 边缘缓存 60 秒，减少重复 D1 读取。
- 匿名发布和举报按需执行 Cloudflare Turnstile；普通游玩、打开朋友链接和浏览 Explore 不加载 widget。
- Worker 为匿名访问签发 24 小时 HttpOnly session cookie，并以服务端验证过的 session subject 做发布、举报和结果提交限流。
- `/admin` 提供不公开链接的最小举报队列，可确认隐藏或恢复到 Explore；管理员操作保留 30 天后自动删除。
- Van Gogh 可匿名创作；Monet、Outdoor、Color Rebirth 与 The Tide Dreams in Starlight 登录后免费创作。未来收费房间由 Hider entitlement 授权，受邀 Seeker 始终免费游玩。
- Explore 发起创作和非首层房间创作使用成人邮箱一次性验证码；内部 `account_id` 与邮箱/未来平台身份分离，匿名 Seeker 不登录。
- 不放广告，不在 MVP 中设计金币、代币或消耗型内购。
- 不包含 Snake Lab 的 Code Brush；只保留少量经过设计的创意画笔。
- 默认异步玩法只用 HTTP，不需要 WebSocket。

`Painterly Chameleon` 是工作名，正式发布前仍需做商标、应用商店名称和竞品混淆检查。

## 推荐的 MVP 基础设施

```text
手机 / 桌面网页 / 平台 iframe
             │ HTTPS
             ▼
      Cloudflare Worker
        ├── /api/* → D1：挑战与尝试
        └── Worker Assets/CDN：版本化房间与游戏客户端
```

推荐在 Lucas Academy 所在的 Cloudflare 账户下，新建一个独立的 D1 数据库，而不是复用 Academy 的现有数据库。这样可以共享账户和免费额度，但隔离 schema、迁移、备份恢复和删除风险。

当前独立资源：

- Worker：`painterly-chameleon`
- 域名：`pc.lucasacademy.org`
- API：`pc.lucasacademy.org/api/*`
- D1：`painterly-chameleon-prod`

Render 暂时不需要。只有未来加入真正的实时 Party 模式、长连接房间服务器或 Worker 不适合的后台任务时，再重新评估 Render。

## 文档索引

现行文档（7 篇）：

- [已作出的决策](docs/DECISIONS.md) — 决策日志；收费模型 D-014、发行顺序 D-015 在此
- [收费与发行（现行计划）](docs/MONETIZATION-BUILD.md) — $2.99 一次解锁、Stripe 现状、itch→Apple 顺序、待办
- [itch.io 免费版页面](docs/ITCH-PAGE.md) — 下一步的上架文案与素材清单
- [架构与托管方案](docs/ARCHITECTURE.md) — Worker/D1/画布客户端/API/i18n 技术现状
- [D1 数据与 24 小时生命周期](docs/DATA-LIFECYCLE.md) — TTL、限流、清理、容量
- [艺术版权、儿童和 UGC 合规](docs/COMPLIANCE.md) — 现状 + 新房间过审闸门 + 收费前合规件
- [从 Snake Lab 的迁移记录](docs/SNAKE-LAB-MIGRATION.md) — 各房间来源提交台账（只增不改）

另：[可搜索房间名决策](docs/decisions/0001-curated-room-names.md) · [艺术房间内容规范](content/art-houses/README.md)

已完成/被取代的计划移入 [docs/archive/](docs/archive/)（产品验证计划、多平台矩阵、实现计划、公开挑战计划、i18n 计划、版权审查执行记录），每篇头部注明归档原因。

## 与 Snake Lab 的边界

Snake Lab 继续是教育门户和实验环境；本仓库是单一游戏的商业产品源。

当前垂直切片已从 Snake Lab 提取房间构图、角色姿态、绘画合成、创意画笔算法，以及 Van Gogh、Monet、Outdoor、Color Rebirth 与 The Tide Dreams in Starlight 运行时素材。本仓库没有引入 Snake Lab 包或运行时路径；Code Brush、教育门户、Colyseus、WebSocket 房间、网络移动预测、编辑器和源模型都被排除。现在的行走、房门切换、矩形/多边形本地碰撞和 inspection 放大都是轻量客户端功能。

从这次迁移开始，商业版本的改动应先发生在本仓库，再通过未来的显式导出步骤同步适合教育门户的内容，避免两边手工分叉。

## 本地运行

```bash
npm install
npm run db:migrate:local
npm run dev
```

完整检查：`npm run check`。

本地 Turnstile 自动使用 Cloudflare 官方测试 key；本地管理员 token 是 `painterly-chameleon-local-admin`。生产环境的 `ADMIN_TOKEN`、`SESSION_SIGNING_KEY` 和 `TURNSTILE_SECRET_KEY` 只存在 Worker secrets 中。生产管理员 token 另存于 macOS Keychain，可用以下命令读取后粘贴到 `https://pc.lucasacademy.org/admin`：

```bash
security find-generic-password -a yancyqin -s painterly-chameleon-admin -w
```

## 交付顺序

1. 本地验证真实 Van Gogh House 的手机创建、分享和一对多闭环。
2. 完成逐项资产 provenance、商标/IP 和 UGC 闸门；未清权前只作为受控 playtest。
3. 经 owner 明确批准后部署新客户端，验证分享率、开始率和完成率。
4. 加入速率限制、举报和最小匿名指标。
5. 指标成立后再接房间购买和第二个平台适配器。

## 当前明确不做

- 不修改 `/Users/yqin/repo/playground/snake-lab`。
- 不创建 Render、Stripe、Discord 或其他平台资源。
- GitHub 远程仓库是 private：`yancyqin/painterly`。
- 不在没有 owner 明确批准时部署本次迁移版本。
- 没有选定最终价格，也没有假设每个平台都允许相同的支付方式。
