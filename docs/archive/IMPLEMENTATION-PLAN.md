# 可玩异步垂直切片计划

> **已归档 2026-07-20** — 垂直切片计划已全部完成(Game Stage 进一步演进为全画布 play UI;Stripe 已接;测试 27→40)。现状见 ../ARCHITECTURE.md。

## 当前结论

基础色块验证层已被真实游戏切片替换。当前本地版本验证的是：

1. Hider 用键盘或画布下方的触屏摇杆在 Van Gogh House 中连续行走，并通过门口切换三间房。
2. Hider 用 6 种内建创意画笔和房间色板绘制三种姿态，不使用 Code Brush。
3. Hider 行走到最终藏身点；画布下方的 Close Look 放大区跟随角色，创作阶段没有时间限制。
4. 客户端把透明角色压成 128×128 WebP/PNG，并发布 24 小时 challenge。
5. 任意数量 Seeker 可在不同时间打开同一链接；每人点击 Start 后独立计时、独立行走和寻找。
6. Hider 用本机保存的管理 key 查看匿名人数、找到人数和平均时间。

这仍是 playtest，不是已清权、已收费或已完成平台发行的版本。

## 已固定地址

```text
Web: https://pc.lucasacademy.org/
API: https://pc.lucasacademy.org/api/*
Share: https://pc.lucasacademy.org/?c=<token>
```

本次代码已推送到 private GitHub，但在 owner 明确批准前不把新客户端部署到上述公开地址。

## 运行时边界

```text
Vite/TypeScript client
  ├── Canvas room renderer
  ├── local keyboard/joystick movement + JSON portal transitions
  ├── below-canvas inspection magnifier
  ├── Hider PaintStudio (manual brushes only)
  ├── version 1 challenge codec
  └── responsive direct-web shell
             │ HTTPS
Cloudflare Worker
  ├── version/size validation
  ├── token and Hider-key hashing
  ├── attempt hit validation
  └── hourly cleanup
             │
Dedicated D1
```

没有 WebSocket、Colyseus、Render、Lucas Academy 数据库或 Snake Lab 运行时依赖。

## 下一实现里程碑：全屏响应式 Game Stage

**状态：已实现并完成本地响应式验证。**

把现有 Hider 和 Seeker 流程放进一个填满可用 viewport 的游戏 stage，使它在桌面、手机和平台 iframe 中都像一个完整网页游戏，而不是由许多分散页面区块组成。

本阶段要做：

- 建立统一的 stage shell，包含主 Canvas、Close Look、HUD、动作按钮和触屏控制。
- 将 stage 内的 HTML 控件做成 overlay/panel；根据宽屏和窄屏重排。
- 保留 960×640 世界坐标和现有 Canvas 命中、碰撞、门、绘画、检查逻辑。
- 支持 viewport resize、safe-area、键盘、pointer/touch、joystick 和 reduced motion。
- Hider、Seeker、分享完成态和错误态都不得产生横向页面滚动。
- 官网的 Explore、admin、隐私与合规入口继续是 DOM/独立页面。

本阶段明确不做：

- 不把按钮、登录、支付、分享、举报、Turnstile 或所有文字重画进 Canvas。
- 不合并所有 Canvas，不重写游戏引擎、挑战 payload、Worker、D1、认证或平台 SDK。
- 不同时接 Discord、itch.io、CrazyGames、Poki、Facebook 或真实收费。

验收时至少检查 390×844、844×390、桌面宽屏和一个可变尺寸 iframe；Hider/Seeker 各完成一次完整流程，并确认 inspection 点击和碰撞坐标没有因 CSS 缩放偏移。

当前验证结果：390×844、844×390、1366×768 均无横向溢出；Hider PaintStudio、Seeker ready overlay、Start 计时、响应式 Close Look 点击和 give-up 结果态通过，浏览器控制台无 warning/error。消费者界面随后按 D-012 收敛为 action-first 最小文案：Canvas 只显示 `hide-and-seek!` 和必要状态，Explore 只显示创建入口、三条短分类与挑战按钮。平台 iframe 的 SDK 生命周期和真实设备 Safari/Chrome 仍按后续平台与设备闸门验证。

## Challenge v1 payload

```json
{
  "version": 1,
  "artHouse": "van-gogh-house",
  "surface": 0,
  "artSeed": 123,
  "roomIndex": 0,
  "x": 520,
  "y": 470,
  "pose": "stand",
  "avatarData": "data:image/webp;base64,..."
}
```

- `surface` 选择 A/B/C 房间表面。
- `artSeed` 稳定选择每件家具的 v1/v2/v3 绘画版本。
- `roomIndex` 和本地坐标确定一个 Hider、多个 Seeker 看到的相同目标。
- `avatarData` 是唯一按 challenge 重复保存的图像；房间和家具由 CDN 按内容哈希缓存。

API 接受的完整 JSON 最大 96 KiB；角色图像编码前必须不超过 60 KB。超过闸门直接拒绝，不自动写 R2。

## 已保留的服务契约

- 144 位随机 challenge token；D1 只存 SHA-256。
- 独立 Hider key，仅保存在创建者 localStorage，不进入分享链接。
- 发布后恰好 24 小时应用层失效。
- 尝试 ID 幂等；一个挑战允许许多不同 attempt ID。
- Seeker 点击 Start 之前不启动计时。
- Cron 只负责物理清理，读取/写入路径始终做硬过期。

## 迁移后验证状态

- `npm run check`：TypeScript、Vite build、Worker 语法和 27 个自动化测试通过。
- 桌面本地闭环：创建 → 分享 → 第二页 Start → 找到 → Hider 汇总通过；键盘和摇杆移动可用。
- 390×844 手机视口：无横向溢出，摇杆和 inspection 并排留在画布下方，Start 前计时为 0.0s。
- 本地浏览器控制台：无 warning/error。
- 默认 Van Gogh Camo 的一次本地 D1 样本为 4,950 个 JSON 字符；TTL 为 86,400 秒。这个单样本不能代替 P50/P95 监控。

仍需人工设备验证：iPhone Safari、Android Chrome、iPad Safari 的实际触控绘画、系统分享和内存。

## 部署前闸门

1. 完成所有当前 room/avatar/prop 的逐项 provenance 记录和 reviewer 结论。
2. 将 `prototype` 资产批准为 `cleared`，或替换/移除。
3. 加入 Hider 发布规则提示、Seeker 举报入口和基本速率限制。
4. 在真实 iOS/Android 设备完成触控与 WebP/PNG fallback 验证。
5. 记录一次部署前 D1/R2 成本检查，确认 P50/P95 challenge payload。
6. owner 明确批准部署。

## 当前仍暂不做

- 不接支付、Discord、itch.io、Poki 或 CrazyGames；只保留 provider-neutral 的账户/entitlement 接口。
- 不迁移第三层艺术房间、房间编辑器、Code Brush、多人同步移动或 Colyseus server；当前移动只发生在每位玩家自己的浏览器中。
- 不加实时在线人数、持久排行榜、自由上传作品画廊、聊天或自由文本。

`/explore` 已读取 Hider 默认公开、可取消的 24 小时挑战，提供 Sneaky、Fresh、Surprise 三条轻量 feed，并用 60 秒 Worker Cache API TTL 限制 D1 列表读取。成人邮箱 OTP、举报/审核与 provider-neutral entitlement 基础层已经存在；平台身份交换和收费仍受 [公开挑战计划](PUBLIC-CHALLENGE-PLAN.md) 的分阶段闸门约束。
- 不创建 Render 或 R2；达到测量闸门再评估。
