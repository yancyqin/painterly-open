# Painterly Chameleon 单一 Canvas 分阶段迁移计划

状态：1A production 已通过；1B correction 与 1C 等待 owner QA；6A Liquid 已锁定逐 mark ring-mask/scratch composite 路径  
日期：2026-07-23

执行状态：

- Phase 1：owner 已在真实手机通过，反馈“效果丝滑，延迟极低”；
- Phase 2：owner 验收失败；Canvas 已降至约 9 个但主游戏仍卡，证明 Canvas 数量不是主要瓶颈；
- Phase 2A：owner 验收失败；约 61 万 backing pixels 下主游戏仍卡，实验改动已撤回；
- Phase 2B：owner 验收失败；固定 960×640 Live underlay + event-driven overlay 后主页仍然“卡死”；
- Phase 2C：owner 验收通过；真实 1A + 8 件家具 + 可移动变色龙全程丝滑；
- Phase 2D：owner 验收失败；前三档全程丝滑，切换 `PRODUCTION RENDERER + ALL` 后立即卡死，已在同页复现并锁定生产 renderer；
- Phase 2E：owner 验收通过；生产 `CuratedLiveRoomRenderer` 改为 direct renderer 后恢复丝滑；
- Seeker 跟进：关闭 Close Look 无效；接入固定 960×640/30Hz Live underlay 后 owner 确认“好多了”，但龙移动仍卡；去掉 pointermove 与 movement RAF 的重复 foreground render + dirty-region repaint 后仍不够丝滑；
- 移动 A/B #1（overlay 降到 dpr 1）：owner “没有变化” → 排除 overlay 分辨率/合成面积；
- 移动 A/B #2（移动时冻结 underlay）：owner “丝滑” → 根因 = 第二块每帧变化的可见 canvas 层的重绘+合成；不可发布诊断先恢复为 `false`，其开关和 underlay 随 Phase 3 一并删除；
- Phase 3：纯 direct 单 Canvas 真机验收失败；owner 反馈 Hider 和 Seeker 移动仍不丝滑，说明消除第二可见层以后，每个移动帧直接执行完整 Live room pass 仍会拖慢角色；
- Phase 3R：保留唯一可见主 canvas，增加一块不进入 DOM 的固定 960×640 room-frame cache；owner 真机反馈“还是卡”；
- 移动 A/B #3（完全关闭龙自身 Live）：owner 确认“不是这个问题”，正式排除；共享 false 开关及所有 gating 已撤销，龙 Live 恢复；
- 移动增量基准 #4：owner 观察到游戏内 1A 比 6A 卡很多；`live-1a` 的主游戏同款 movement 基准中，15Hz 与 30Hz room rebuild 均明显卡，说明不是刷新频率线性过高，而是单次 1A rebuild 尖峰；
- 移动逐阶段基准 #5：固定 30Hz，base-only 对照后，owner 确认第 2/3/4 档同样卡；卡顿从加入 626 marks 开始，后加的 coarse/2px warps 没有可感知的额外恶化，warps 从主要嫌疑中排除；
- 移动 mark 基准 #6：618 flat dots 与 204 soft glow dots 丝滑，618 soft glow dots 卡；排除单纯 draw-call 数量，锁定大量逐帧 radial-gradient 创建；
- 移动 atlas 基准 #7：把 618 个 authored glow dots 的颜色/soft edge 在初始化时烘焙到一张共享 atlas，动画帧只做 `drawImage`；owner 确认丝滑且 glow 外观正常；
- Production atlas #8：仅对颜色静态的 `lissajous-heartbeat` / `firefly` glow dots 默认启用共享 atlas；新增完整 marks + 全部 warps 验收档；
- Production atlas #9：owner 确认完整 1A + Hider/Seeker 均丝滑；1C 微卡，继续把其 456 个静态照片色 growth dots/streaks 纳入同一 atlas；6A 属独立 renderer，后续单独定位；
- Production atlas #9 owner 复测：1C 已丝滑；
- Live avatar #10：Studio Live 绘制期间启用 draw-calm，六张 organic wave stamp 合并为一张共享 atlas；等待三种 Live Brush 与房间龙真机验收；
- Final LPP #12：更新 `$import-lpp` 手机性能合同，删除已被真机证伪的统一 0.5×、30Hz 与移动 freeze 硬约束；导入 final 1A/1B/1C。1B 使用 Splash/Twinkle/Galaxy 静态色 atlas，1C 使用 Growth/Firefly/Twinkle atlas 与一张共享 warp blur source；新增独立 `live-1b` tabbed benchmark，1B/1C 等待 owner 视觉与手机流畅度验收；
- Final LPP #12 owner 复测：1B 的 BASE / SPLASH / STARS / GALAXY / FULL ATLAS 全部丝滑，1B production 通过；1C final 仍保留视觉 QA；
- 1B correction #13：owner 新档保持同一 shell，更新为 1,233 marks/88 strokes/0 warps；Galaxy 改为两种 directional Breakout，使用两条完整 SHA-256 静态 adapter 并继续走 shared atlas。旧 1B 验收结果保留为历史证据，correction 重新等待 owner QA；
- Live avatar #11 owner 复测：20 Liquid marks 丝滑；高数量 `RE-LAY ONLY` 与 `FULL` 卡；原 `EROSION ONLY` 因龙被重叠 erosion 完全擦掉，无法形成有效视觉/拖动结论。下一轮给 Erosion 加不计时的淡参考龙，并增加同 mask/`source-in`、但只做 bounded solid fill 的 `TINT RE-LAY`；
- Live avatar #11 第二轮：owner 确认高 mark 数的 `TINT RE-LAY` 与带参考龙的 `EROSION ONLY` 都卡；因此排除“只有 transformed full-source pigment draw 才是瓶颈”，两档共同的逐 mark organic ring mask、scratch composite 与 bounded blit 是下一轮应批处理/atlas 化的路径；
- Seeker Close Look 复盘：完全关闭 Close Look 后 Seeker 仍卡，已排除它是主因并恢复；`Space` / `R` inspect 快捷键及同卡提示一并恢复；
- 第一层 avatar brush 决策：owner 选定 Firefly / Growth / Color Liquify Splash；三者按龙自身静态颜料建立一张 bounded shared atlas，Van Gogh Studio 只显示这三支，第六层原三支不变。Hider HUD 的 Live 改为 Lobby 下方同尺寸 pulse-dot button，Paint 改为右下角大号彩色调色板；
- Phase 4–5：降级为非阻塞架构清债，不再作为修复本次卡顿的前置条件；
- Phase 6：仍保留为 Art Lab / `.lpp` 向后兼容阶段。

## 目标

把 Painterly Chameleon 从“多个页面状态和 renderer 各自拥有 canvas、缓存和动画循环”的结构，迁移为：

- 同一时间只有一个活动 Scene，隐藏页面不做绘制工作；
- Live renderer 不为每种特效、图层或状态持有独立的持久 canvas；
- 活动 Scene 原则上直接绘入一个主 Canvas；如果 Phase 3 实机证明确需分辨率/刷新率分层，则允许一个有明确用途的 Live underlay，加上一个交互 overlay；
- 临时缓冲区有明确 owner、生命周期和硬上限，不要求把 Paint Studio 的编辑工作层强行塞进游戏主 canvas；
- 保留完整 Live Painting 视觉效果，不以减少 marks、删除特效或降低作品复杂度作为主要优化手段；
- 保留现有 `.lpp` 作品和 Art Lab 作者工作流，旧作品不能因为 renderer 重构而作废。

最重要的架构约束：

> **不是每种粒子、颜色、页面状态各养一套 Canvas。**

## Owner gate：每个 Phase 必须单独验收

1. 一次只实施一个 Phase，每个 Phase 使用独立 commit/PR，必须可以单独回滚。
2. 每个 Phase 完成后停止开发，由 owner 在真实设备上亲自验证。
3. Owner 明确通过以前，不得开始下一个 Phase，也不得把两个 Phase 合并后一起交付。
4. 如果验收失败，先保留失败证据、定位该 Phase 的最小问题并修正或回滚；必要时再把一个边界清楚的问题交给 Claude 协助，但最终判断、视觉标准和方向仍由 owner 负责。
5. 自动测试通过不等于 Phase 通过；owner 的手机视觉、触摸和流畅度验收是硬门槛。

## 不采用的“优化”

- 不把问题归因于“像素太多”或“marks 太多”，然后直接牺牲作品内容。
- 不静默删除、合并或稀释 `.lpp` 中已经作者化的 marks、warps、glow、时间参数或图层。
- 不在多个组件中继续增加私有 canvas、私有 RAF 或按颜色创建 texture/cache。
- 不在 Phase 1–5 顺手修改 Art Lab 或 `.lpp` 格式；Art Lab 整合固定放在 Phase 6。
- 不用一次性的设备特判掩盖 renderer ownership 问题。
- 不在没有 2D Canvas 基线证据以前仓促改写为 WebGL/WebGPU。

## 已知基线

### Owner final `.lpp` golden fixtures

2026-07-22 收到的以下三个 owner 原文件是后续迁移的视觉与兼容性 source of truth，不得用重做的替代项目取代：

- 1A Sunflower Parlor：626 marks、17 strokes、5 warps；archive SHA-256 `3aa1db5eadb52115145a3a61a7ebbbdd67b428728477b638ca7ee2b3ef789489`；
- 1B Starry Studio correction：1,233 marks、88 strokes、0 warps；archive SHA-256 `d567a1b07cc75e7e0ff925a592fa39c933730aae514f323f5a85aa9e0464ae15`；
- 1C Cypress Bedroom final：553 marks、15 strokes、2 warps；archive SHA-256 `c5f646b6f4bdab6a09678b277096af0b1953cc1483fb60833a816ace6843f43f`。

2026-07-23 已用登记的 archives 生成三个 runtime；pre-correction 1B 的五档 additive benchmark 已获 owner 真机通过，但 correction 与 final 1C 的视觉仍须 owner 明确通过，不能把自动检查当成批准。

### 主游戏初始盘点（历史基线）

在当前工作树启动主游戏后，动态计数结果为：

- 脚本通过 `document.createElement("canvas")` 创建 45 个 canvas；
- 页面和 Paint Studio 模板内有 5 个 canvas；
- 启动后合计 50 个 canvas 对象。

这是 Phase 2 开始前的初始情况，不代表当前实现。其中两个 `GameCanvas` 实例当时各自提前创建三套互斥 renderer：

- `LiveAvatarRenderer`：3 个 canvas；
- `CuratedLiveRoomRenderer`：4 个 canvas；
- `UnfinishedMorningLiveRoomRenderer`：10 个 canvas（包括预生成 stamps）；
- `GameCanvas` 自己的 inspection/backdrop：2 个 canvas。

因此一个 `GameCanvas` 启动即占 19 个，两套 Hider/Seeker 合计 38 个；无论当前页面、房间或 Live 模式是否会使用它们。

### 单 Canvas 控制组

`live-1a.html` 已使用真实 `van-gogh-sunflower-parlor-1a.json`：

- 626 marks；
- 17 strokes；
- 5 warp fields；
- heartbeat、ripple、liquid-warp 全部启用；
- 1 个主 canvas，0 个 offscreen canvas；
- 390×844 浏览器手机 viewport 基线：30/30 fps，约 1.6 ms 平均 render、2.2 ms p95，151 帧内 0 个超过 33.3 ms 的慢帧。

这个结果只证明架构可行；桌面浏览器的手机 viewport 不能代替真实 iPhone Safari 和 Android Chrome 验收。

## 每阶段统一记录表

Owner 验收每个 Phase 时记录：

| 项目 | 结果 |
| --- | --- |
| commit/PR |  |
| 设备与 OS |  |
| 浏览器/WebView |  |
| 主 Canvas 数 |  |
| 总 Canvas/context 数 |  |
| RAF/动画调度器数 |  |
| 静止 60 秒 | 通过 / 不通过 |
| 连续移动 60 秒 | 通过 / 不通过 |
| Studio 打开、作画、关闭 | 通过 / 不通过 |
| Hider → Lobby → Seeker 往返 10 次 | 通过 / 不通过 |
| Live 视觉与控制组一致 | 通过 / 不通过 |
| 发热、卡顿、输入延迟备注 |  |
| Owner 决定 | 通过 / 修正 / 回滚 |

---

## Phase 1 — 锁定单 Canvas 控制组与真实设备基线

### 目的

先让 owner 在真实手机上确认：“真实 1A 全效果可以在一个 canvas 中流畅运行”。它是后续所有 Phase 的视觉与性能对照组。

### 范围

- 保持 `live-1a.html` 使用真实 1A runtime JSON，不使用手写替代动画。
- 页面严格只有一个 canvas；禁止 `OffscreenCanvas` 和运行时创建额外 `HTMLCanvasElement`。
- 把 marks、warps、FPS、平均 render ms、p95 render ms 和慢帧数画在同一个 canvas 上。
- 保留点击隐藏性能面板的能力，以便观察纯画面。
- 固定保存 Phase 1 的设备、浏览器和结果，作为后续比较基线。

### Owner 手动验收

1. 在真实 iPhone Safari 打开 1A 页面，至少连续运行 60 秒。
2. 如果有 Android 设备，再用 Chrome 做同样测试。
3. 观察五个 warp 区域、heartbeat 和 ripple 是否都持续运动，而不是静态背景。
4. 与 Art Lab 中同一 `.lpp` 的整体观感对照；不能接受明显丢效果。
5. 确认触摸页面不会产生滚动、缩放或动画停顿。

### 退出条件

- Owner 明确确认单 Canvas 控制组在目标手机上可行。
- 如果真实 Safari 仍然卡，本计划停止在 Phase 1，先诊断单 Canvas 路径，不进入主游戏重构。

---

## Phase 2 — Renderer 按需创建，消灭启动时的互斥资源

### 目的

不改变游戏页面结构和绘制结果，只修正最明显的 eager allocation：没有使用的 renderer 不得创建 canvas/context。

### 范围

- 把 `GameCanvas` 中的三套 renderer 字段改为 nullable/lazy getter。
- 只有进入对应 Live 房间时才创建 `CuratedLiveRoomRenderer` 或 `UnfinishedMorningLiveRoomRenderer`。
- 只有角色确实拥有 Live marks 时才创建 `LiveAvatarRenderer`。
- Unfinished Morning 的 stamps 改为进入该模式后再生成。
- Paint Studio 的 Live renderer 只在打开 Live tab/Live 模式时创建。
- 给 renderer 增加明确的 `dispose()`；离开模式后释放引用并把不再使用的 canvas backing size 归零。

### 不在本 Phase 做

- 不合并 Hider/Seeker 页面。
- 不修改 RAF 架构。
- 不修改 `.lpp`、importer 或 Art Lab。
- 不修改任何效果参数。

### 自动验收

- 启动时不再创建三套房间 renderer。
- 脚本创建 canvas 数从 45 降到目标不高于 8；页面总 canvas 对象目标不高于 13。
- 进入普通房间不创建 Live renderer。
- 进入 1A、1C、Unfinished Morning 时只创建当前需要的 renderer。
- `npm run check` 全部通过。

### 实施结果与 owner 结论

- 两个 `GameCanvas` 启动时不再构造 `LiveAvatarRenderer`、`CuratedLiveRoomRenderer` 或 `UnfinishedMorningLiveRoomRenderer`；
- 初始构造路径只剩 8 个脚本创建 canvas，加上 5 个模板/Studio 显示 canvas，达到总数不高于 13 的 Phase 2 目标；
- 隐藏 Hider/Seeker 页面、退出对应 Live 房间、关闭 Live、关闭 Studio 时，renderer 的 backing stores 归零并释放引用；
- Unfinished Morning 不再为 34 个采样颜色分别生成 tint canvas，改为使用同一几何和原采样颜色直接描画；
- 1A/1C `.lpp` 生成数据、marks、warps 与效果参数没有因本 Phase 改动。

Owner 在真实手机复测后确认：即使可见/活动 Canvas 已降至约 9 个，主游戏 Live 仍卡。因此这些 lifecycle 修改属于有价值的资源卫生，但不能作为本次卡顿的根因修复，Phase 2 不通过。

### Owner 手动验收

- 逐一进入普通房间、1A、1C 和三个 Unfinished Morning 房间。
- 每次进入/离开 Live 模式至少 10 次，确认视觉、动画相位、Studio 预览和返回房间都正常。
- 在手机上连续走动 60 秒，确认没有新增卡顿或首次进入后无法恢复的问题。

### 退出条件

Owner 通过；否则只修 Phase 2 或回滚，不开始 Phase 3。

---

## Phase 2A — 主 Canvas backing-resolution / fill-rate 诊断实验（失败，已撤回）

### 为什么插入这个实验

Phase 1 与主游戏绘制相同 1A 内容时有一个关键区别：

- 单 Canvas 控制组固定 `960×640`，共 614,400 backing pixels；
- 主游戏原来使用 `cssWidth × cssHeight × devicePixelRatio`，DPR 最高 3；390×844 的手机会创建约 1170×2532、共 296 万 backing pixels。

主游戏每帧还要清空整屏、绘制整屏背景渐变、缩放房间、合成 Live FX 和 HUD。Phase 2 已经弱化 Canvas 数量假设，因此在继续生命周期重构前，先隔离验证主 Canvas fill rate。

### 实验改动

- 只改变 `GameCanvas.resize()` 的 backing resolution policy；
- 粗指针设备把整块主 Canvas 限制在约 `960×640 = 614,400` 总像素，并把 DPR 上限设为 1.5；
- fine-pointer 桌面不使用手机像素预算，只把 DPR 上限从 3 调整为 2；
- Canvas CSS 尺寸、全屏布局、逻辑坐标、触摸映射、房间、HUD 和碰撞完全不变；
- 不修改 `.lpp`、marks、warps、特效参数或 curated FX 数据；
- Canvas 的 `data-backing-resolution`、`data-render-scale` 和 `data-pixel-budget` 记录实际实验值，便于调试；
- 这是一项可单独回滚的诊断改动，不代表在 owner 验收前确定最终画质策略。

### Owner 手动验收

使用 Phase 2 失败时的同一台手机、同一路径和同一 1A 场景：

1. 强制刷新后进入主游戏 1A 并开启 Live；
2. 静止观察 30 秒，再连续走动 60 秒；
3. 与 Phase 1 控制页比较流畅度、输入延迟和可接受的清晰度；
4. 记录“明显变丝滑 / 仍然卡”以及是否出现不可接受的文字、房间或 Live 模糊。

### 决策闸门

- 如果主游戏明显变丝滑：fill rate / backing resolution 根因得到支持；把“受限内部像素预算 + CSS 全屏显示”纳入 Phase 5 render graph 设计，再决定最终手机预算和 UI 分层方式。
- 如果主游戏仍然卡：回滚 Phase 2A，下一步只检测重复 render pass、隐藏 RAF 或同一帧多次合成，不继续猜 Canvas 数量或 marks 数量。
- 无论结果如何，owner 明确判断以前不开始 Phase 3。

### Owner 结论

- 同一手机上 `live-1a.html` 仍然丝滑，主页进入 Live 后仍然明显卡顿；
- 当时主 Canvas 已实际运行在 590×981 backing store（约 58 万 pixels），因此主 Canvas 像素量不是这次卡顿的主要根因；
- 该分辨率策略已从 `GameCanvas.resize()` 撤回，不作为最终画质方案。

---

## Phase 2B — 按刷新频率分层，切断 Live 对静态游戏世界的重绘

### 实证根因

Owner 提供的 Canvas 2D recording 显示：

- Frame 1–9 每帧固定执行 265 条主画布命令；
- 每帧固定 11 次 `drawImage`、11 次 `createRadialGradient`和 1 次整屏 `clearRect`；
- 家具和变色龙坐标没有改变，仍然被 Live 的 30fps tick 重画；
- recording 只包含可见 `GameCanvas` 的命令，尚未计入 curated renderer 在 offscreen canvas 上重建 marks/warps 的工作；
- 根因调用链为 `uiFrame → render → clear → room + Live FX + props + actor + HUD`。

### 实验改动

- 仅对 Hider 的 curated Live 房间启用分层，便于单独回滚；
- Live underlay 固定使用 `960×640` backing store，只画 room base 和 Live FX，与 Phase 1 控制组保持同类工作负载；
- 原 GameCanvas 成为全屏透明 overlay，只画 props、变色龙和 HUD；
- Live 30fps tick 只调用 `renderLiveUnderlay()`，不再调用完整 `render()`；
- overlay 只在移动、HUD/状态改变、resize 或资源就绪时重画；
- 移动时 underlay 仍以自己的 30fps lane 更新，overlay 根据输入更新，两者不再互相拖累；
- underlay 只在当前活动 curated Live 房间存在；关闭 Live、离开房间或切换 route 时移除 DOM canvas 并将 backing store 归零；
- 导出截图和取色只在用户明确操作时扁平化两层，不进入动画循环。

这两个 canvas 是按刷新频率划分的有界责任层，仍然遵守：

> **不是每种粒子、颜色、页面状态各养一套 Canvas。**

### Owner 手动验收

1. 在同一手机上进入主页 1A，开启 Live；
2. 静止观察 30 秒，确认 Live 持续动画，家具、变色龙和 HUD 正常；
3. 连续移动 60 秒，确认 Live 不冻结、角色没有错层、输入没有明显延迟；
4. 关闭再开启 Live，确认普通单 Canvas 路径和分层路径可正常往返；
5. 与 `live-1a.html` 对比动画流畅度和视觉完整性。

### 决策闸门

- 如果通过：修订 Phase 5，把“单一 Canvas”改为“单一活动 Scene，最多两个按 cadence 分层的可见 canvas”；
- 如果仍卡：回滚 Phase 2B，直接针对 underlay 内部 renderer 与 Phase 1 renderer 做调用级差异定位；
- Owner 明确判断前不开始 Phase 3。

### Owner 结论

Phase 2B 在真实手机上仍然“卡死”，不通过。这说明仅切断 Live tick 对家具、角色和 HUD 的重复重绘仍不足以解释主应用与 `live-1a` 的巨大差异。剩余全局对象不能再被假定为无害：

- Hider 与 Seeker 在启动时同时构造，各自拥有一个 DOM canvas、两个 detached helper canvas 和一条持续调度的 UI RAF chain；
- Paint Studio 在模块初始化时就构造，即使从未打开，也创建两个 DOM canvas 和四个 detached paint layer；
- 当前 Hider curated Live 还拥有四个 renderer scratch canvas；Phase 2B 另加一个 DOM underlay；
- 因此 active Hider Live 时，当前结构约有 6 个 DOM canvas 和 12 个 detached/offscreen HTML canvas 对象。隐藏或透明不等于没有内存、调度或合成成本。

---

## Phase 2C — 在丝滑控制组上做家具与移动角色的单 Canvas 加法验证

### 目的

不再从复杂主应用里做减法猜测。以 owner 已确认丝滑的 `live-1a` 为唯一基线，在仍然只有一个 canvas、一个 RAF、零 offscreen canvas 的前提下逐步加入主页实际工作。

### 三档控制

1. `LIVE ONLY`：原始 1A，626 marks、5 warps；
2. `+ FURNITURE`：加入 Sunflower Parlor 的 8 件真实家具，使用主游戏相同的 PNG、尺寸、深度排序和 Live 羽化阴影；
3. `+ CHAMELEON`：再加入真实 stand 变色龙；触摸可直接拖动，每个 render frame 重新执行家具/角色深度排序和绘制。

控制按钮是普通 DOM，不创建 canvas。页面 HTML 始终只有一个 `960×640` canvas，源码禁止 `createElement("canvas")` 和 `OffscreenCanvas`。

### 决策闸门

- `LIVE ONLY` 丝滑、`+ FURNITURE` 开始卡：家具绘制或逐物体渐变阴影是直接触发项；
- 前两档丝滑、`+ CHAMELEON` 开始卡：角色移动、深度排序或输入链是直接触发项；
- 三档全部丝滑：家具和角色每帧重画并非充分根因，下一步直接删除主应用的全局 Seeker/Studio eager construction 和隐藏 RAF，再把同一个控制组结构迁回主路由；
- Owner 明确判断以前不开始 Phase 3。

### Owner 结论

三档全程丝滑。家具、角色、移动输入、逐帧深度排序和在同一个 canvas 中重画完整游戏前景均被证伪，不能再作为主因。

---

## Phase 2D — 在同一控制页替换为生产 Live renderer

### 唯一变量

第四档 `PRODUCTION RENDERER + ALL` 保留与第三档完全相同的：

- `960×640` 可见 canvas；
- 626 marks、5 warps；
- 8 件家具；
- 可拖动真实变色龙；
- 30fps loop 和深度排序。

唯一变化是把直接绘制 1A 的控制 renderer 换为主页当前的 `CuratedLiveRoomRenderer`。该 renderer 会创建 source、FX、layer、glow 四个 detached canvas，因此第四档的 render graph 从 1 个 canvas 变为 1 个可见 + 4 个 detached canvas。

### 决策闸门

- 第三档丝滑、第四档开始卡：生产 renderer 的四层 offscreen rebuild/copy 路径坐实为根因；下一步把控制页的 direct renderer 抽成共享 production renderer，再接回 GameCanvas；
- 第四档仍丝滑：生产 renderer 本身被证伪；下一步只清理主应用全局 Hider/Seeker/Studio eager construction、隐藏 RAF 和常驻 helper canvas；
- Owner 明确判断以前不开始 Phase 3。

### Owner 结论

前三档全程丝滑；第四档 `PRODUCTION RENDERER + ALL` 一加载就卡死。由于画布尺寸、作品、家具、变色龙、移动输入、30fps 调度和深度排序均未变化，触发项被锁定为生产 `CuratedLiveRoomRenderer` 的内部 render graph。

这里的证据不能简化成“只要 canvas 数量多就一定卡”。旧生产路径同时增加了四个 detached canvas、逐帧 FX rebuild、layer/glow 合成与多次全画面 copy；Phase 2D 证明的是这整条生产 renderer 路径足以单独触发卡死。

---

## Phase 2E — 用已验证的 direct path 重写生产 Curated renderer

### 唯一改动

保留 `.lpp` runtime 契约、626 marks、17 strokes、5 warps、所有 adapter 参数和项目时间语义，只替换 `CuratedLiveRoomRenderer` 的绘制实现：

- 删除持久化 FX、layer、glow 三个 scratch canvas；
- source canvas 只在首次 prepare 时读取原图颜色，随后立即把 backing store 归零；
- warp mask 的连续区段与 slice geometry 在 prepare 时预计算，不在动画帧中重复扫描；
- warp slices 和所有 marks 直接绘入调用方 context，不再做 FX rebuild 和多层全画面 copy；
- 第四档与主页共享同一个生产 renderer 类，因此不维护第二套临时实现。

### Owner 验收顺序

1. 在 `live-1a` 先确认第三档仍丝滑；
2. 切换第四档并拖动变色龙，确认 direct production renderer 是否仍会触发卡死；
3. 只有第四档通过后，再进入主页 1A Live 验证静止和移动；
4. 第四档或主页任一失败，都停在 Phase 2E 继续定位，不开始 Phase 3。

### Owner 结论

2026-07-22，owner 在真实手机确认改写后的生产 renderer “现在很丝滑”。Phase 2E 通过。Phase 2D/2E 的 A/B 结果共同证明：卡死触发项是旧 `CuratedLiveRoomRenderer` 的多层离屏 rebuild/copy render graph；相同作品、家具、变色龙和交互改用 direct path 后不再触发问题。

---

## Seeker 跟进 — 与 Hider 对齐 Live target

### 已排除

Owner 实机确认：完全关闭 Seeker Close Look 后仍然卡。实验同时停掉了 crop canvas 分配、逐帧 canvas-to-canvas capture、放大绘制和卡片热区，因此 Close Look 不是充分根因。

### Underlay 结果

Hider curated Live 已在固定 `960×640` underlay 上以 30Hz 绘制，移动只重画交互 overlay；Seeker 原实现没有使用该 underlay，移动时会把 room Live 直接画入全屏 DPR canvas，并可能跟随移动帧率重复执行。让 Hider 与 Seeker 共用同一 underlay 规则后，owner 确认 Seeker “好多了”，证明背景/前景分层有效；但龙移动仍卡。

### 移动层跟进

背景已经不会随龙移动重画。第一步删除了 joystick `pointermove` 与 movement RAF 的重复 foreground render；owner 确认“好像好一些”，但仍不如非 Live 丝滑。

进一步检查确认：上层虽然透明，移动帧仍会 `clearRect` 整个手机 backing，并重画全部家具、龙和 HUD。当前改为 dirty-region repaint：只清除龙旧位置、龙新位置和 joystick 的屏幕区域，再在同一个 clip 内按原深度顺序恢复相交家具、龙和 UI。没有新增 canvas；跨房间、非 Live 和非移动状态继续使用完整 render。dirty-region 只减少光栅像素，仍不够丝滑，于是做了下面两个真机单变量 A/B。

### 移动卡顿根因：真机 A/B 确认（2026-07-22）

在“移动仍卡”的已知基线上，每次只改一个变量，owner 真机验收：

- **A/B #1 — 只把透明 overlay 的 backing 降到 dpr 1**（`OVERLAY_DPR_CAP`，只改 `GameCanvas.resize` 一行，underlay 固定 960×640 不动，特效不动）：结果 **“没有变化”**。⇒ overlay 层的**分辨率 / fill rate / 合成面积不是**卡顿来源。已回滚。
- **A/B #2 — 移动时冻结 underlay**（`FREEZE_UNDERLAY_WHILE_MOVING`，在 `renderLiveUnderlay` 顶部 `this.actorMoving` 时提前返回；刻意保留 uiFrame 调用行不变以不破坏源结构断言测试）：结果 owner **“丝滑”**。⇒ 卡顿来源是**移动帧里那次 underlay 重绘 + 第二块“会变化的” canvas 层被 Safari 每帧重新上传/合成**。

**决定性逻辑**：Live 关闭时，移动帧对**一块不透明 canvas**做**完整 `render()`**（画得更多）反而丝滑；Live 开启时移动帧只做 dirty-region 重画（画得更少）却卡。唯一变重的是**双层拓扑**——透明 DPR overlay 叠在会动的 underlay 之上。

**已排除**（真机或受控实验证伪，不得再作为解释）：marks 数量、作品复杂度、家具数量、源图像素、canvas 总数（9 个仍卡）、overlay 分辨率。

**方向**：根因就是“第二块每帧变化的可见 canvas 层”。因此 Phase 3 保证只有主 canvas 可见且发生变化，同时房间动画不能冻结。A/B #2 使用的 `FREEZE_UNDERLAY_WHILE_MOVING=true` 仅是历史诊断；它曾在正式修复前恢复为 `false`，现已随 underlay 代码完全删除。iOS Safari 教训：被触碰的 Canvas 2D 层无论 dirty-rect 都会**整层重新合成**，每多一块会动的 canvas 层就是每帧一份合成成本。

---

## Phase 3 — 一块可见主 Canvas + 一块有界离屏 Room Cache

> **真机结果与修订（2026-07-22）**：两个单变量实验已把原始移动卡顿锁定为“第二块每帧变化的可见 canvas 层的重绘+合成”，并排除了 overlay 分辨率。第一版 Phase 3 物理删除 underlay，并让主 canvas 在每个移动帧直接执行完整 Live room pass；owner 真机确认 Hider/Seeker 仍不丝滑。结论是：第二可见层必须删除，但高成本 Live background 也不能跟随 60Hz 移动重复计算。Phase 3R 因此保留唯一可见主 canvas，增加一块固定 960×640、永不插入 DOM 的 room-frame cache。

### 为什么这不是恢复旧 underlay

旧 underlay 是第二块可见 DOM canvas，Safari 会把它当作独立合成层；新 room-frame cache 只是主 canvas 的一个 `drawImage` 来源：

- cache 永不 append/before/insert 到 document，不产生第二可见层；
- backing 固定为 `960×640`，不跟随手机 DPR 膨胀；
- Live background 只在 30Hz tick 或房间/资源变化时重建；
- 60Hz 移动帧把最新 cache 复制到主 canvas，然后在同一主 canvas 画家具、角色和 HUD；
- 取色、导出和截图只读取已经完整合成的主 canvas；
- Scene inactive 时 cache backing store 归零并释放。

### 实现边界

- `FREEZE_UNDERLAY_WHILE_MOVING`、可见 underlay 及其 lifecycle/CSS/拼层状态保持删除；
- 不改 production direct renderer、DPR、作品、家具、角色、HUD 或输入；
- 只允许这一块有明确 owner、固定尺寸和释放路径的 room-frame cache；
- 不重新引入按背景/前景分裂的可见 DOM canvas，也不为效果、颜色或页面状态建立额外缓存。

### 移动 A/B #3 — 完全关闭龙自身的 Live（已排除）

Owner 观察到 Live brush 在龙身上作画也卡，因此提出完全关闭龙自身 Live。现有代码在 `actorMoving=true` 时本来就绕过 avatar force pass，且 marks 为空时不会创建 `LiveAvatarRenderer`，所以它不是“完全没画也走路卡”的强解释；但静止帧和 Paint Studio 仍可能创建/运行该 renderer，值得用单变量彻底排除。

- 临时共享诊断开关 `GAME_AVATAR_LIVE_ENABLED=false`；
- GameCanvas 的 avatar renderer ownership、avatar-only animation tick 和 `drawAvatar()` force pass全部短路；
- Paint Studio 始终显示静态 painted avatar，不创建 renderer，也不启动 avatar Live RAF；
- curated room Live 继续运行；不改 room cache、作品、marks 数据、DPR、移动或房间 renderer；
- 专用 `live-6a` renderer 研究页保持独立，避免破坏既有控制基线。

Owner 判定：

- 真机结果：Hider/Seeker 走路没有得到决定性改善，owner 明确确认龙自身 Live 不是问题；
- 结论：正式排除 `LiveAvatarRenderer`；
- 清理：`GAME_AVATAR_LIVE_ENABLED` 及 GameCanvas/PaintStudio 的所有 A/B gating 已撤销，原有“移动时跳过龙 force pass、停止后恢复”的正式行为保留。

### 移动增量基准 #4 — 1A Room Rebuild Cadence

Owner 新增关键观察：同一游戏路径里 1A 明显比 6A 卡，6A 并非完全不卡但好很多。结合“移动时冻结 underlay → 丝滑”，当前最强假设变为：1A production room rebuild 的周期性主线程尖峰打断了 60Hz 龙移动；`live-1a` 单独以 30Hz 播放丝滑，并不能证明它与 60Hz movement 同时运行仍有足够帧预算。

`live-1a` 在已通过的 `PRODUCTION RENDERER + ALL` 后新增三个递增档，三档共用：

- 主游戏同款约 60Hz movement RAF、touch/desktop move speed、分步碰撞和摇杆输入；
- 同一 1A production renderer、8 件家具、真实龙和深度排序；
- 唯一可见 DOM canvas，加一块固定 960×640、永不进 DOM 的 room-frame cache；
- 每次切档清空统计，分别显示 visible fps/render p95 和 room rebuild fps/p95。

只改变 room rebuild cadence：

1. `GAME MOVE · ROOM FROZEN`：进入档位时重建一次，移动期间不再重建；
2. `GAME MOVE · ROOM 15HZ`：移动期间 1A room cache 以 15Hz 重建；
3. `GAME MOVE · ROOM 30HZ`：与当前游戏一致，以 30Hz 重建。

Owner 判定：

- 真机结果：15Hz 与 30Hz 同样明显卡；结合先前 frozen-underlay 丝滑，确认问题不是 cadence 线性过高，而是任何一次 1A room rebuild 都可能制造足以漏掉移动帧的主线程尖峰；
- 三档都丝滑：cache/rebuild cadence 在隔离页被排除，下一档再增加主游戏 full-viewport DPR camera/HUD，不继续猜龙或 marks；
- frozen 本身也卡：问题已经落在 movement/collision/前景复制链，先继续拆这一档，不测更高 cadence。

### 移动逐阶段基准 #5 — 1A Single Rebuild Cost

固定使用同一 30Hz room cache rebuild 与同一 60Hz movement chain，只改变 production renderer 在一次 rebuild 中执行的阶段：

1. `GAME 30HZ · BASE ONLY`：每次只把静态 1A shell 写入 room cache；
2. `GAME 30HZ · + MARKS`：在 base 上增加全部 626 个 marks，不画 warp；
3. `GAME 30HZ · + WARPS 1–4`：再增加前四个 5px coarse warp；四者合计约 276 次切片 `drawImage`；
4. `GAME 30HZ · + 2PX WARP (FULL)`：最后增加第五个 2px tight warp；该 field 单独约 850 次切片 `drawImage`，得到完整 production 1A。

Production 的 `CuratedLiveRoomRenderer.draw()` 新增可选诊断 stage filter；主页和游戏调用方不传该参数，正式画面仍默认绘制全部 authored marks/warps。这个开关只供 `live-1a` 定位，不改变 `.lpp` 数据或生产默认行为。

Owner 判定：

- base 已卡：问题在 960×640 base/cache copy 或同线程调度，不再追 marks/warps；
- 真机结果：base-only 对照后，第 2（+marks）、第 3（+coarse warps）、第 4（+2px warp/full）同样明显卡；热点已落在 626 marks 的绘制，warps 未产生可感知的增量卡顿；
- marks 丝滑、加 coarse warps 后卡：热点在前四个 warp fields；
- 前三档丝滑、只在 full 卡：第五个 2px warp 的约 850 次小切片 `drawImage` 是主因；
- 单项均丝滑、full 才卡但并非只由最后一档触发：是组合帧预算，需要把 room rebuild 分帧或移出主线程，而不是再降低整体 cadence。

### 移动 mark 基准 #6 — 1A Mark Type and Count

1A 的 626 marks 实际分布高度集中：

- 618 个是 `lissajous-heartbeat` 的 9px soft dot；
- 618 个全部 `glow=true`、`softIdx=2`，当前每个 mark 每次 rebuild 都创建一次 radial gradient，并使用 `lighter` 合成；
- 其余仅 8 个是 ripple ring，没有 radial gradient。

新诊断档均关闭 warps、固定 30Hz room rebuild：

1. `MARKS · 8 RINGS`：只画 8 个 ripple rings；
2. `MARKS · 618 FLAT DOTS`：保留 618 个 dot 的位置、动画、数量和 `lighter` 合成，但用 flat fill 代替 radial gradient；
3. `MARKS · 75 SOFT GLOW DOTS`：第一条 authored glow stroke；
4. `MARKS · 204 SOFT GLOW DOTS`：前三条 authored glow strokes；
5. `MARKS · 618 SOFT GLOW DOTS`：全部九条 authored glow strokes；
6. `MARKS · ALL 626`：完整 618 glow dots + 8 rings。

Owner 判定：

- 真机结果：618 flat dots 丝滑，说明 618 次 mark draw/state change 本身可承受；204 soft glow dots 丝滑、618 soft glow dots 卡，说明大量逐帧 radial-gradient 创建跨过设备帧预算；
- 8 rings 已卡：marks 结论与 base 对照冲突，回查初始化或测量路径，不继续优化猜测。

### 移动 atlas 基准 #7 — One Shared Glow Atlas

`MARKS · 618 GLOW DOTS · 1 ATLAS` 保留：

- 原始 618 个 marks、位置、颜色、alpha、`lighter` blend；
- heartbeat 的逐帧尺寸变化；
- 原始 soft edge 的 radial-gradient 参数。

唯一变化：每种 authored dot 颜色的 radial gradient 只在切入测试档时创建一次，618 个 stamp 紧密打包到**一张共享 atlas**；后续每帧根据 atlas cell 做 `drawImage` 并缩放。它不是每个 mark、颜色、页面状态各养一套 canvas。atlas 按需创建，离开该诊断档或 dispose 时 backing store 归零。

Owner 判定：

- 真机结果：原始 `618 SOFT GLOW DOTS` 卡；`618 GLOW DOTS · 1 ATLAS` 丝滑，glow 外观正常。方案成立；
- atlas 仍卡：动态 gradient 结论不完整，下一步对比 618 flat fill 与 618 atlas `drawImage`，检查 source-texture upload/合成成本；
- atlas 丝滑但视觉不一致：先修 atlas stamp 的尺寸/采样保真，不把性能实验直接发布。

### Production atlas #8 — Curated Default and Full Scene Gate

安全范围审计：

- 1A：618 个 `lissajous-heartbeat` glow dots，颜色固定；atlas 保留 heartbeat 尺寸动画；
- 1C：160 个 `firefly` glow dots，颜色固定；atlas 保留逐帧位置与 alpha 动画；
- `growth` / `ripple` 等可能从照片采样颜色的 adapter 不进入 atlas，继续走 direct fallback，避免未来 `.lpp` 视觉语义变化。

`CuratedLiveRoomRenderer.draw()` 在 production 调用不传诊断参数时默认启用安全 atlas。Atlas 仍是惰性、renderer-owned、单张共享 texture；renderer dispose 时 backing store 归零。

最终隔离验收档：

- `GAME 30HZ · FULL + 1 ATLAS`：626 marks、5 warps、家具、龙、碰撞、60Hz movement 与 30Hz room rebuild 全部开启；
- 历史 `GAME 30HZ · + 2PX WARP (FULL)` 显式保留旧的逐帧 gradient 路径，继续作为同页 A/B 对照。

Owner 真机结果：

- `GAME 30HZ · FULL + 1 ATLAS` 丝滑；
- 主页 1A Hider 与 Seeker 均丝滑；
- 1C 与 6A 仍有轻微卡顿。

因此 1A 的 Phase 3R 修复通过。1C 与 6A 不再混成同一个问题：1C 继续走 curated renderer 的 atlas 扩展，6A 走 `UnfinishedMorningLiveRoomRenderer`，另立增量基准。

### Production atlas #9 — 1C Growth Marks

1C 的 616 marks：

- 160 个 firefly glow dots 已进入 atlas；
- 228 个 growth soft dots 与 228 个 growth soft streaks 此前仍逐帧创建 gradient；
- growth 使用 prepare 时采样的静态照片颜色，逐帧只改变 sway 位置，角度、softness、opacity 参数可继续保留。

同一 atlas 现扩展到颜色静态的 growth dot/streak：

- atlas cell 使用 `photoRed/photoGreen/photoBlue`，不是原始 mark color；
- `photoBlur` 在烘焙时合入 soft edge；
- streak 以椭圆 gradient 烘焙，逐帧仍按 authored angle 旋转；
- 位置 sway 与 layer alpha 继续逐帧计算。

不增加第二张 atlas，不创建 per-mark canvas。Owner 下一步只需在主页复测 1C Hider/Seeker 的移动与 growth/streak 外观。

Owner 真机结果：1C 丝滑。Curated 1A/1C 的移动性能工作通过。

### Live avatar #10 — Studio Draw-Calm and One Wave Atlas

新问题范围：

- Hider Studio 的 Live Brush 手指绘制时卡；
- 带 Live marks 的龙回到房间后动画也微卡；
- 这条路径属于 `LiveAvatarRenderer`，与已经修好的 curated room marks 不是同一个 renderer。

第一轮低风险修复：

- Live pointer 按住期间暂停 force render，只继续采集 canonical marks、更新 brush cursor 和数量；抬手立即恢复完整 Live 动画并一次性同步房间；
- `liquid-color` 原有六张常驻 organic stamp canvas 合并为一张 3×2 共享 atlas；六个 authored clouds、seed 选择和 ring geometry 不变；
- 最后一位 `LiveAvatarRenderer` dispose 时 atlas backing store 归零；
- `live-1a` 历史诊断按钮按 Baseline / Cadence / Marks / Final 四个 tabs 分组。

Owner 验收：

1. 横屏手机打开 Hider Studio，确认 Studio 覆盖完整可用视口且右侧工具可独立滚动；
2. 清空后分别用 liquid color、blue current、graphite whisper 连续画约 10 秒，判断手指按住期间是否丝滑；
3. 每种 brush 抬手回房间观察龙 10 秒，指出哪一种 brush/marks 组合仍卡；
4. 若仅房间龙仍卡，下一轮在 `live-6a` 增加按 brush/count 分组的 load-test tab，不再往 `live-1a` 堆按钮。

Owner 真机结果：

- Studio draw-calm 有效；`blue current` 与 `graphite whisper` 已经丝滑；
- 只有第六层的 `liquid color` 仍卡；
- 六张 wave stamp 合成一张 atlas 后仍卡，因此 texture/canvas 数不是 Liquid 剩余问题的充分解释；
- 第一层 brushes 尚未定稿，本轮禁止修改或拿第一层做性能结论。

### Live avatar #11 — 6A Liquid Pass Benchmark

Liquid 每个活动 mark 目前包含三个步骤：生成 organic ring mask、用
`destination-out` erosion、再以 `source-in` 从龙自身静态颜料中 re-lay。
下一轮只在 `live-6a` 拆这条路径，不再让 owner 重测已经通过的
`live-1a`：

- `Paint` tab 保留原第六层三支 brushes；
- `Liquid Bench` tab 使用固定 size/flow/seed 的 deterministic Liquid
  marks，mark 数用一个 20–320 slider 控制；
- benchmark tab 冻结 6A 房间 Live 动画，但继续绘制和拖动龙，页面显示
  `LiveAvatarRenderer.render()` 的 avg/p95 与实际 RAF fps；
- 五个 additive pass 是 `OFF BASELINE`、`EROSION ONLY`、`TINT RE-LAY`、
  `RE-LAY ONLY` 和 production 的 `FULL`；
- 进入 benchmark 时暂存 owner 的 Paint marks，退出时原样恢复；
- production renderer 默认永远是 `FULL`，游戏与 Studio 不调用诊断开关。

第一轮 owner 真机结论：

- 20 marks 不卡；
- 高数量 `RE-LAY ONLY` 与 `FULL` 卡，pigment re-lay 已被锁定；
- 原 `EROSION ONLY` 把整条龙擦空，无法观察拖动，不能把“没看见卡”记为通过。

第二轮只比较 320 marks：

1. `EROSION ONLY` 现在在 renderer 输出下方加一条不计入 avatar timing 的 24% 静态参考龙，仅用于观察拖动；
2. `TINT RE-LAY` 保留相同 organic mask、`source-in` 和 bounded 回贴，但把逐 mark transformed full-source `drawImage(sample)` 换成 bounded solid fill；
3. 若 TINT 丝滑而 RE-LAY 卡，根因就是逐 mark 的 full-source pigment sampling/composite，下一步改为一张 prepared pigment atlas；
4. 若 TINT 也卡，先优化/合并 mask + `source-in` pass，不提前建 atlas。

第二轮 owner 真机结论：`TINT RE-LAY` 与带参考龙的 `EROSION ONLY`
均卡。共同成本不是 full-source pigment sampling，而是每个 mark 都重新
建立 ring mask、在 512×512 scratch backing 上切换 composite，并把 bounded
区域回贴。下一轮不再继续拆颜色来源，改为验证合并 mask/batched erosion
与预烘焙 ring atlas。

第三轮新增两个单变量档位，production `FULL` 与原五档保持不变：

1. `BATCH EROSION`：六种 organic cloud 的 12 档环宽在同一张共享 atlas
   中预烘焙；一帧内所有活动 mark 只 source-over 合并成一张 scratch mask，
   最后对龙做一次 `destination-out`；
2. `BATCH TINT`：复用同一合并 mask，只做一次 `source-in` solid tint 和
   一次回贴；
3. atlas 仍然只有一个 canvas；不是每个粒子、颜色、页面状态或 ring 档位
   各养一套 canvas；
4. 若两档在 320 marks 下丝滑，便确认瓶颈是逐 mark mask/composite/blit，
   下一步才把 production `FULL` 改成批量 erosion + 批量 pigment re-lay；
5. 若仍卡，则继续拆“合并 mask 的逐 mark atlas draw”和“最后一次
   full-avatar composite”，不直接改 production。

第三轮 owner 真机结论：320 marks 下 `BATCH EROSION` 与 `BATCH TINT`
都丝滑。Liquid Bench 的 6A 房间背景继续故意冻结；共享 ring atlas 只作用
于龙自身的 Liquid mask。这个 A/B 已确认瓶颈就是逐 mark
mask/composite/blit，而不是 mark 数本身。

第四轮新增 `BATCH FULL`：同一张合并 mask 先对龙做一次 erosion，再以龙
自身静态颜料做一次共享的轻微 zoom/drift re-lay。原 production `FULL`
继续保留，待 owner 同时验收移动流畅度和 Liquid 外观后再替换。

第四轮 owner 真机结论：`BATCH FULL` 移动与 Liquid 外观均通过。该路径
正式提升为 production `FULL`，游戏与 Studio 默认使用共享 ring atlas、
单帧合并 mask、一次 erosion 和一次自身颜料 re-lay。旧逐 mark 完整路径
只留在 6A 的 `LEGACY FULL` 诊断按钮，不再进入正式游戏。

### Owner 决策闸门

- Hider 与 Seeker 的龙移动恢复到接近非 Live 的流畅度；
- 移动期间房间 Live 仍以约 30Hz 继续变化，不得出现 A/B #2 的长期冻结观感；
- 开始和停止移动时不得出现闪烁、房间帧跳变或 UI 残影；
- Hider/Seeker 的取色、分享预览和截图仍然包含完整房间；
- owner 通过后 Phase 3R 结束；若仍失败，保留此次证据并停止继续堆缓存，不重新打开 marks、像素量或家具复杂度猜测。

---

## Phase 4 — 非活动页面和 Studio 的生命周期清债

### 目的

清掉确定不合理但未被证明是本次卡死根因的常驻资源。这个 Phase 是维护性与内存治理，不再承担“修好 curated Live 性能”的任务。

### 范围

- Hider/Seeker route inactive 时停止自己的 RAF chain，重新进入时只恢复一次；
- Paint Studio 改为第一次打开时才构造，关闭时停止 Live loop，并释放可安全重建的大 backing stores；
- `document.hidden` 和被移动端全屏 Studio 覆盖时不做不可见绘制；
- inspection/backdrop/QR/export canvas 按用途惰性创建，用完可释放，不在模块加载时抢占 backing store；
- route 往返不得增加 listener、RAF、canvas 或 context 数。

### 明确取消的旧设计

- 不再为了数字上的“唯一 RAF”新增全局 `GameLoop`。一个当前活动的 GameCanvas loop 加上一个仅在 Studio 打开时存在的 Studio loop，生命周期正确即可；
- 不销毁并重建包含大量业务状态的整个 Scene，除非计数或内存证据证明 `setActive()` 不足；
- 不修改 renderer 视觉、`.lpp` 或 Art Lab。

### 自动验收

- 当前 route 之外没有活跃 GameCanvas RAF；
- Studio 未打开时不存在 Studio 实例及其工作 canvas；
- Hider → Seeker → Lobby 往返 20 次后资源计数回到同一基线；
- 页面静止且 Live 关闭时不持续 draw，后台页面不补跑积压帧。

### Owner 手动验收

- Hider → Lobby → Seeker → Home 往返 10 次；
- 打开/关闭 Studio、手机后台/前台切换各 10 次；
- 确认草稿、房间、角色位置和挑战状态没有因惰性生命周期丢失；
- 确认动画没有双倍速度或恢复两条 loop。

### 退出条件

Owner 通过。失败只回滚本 Phase，不影响已经通过的 Phase 2E 性能修复。

---

## Phase 5 — 固化 render ownership 与回归防线

### 目的

把本次真正有效的约束写成代码边界和回归测试，避免以后重新长出“每个特效一套 canvas”的 renderer。

### 长期约束

- curated room render graph 顺序固定为 room base → direct warps/marks → props/actors → HUD；
- `CuratedLiveRoomRenderer` 不得恢复 FX、layer、glow 持久 canvas 或逐帧全层 copy；
- renderer 不得按 mark、颜色、brush、room 或 route 创建 canvas；
- Phase 3 若通过，活动 GameCanvas 只有一个可见 canvas；若不通过，则活动游戏层硬上限为一个 Live underlay 加一个交互 overlay；
- Paint Studio 可以拥有有界的编辑工作层。它是按需打开的图像编辑器，不必为了“全站一个 DOM canvas”重写成 GameCanvas 的一个模式；
- Hider 和 Seeker 可以继续各有自己的 DOM canvas，只要同一时间只有当前 route 的 backing/render loop 活跃。

### 明确取消的旧 Phase 5

- 不再默认把 Hider、Seeker、Close Look、QR 和 Paint Studio 全部重写进同一个 `#game-canvas`；
- 不引入没有实际消费者的通用 `CanvasPool`；
- 以后只有新的测量证据证明 route canvas 或 Studio 工作层造成问题，才为那个具体用途提出独立重构。

### 自动验收

- source test 禁止 curated renderer 出现 `fxCanvas`、`layerCanvas`、`glowCanvas`；
- 1A/1B/1C 固定项目的 marks、strokes、warps、layer 和 adapter 数量不变；
- 连续运行、换房间、开关 Live、开关 Studio后 canvas/context 数不增长；
- fixed-time visual regression 覆盖 direct renderer 的 0s、1s、3s、7s；

### Owner 手动验收

- 在真实手机完整走一遍 Hider 作画、隐藏、分享、Seeker 寻找流程；
- 连续运行 10 分钟，检查卡顿、发热、触摸和页面切换；
- 对照 owner 原 `.lpp`，不接受为性能回归测试静默削弱效果。

### 退出条件

Owner 确认主游戏稳定后进入 Phase 6。Phase 5 不再要求“整个网站只有一个 canvas”这个与根因无关的数字目标。

---

## Phase 6 — Art Lab / `.lpp` 整合与向后兼容

### 目的

让 Art Lab 的作者工作继续产生可被单 Canvas 游戏 renderer 使用的作品，同时保证现有 `.lpp` 不作废。即使需要重写 Art Lab renderer/exporter，也不能要求 owner 重做已经完成的作品。

### 必须永久支持的现有输入

- `.lpp` ZIP container：`lucas-live-painting-project` v1；
- `artlab/document.json`：`artlab-live-doc` v3；
- 当前游戏生成物：`painterly-curated-live-project` v1；
- 已存在的 1A、1C 和其他 owner 保存的 `.lpp` 原文件。

### 兼容策略

建立单向、版本化的规范化管线：

```text
旧/新 .lpp
  -> versioned reader
  -> in-memory migration
  -> renderer-neutral LiveScene IR
  -> security/content validation
  -> 单 Canvas game runtime asset
```

- 旧 `.lpp` 只读入并在内存中升级；绝不要求批量覆写原文件。
- 新 Art Lab 必须能直接打开旧 v1/v3 项目。
- 新 exporter 优先继续写 v1/v3-compatible core，把新字段作为可忽略的 additive extension。
- 如果未来功能确实无法由 v3 表达，才增加新 document version；同时提供“兼容导出”，并让游戏 importer 同时接受旧版和新版。
- 当前 `scripts/import-live-painting.mjs` 保留为 legacy path，直到新管线对 golden `.lpp` 生成相同语义结果并经 owner 通过；不得先删旧 importer 再重写。
- Function Brush source 仍只能留在 owner 审计用 `.lpp`/Art Lab 中；游戏发布物只包含有界声明式数据和经过完整 SHA-256 审核的静态 adapter，继续禁止 `eval`/`new Function`。
- Painterly Chameleon 和 Art Lab 可以共享版本化 contract/fixtures，但游戏运行时不得依赖 Art Lab 网站或教育 portal。

### Golden compatibility suite

至少固定以下 fixtures：

- 1A Sunflower Parlor：626 marks、17 strokes、5 warps；
- 1B Starry Studio correction：1,233 marks、88 strokes、0 warps；
- 1C Cypress Bedroom final：553 marks、15 strokes、2 warps；
- 每一种已批准 adapter 至少一个最小项目；
- 一份仅旧字段的纯 v1/v3 项目；
- 一份包含 additive extension 的新项目。

对每个 fixture 验证：

- 原 `.lpp` SHA-256 保留并可追溯；
- 新 Art Lab 可以打开并播放；
- importer 不丢 layer、stroke、mark、warp、clock、blend 或 adapter revision；
- 在固定时间点（例如 0s、1s、3s、7s）生成视觉 golden，对比允许的像素/感知误差；
- 旧项目打开后另存为新项目，再导入游戏，语义和画面保持一致；
- 新项目可以选择 legacy-compatible export；
- 无法兼容的字段必须明确报错，禁止静默删除效果。

### 推荐实施顺序

1. 冻结 legacy fixtures 和 fixed-time visual goldens。
2. 写 versioned reader 与 `LiveScene IR` schema，不改 UI。
3. 让当前游戏 importer 先通过 IR 输出与现有 JSON 等价的结果。
4. 把 Art Lab preview 接到同一语义的 render kernel/contract。
5. 更新 Art Lab exporter，默认保持旧格式兼容。
6. Owner 用现有 1A/1C 原文件完成打开、编辑、保存、重开、导入、游戏播放全链路验收。
7. 至少保留一个发布周期的 legacy importer fallback，确认没有遗漏作品后再决定是否移除。

### Owner 手动验收

- 必须使用 owner 原始 `.lpp`，不能使用为了测试重新制作的替代项目。
- 1A 和 1C 在新 Art Lab 中打开后应立即正确播放。
- 做一个很小的编辑，保存，再重新打开并导入游戏。
- 与原版本并排查看；任何丢失效果、颜色、时间关系或 warp 区域都算失败。
- Owner 明确确认已有创作成果没有作废，Phase 6 才能通过。

## 最终完成标准

- curated Live 使用已由 owner 验收的 direct renderer，不恢复多层离屏 rebuild/copy；
- 活动 Scene 的 canvas/context 有明确 owner 与硬上限；Phase 3 决定上限是 1，还是有意分层的 2；
- 非活动 route 和未打开的 Studio 不保留活跃动画 loop；
- 没有按粒子、颜色、brush、room 或页面状态无限增长的 canvas/cache；
- 1A、1B、1C 和普通游戏流程通过 owner 的真实手机验收；
- 旧 `.lpp` 可继续在新 Art Lab 中打开、编辑、保存和导入；
- 所有自动测试和固定时间视觉兼容测试通过；
- 每个 Phase 都有 owner 的独立通过记录。
