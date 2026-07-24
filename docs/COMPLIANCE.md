# 艺术版权、儿童和 UGC 合规

> 这是产品工程清单，不替代针对发布国家、素材和商标的正式法律意见。

## 当前状态（2026-07-20）

- **版权审查已完成**：6 个房间的 `content/art-houses/<id>/provenance.json` 全部 `commercial_use: "approved"`（reviewer: Yanxiang Qin）。审查方法（五步法）存档于 [archive/RIGHTS-REVIEW.md](archive/RIGHTS-REVIEW.md)——**将来新增房间开卖前照此过审**。unfinished-morning 的 humanist-dome 房间是对《创造亚当》《雅典学院》（均公共领域）的**已声明致敬**，provenance 已如实记录。
- **命名**：owner 决定**保留** Van Gogh / Monet 房名（人已故 >70 年、无商标注册、全站无"官方/授权"字样 → 低风险；对外文案用 "inspired by / 致敬"）。
- **收费上线前仍缺的合规件**（随 $2.99 解锁真卖 / Apple 上架前补齐）：
  1. 隐私政策 + 退款/服务条款页面。
  2. 网页购买前家长门（Apple 版无内购，不触发 IAP 家长门，但其余儿童规则照守）。
  3. 扩大公开曝光前（买量/平台导流/媒体）：角色图像的自动异常检查 + 儿童 UGC/供应商（Cloudflare 等）COPPA 数据流审查——继承自已归档的 PUBLIC-CHALLENGE-PLAN，其三项技术闸门（Turnstile、签名 session 限流、举报/隐藏+管理员队列）已完成。

## 1. 版权判断必须拆成不同层

一个“梵高房间”可能同时涉及：

1. 梵高原始绘画本身的版权状态。
2. 博物馆或摄影师制作的现代扫描/照片的使用条款。
3. 由团队新画的房间、角色、UI、动画和声音。
4. 艺术家姓名、博物馆名称、Logo 和商品来源暗示。
5. 在不同发布国家适用的版权期限、人格权和商标规则。

梵高的许多原作在美国等地区通常已进入公版，但这不等于网上找到的任何高清图都可以直接商用。必须从明确允许商业使用的来源取得图像，或根据公版原作自行重绘/生成新的表达，并保存证据。

毕加索不应列为近期默认房间。其作品远比梵高、莫奈更可能仍受版权或权利管理约束，只有在逐项获得许可后才进入商业计划。

## 2. 房间命名策略

> 2026-07-20 决定：现有 Van Gogh / Monet 房名**保留**（见"当前状态"）。以下为将来命名新房间时的默认原则。

正式发布前更安全的默认方式是描述风格和场景，而不是把艺术家姓名当作商品品牌：

- `Starry Provençal Bedroom`，而不是直接声称官方“Van Gogh Room”。
- `Impressionist Water Garden`，而不是暗示与某博物馆或基金会合作。
- `Geometric Atelier` 只有在所有具体素材原创且不复制受保护作品时使用。

营销文案不得使用“官方”“授权”“博物馆版”等容易制造来源混淆的表达，除非确有书面授权。

`Painterly Chameleon` 本身也是工作名，发布前要搜索游戏商店、域名和相关类别商标。

## 3. 每项资产的 provenance 台账

每个 production asset 至少记录：

| 字段 | 内容 |
|---|---|
| asset_id | 稳定的内部 ID |
| file_path | 仓库路径 |
| underlying_work | 底层作品名称、作者、创作/发表年份 |
| source | 原始来源页面，不只记录图片 CDN URL |
| source_owner | 博物馆、档案馆、团队成员或供应商 |
| license_or_terms | 许可证或条款版本与获取日期 |
| commercial_use | yes / no / unclear |
| modifications | 裁剪、重绘、组合、AI 辅助等 |
| human_author | 具体人工创作贡献 |
| reviewer | 谁核验、何时核验 |
| release_status | prototype / cleared / blocked |

页面和许可条款可能变化。重要素材要保存当时条款的 PDF、截图或文本快照，但不要把不允许再分发的高清原图提交到公共仓库。

## 4. AI 素材

AI 可以作为生产输入，但不能把“我写了 prompt”当作完整、可独占的版权链。要保留：

- 使用的工具、日期、模型和输入素材权限。
- 人工选取、组合、修改、重绘和排版记录。
- 不把在世艺术家或受保护角色的明确模仿作为商业卖点。
- 训练来源未知的输出仍要做相似性和品牌审查。

最终房间应体现可说明的人工创作决策，并避免与竞品的角色轮廓、房间构图、UI、动画、音效和宣传文案高度相似。

## 5. 用户绘画内容

Hider 的绘画属于用户生成内容，即使只保存 24 小时也需要保护措施：

- 分享链接使用高熵 token，默认不被搜索引擎索引。
- 只有 24 小时、可举报和撤回的最小 Explore 列表与固定词库名称搜索；没有聊天、评论或用户输入的自由文本标题。
- Hider 可立即删除，Seeker 可举报。
- 内容过期时 payload 和单次尝试一起删除。
- 日志、错误追踪和分析工具不得复制完整 payload。
- 发布前显示简短规则：不得绘制违法、仇恨、性或侵权内容。
- 对重复滥用保留最小化的短期安全信号，并设明确保留期。

24 小时 TTL 会降低暴露面，但不会自动免除内容政策、下架流程或平台 UGC 要求。

## 6. 儿童和家庭使用

孩子愿意试玩是积极信号，但“孩子能玩”和“产品专门面向 13 岁以下儿童”会带来不同的合规成本。

MVP 采取数据最小化：

- Seeker 无账户，不收姓名、邮箱、生日或聊天。
- 不接广告、行为画像或不必要的第三方分析 SDK。
- 购买者是成人，儿童不持有支付余额。
- 不使用跨站或长期设备标识来识别孩子。
- 只收为防滥用所需的短期技术数据，并写清保留期。

当前 Turnstile 只在用户主动发布或举报时按需加载，普通 Seeker 游玩和 Explore 浏览不会加载 widget；token 必须由 Worker 调用 Siteverify 验证，且不把 IP、token 或 Turnstile 结果写入 D1。匿名 session cookie 为 HttpOnly、SameSite、24 小时，不包含账户或设备指纹。若产品明确面向 13 岁以下儿童，正式扩大流量前仍必须把 Cloudflare 作为供应商纳入 COPPA/隐私数据流和合同条款审查，不能因为不显示广告就跳过供应商检查。

如果 Lucas Academy 明确把该游戏作为面向 13 岁以下儿童的服务，应在正式开放前完成 COPPA 数据流盘点、家长同意方案、供应商审查、隐私政策和删除请求流程。Discord 的受众和账户年龄边界也意味着它不能替代儿童版入口。

## 7. 发布前闸门

每个艺术房间必须全部通过才可收费：

- 底层作品权利状态已核验。
- 使用的扫描、照片、纹理、字体、音乐和声音允许商业使用。
- 台账完整，可追溯到来源和条款日期。
- 没有暗示艺术家遗产机构、博物馆或第三方背书。
- 与直接竞品的具体表达明显区分。
- 目标发布国家的关键差异已评估。
- 商店截图、预告片和文案使用的素材也在台账内。
- 完成一次发布前 IP/商标复核。

## 8. 推荐的首发内容策略

先做一个权利链最干净的免费房间：使用确认为公版的底层作品、允许商业复用的源图，或团队自行重绘的原创房间。高级房间按“来源是否清楚”和“玩法是否有差异”排序，而不是按艺术家知名度排序。

这会让合规成为内容生产管线的一部分，而不是上线前才补的一次检查。

## 官方参考

- [美国版权局：Games](https://www.copyright.gov/register/tx-games.html)
- [美国版权局：Copyright and Artificial Intelligence, Part 2](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)
- [FTC：COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [Van Gogh Museum：馆藏图像使用条款](https://www.vangoghmuseum.nl/assets/05aed642-6e2a-46e6-bb93-3a6826d63e91/Conditions-for-Use-of-Collection-Images-Van-Gogh-Museum-2022?c=1ae93a4fe2d6eb2875672ed16d59058741397476be6cd1c15ca16cc5e924d786)
