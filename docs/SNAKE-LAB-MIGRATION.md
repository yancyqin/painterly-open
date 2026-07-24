# Snake Lab 内容迁移记录

## 来源

- 源仓库：`/Users/yqin/repo/playground/snake-lab`
- 源提交：`5bc38bf`（Save updated Van Gogh room geometry）
- 迁移日期：2026-07-17
- 目标：建立不依赖 Snake Lab 的异步 Painterly Chameleon 垂直切片。

迁移时 Snake Lab 工作树干净；本次只读取源仓库，没有修改它。

## 迁入内容

- Van Gogh House 的 3 个房间、每间 A/B/C 表面，共 9 张背景。
- 当前布局使用的家具 v1/v2/v3 绘画版本，共 81 张 PNG。
- `stand`、`curl`、`flat` 三种原始角色姿态。
- 房间布局 JSON、艺术色板、默认伪装生成和 Canvas 绘画合成。
- PaintStudio 的姿态、色板、自定义颜色、吸色器、撤销和 6 种手动画笔。

## 首次迁移明确没有迁入

- `CodeBrushSandbox.ts` 以及所有 Code Brush UI/预设。
- Snake Lab portal、游戏 manifest、课程或教育文案。
- `ChameleonRoom.ts`、`ChameleonState.ts`、Colyseus、WebSocket。
- `PredictedSelf`、实时移动同步和多人同时阶段机。
- `RoomEditorScene.ts`、建模工具和服务端碰撞框架。
- Monet 和其他尚未进入免费首房间的素材。

## 2026-07-18：Monet Garden House

- 来源提交：`ee09852f4ee9`（`Add World Remembers Color art house`）。
- 只读取 Snake Lab；保留其未提交的 `outdoor-triptych-layout-0.json`，没有修改。
- 迁入 3 张 960×640 房间背景、33 张透明家具 PNG 和 1 份 Editor 布局 JSON。
- 没有迁入 `assets-src` 模型、编辑器、Code Brush、课程、WebSocket 或第三层艺术房间。
- 目标仓库用自己的 runtime registry、碰撞和 payload 类型加载内容；Snake Lab 不是运行时依赖。
- `content/art-houses/monet-garden-house/provenance.json` 记录素材清单和商业发布前的阻断检查。

## 2026-07-18：Outdoor Masters Journey（第三层）与 Color Rebirth（第四层）

- Outdoor 来源提交：`3feac00a6174`（`Save outdoor polygon door layout`）；迁入 6 张 v1/v2 户外背景、49 张透明道具 PNG 和 1 份 Editor 布局 JSON。
- Outdoor runtime 只加载 3 张 v2 背景；布局保留 13 个实际物件、三块可行走地面、多边形传送门触发区与出生点。布局 JSON 已逐字节核对。
- `content/art-houses/outdoor-masters-journey/provenance.json` 和 `src/game/assets/CREDITS.md` 记录了该房间仍需完成的商业清权检查。
- Color Rebirth 第四层随后在 source commit `f74595c3ce6e3c970b1e407679d11acdc92b1f31` 完成显式同步：迁入更新后的 Four Seasons / Canvas Islands 背景、36 张 V2/V3 工作台道具变体（共 58 张 PNG）、最终 16 物件布局、地面 / 传送门 / 出生点和两块编辑器碰撞区。Painterly runtime 同步使用稳定 seed 为可变体物件选 V1/V2/V3，并读取这两块布局碰撞区；Outdoor 也在同一提交复核为逐字节一致，无需重复复制。
- 两层均只使用 Painterly 自己的 asset registry、HTTP challenge payload 与本地碰撞/传送门逻辑；没有迁入编辑器、Code Brush、课程或 WebSocket。

## 2026-07-19：The Tide Dreams in Starlight（第五层）与不规则碰撞

- 来源提交：`755206b894a0702d61a81743abd09ae5f403b809`（`Finish luminous tide art house variants`）。迁入 3 张 960×640 夜色房间背景、18 张透明道具 PNG（6 个道具各有 v1/v2/v3）和 1 份 Editor 布局 JSON；素材与布局均逐字节核对。
- `luminous-tide-dreamscape` 的布局包含三块可行走地面、出生点、多边形门触发区，以及 9 块不规则世界碰撞区。Painterly 原本已读取多边形门入口；这次运行时也读取 `collisionPolys`，使用角色脚底框与多边形的包含/边相交检测，保留“刚好贴边可以走”的既有矩形碰撞语义。
- 没有迁入 Room Editor、模型源文件、Code Brush、课程、实时服务或 WebSocket。第五层和已发布的后续房间一样暂时为登录后免费验证内容；`content/art-houses/luminous-tide-dreamscape/provenance.json` 保留商业发布前的权利阻断检查。

## 2026-07-19：The Unfinished Morning（第六层）

- 来源提交：`bc48256f6b8ec23569ce9bb70049c672b3f31a12`（`Complete Unfinished Morning art variants`）。迁入 9 张 960×640 房间背景（3 间房 × v1/v2/v3 三个"背景研究"，由 surface 种子选择）、14 张透明道具 PNG（4 组人文主义人物各 v1/v2/v3 + 2 个 6C 园林锚点 v1）和 1 份 Editor 布局 JSON；素材与布局均逐字节核对。
- 三间房：6A Blank Canvas Morning（无道具，未完成的素描本身就是伪装课）、6B Humanist Dome（4 组深度排序的人物道具，脚点碰撞保持台阶可走）、6C Ten-Thousand-Forms Handscroll（原烤入背景的假山与石亭重建为两个透明道具）。
- 首次用到布局内 `collisionPolys` 之外的**每实例碰撞 pad**（`props[].collision.padLeft/...`）——Painterly 运行时早已支持（`propCollisionRects` 的 override 分支），本层是第一份真正使用它的布局。新增 6 个道具模型规格移植进 `PROP_SPECS`（宽/高/深与碰撞矩形照抄 Snake Lab `roomModels.ts`，阴影按 Painterly 惯例补配）。
- 没有迁入 Room Editor、First Mark code-brush 课程、实时服务或 WebSocket。第六层与其他后续房间一样暂时为登录后免费验证内容；`content/art-houses/unfinished-morning/provenance.json` 保留商业发布前的权利阻断检查。

## 2026-07-23：Outdoor Masters Journey 3C 位置修正

- 来源提交：`06c9790`（`Fix Outdoor Masters 3C doorway geometry`）。
- 只同步 `outdoor-triptych-layout-0.json` 中 3C 的右侧入口多边形与可行走地面坐标；不迁入 Snake Lab 编辑器、实时服务或其他内容。
- 目标布局与该来源提交逐字节一致，并继续由 Painterly 自己的碰撞、传送门与异步 challenge runtime 使用。

## 有意改变的玩法

Snake Lab 原型是实时房间；商业切片是不可变异步谜题：

- Hider 不等待 Seeker，也不受绘画倒计时限制。
- Seeker 不需要控制另一个实时角色；在三间房中切换并点击找到目标。
- 同一 challenge 可以被任意数量 Seeker 独立完成。
- 每个 Hider 可以同时创建自己的 challenge；它们是互相隔离的 D1 行。
- 所有状态通过 HTTP 创建、读取和提交，不需要同时在线或 WebSocket。

## 后续同步规则

从此提交开始，两个仓库不再互相复制整个目录：

1. 商业玩法、payload codec 和权利台账以本仓库为准。
2. Snake Lab 若需要新房间内容，使用未来的显式导出产物。
3. Snake Lab 独有的教育工具和 Code Brush 不反向进入商业客户端。
4. 每次再迁移旧素材，都记录源提交、文件清单和 provenance 状态。
