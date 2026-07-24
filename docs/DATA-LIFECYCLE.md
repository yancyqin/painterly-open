# D1 数据与 24 小时生命周期

## 核心原则

24 小时 TTL 是产品承诺，不只是省钱技巧：挑战在发布后恰好 24 小时不可访问，随后从在线业务表中尽快物理删除。

D1 没有为普通表行自动提供 TTL。因此要同时实现两层：

1. **同步硬过期**：每次读取、提交尝试和查看结果都检查 `expires_at`；过期立即返回 `410 Gone`。
2. **异步物理清理**：Worker Cron 每小时删除过期挑战，外键级联删除尝试。

即使 Cron 延迟，用户也无法访问过期内容。删除延迟最多影响短暂存储量，不影响产品承诺。

D1 的 Time Travel 由平台自动开启；免费计划可恢复最多 7 天内的数据库状态。因此“24 小时删除”应准确表述为：24 小时后应用不可访问，定时任务从在线数据库删除，Cloudflare 管理的灾难恢复历史再按平台窗口自然滚出。不能对外承诺所有备份副本在第 24 小时立即消失。

## 数据分类

| 数据 | 保留期 | 原因 |
|---|---:|---|
| 未发布草稿 | 仅本地 | 不占服务器，不产生分享风险 |
| 已发布挑战 payload | 24 小时 | 核心分享内容 |
| Explore 公开 token | 随挑战删除 | 默认公开、未取消勾选的挑战需要可列出的游玩链接 |
| 两词房间名与搜索规范值 | 随挑战删除 | 固定词库组合，不是用户输入的自由文本 |
| 单个 Seeker 尝试 | 随挑战删除 | 只服务本次挑战结果 |
| 挑战汇总 | 随挑战删除 | Hider 只在挑战有效期内查看 |
| 匿名每日指标 | 90 天后汇总/删除 | 产品验证，不含绘画或身份 |
| 购买/退款事件 | 按财税和平台要求 | 不能因挑战到期而丢失 |
| 房间 entitlement | 购买有效期 | 永久房间需要恢复购买 |
| 成人账户和已验证 identity | 账户有效期 | 跨平台登录与未来恢复购买；不用于匿名 Seeker |
| OTP / 账户 session | OTP 10 分钟；session 最长 90 天 | 无密码登录；D1 只保存哈希，注销可撤销 |
| 当前匿名举报记录 | 随挑战删除，最长 24 小时 | 只驱动短期 Explore 隐藏，不建立长期儿童设备画像 |
| 管理员审计记录 | 最多 30 天，必要时更短 | 保存最小固定操作，不保存自由文本 |

## Schema 事实来源

实际结构以 `migrations/` 为唯一事实来源（权益表见 `0005_accounts_and_art_houses.sql`，product_id 制的 `entitlements`）。早期推导样例已删——它与已部署结构分歧越来越大，容易误导。仓库已恢复 `0009_lobby_preview.sql` 与线上迁移历史对齐；部署新 Worker 前继续先应用后续 migration（当前为 `0010_live_painting.sql`）。

## 发布事务

1. 校验 Hider 对 `art_house_id` 的 entitlement；免费房间跳过购买检查。
2. 校验 payload 版本、尺寸、坐标和允许的画笔类型。
3. 服务端生成 challenge ID、原始 invitation token 和哈希。
4. 设置 `created_at = now`，`expires_at = now + 86400`。
5. 只返回一次原始 invitation token，客户端组成分享链接。

挑战发布后不可修改。若 Hider 想调整内容，删除旧挑战并发布新挑战，从而避免多个 Seeker 看到不同版本。

当前 Explore 验证不复制挑战数据，也不延长生命周期。发布表单默认公开，但 Hider 可取消勾选；公开时同一行写入 `public_token`，取消时该字段为 `NULL`，数据库仍只有不可逆的 `token_hash`。每行还保存服务端校验过的 `room_name` 与小写 `room_name_search`；后者使用部分索引支持一至两词的前缀范围查询。名称不是用户输入的自由文本。列表和搜索查询只返回 token、房间名、创建/过期时间和尝试汇总，完整 payload 仍在 Seeker 打开单个挑战后才读取；相同边缘节点的相同查询缓存 60 秒。

当前 moderation 采用刻意保守的短 TTL 规则：`moderation_status` 默认为 `visible`；首次有效的固定原因举报写入 `challenge_reports` 并改为 `hidden`，Explore 查询只选 `visible`。隐藏不会删除挑战，私人邀请链接在剩余 24 小时内仍可玩；Hider 也可把 `public_token` 清空，主动撤出 Explore。举报不含自由文本、姓名、邮箱或 IP，随挑战级联删除。管理员可在独立受保护队列中恢复或确认隐藏；`moderation_reviewed_at` 让已处理项目退出待办队列。管理员操作只保存 challenge 内部 ID、固定 action、举报数量与固定原因汇总，30 天后由 cron 删除。

发布、举报、结果提交和 OTP 使用 Cloudflare Workers Rate Limiting binding，分别是每个服务端验证过的 session subject 每分钟 6、10、60、6 次。匿名 session ID 由 Worker 随机生成、用 HMAC 签名并放入 24 小时 HttpOnly、SameSite cookie；签名密钥只存在 Worker secret 中。匿名 session 不写入 D1，也不包含 IP、用户名或设备指纹。用户仍可清除 cookie 获得新匿名 session，因此发布、举报和 OTP 请求另外强制 Turnstile。

成人 Hider 的 email OTP 哈希只保留 10 分钟；验证成功后删除。账户使用内部 `account_id`，邮箱只作为 `auth_identities(provider='email')` 的已验证 subject，未来 Discord/Facebook 等平台 subject 可作为新的 identity 关联，不改变游戏主键。账户 session 原始 token 只放在 90 天 HttpOnly、Secure、SameSite cookie，D1 只保存 token 哈希；过期/撤销 session 和过期 OTP 每小时清理。匿名 Seeker 不读取账户表，也不收集邮箱。

## 读取和提交

挑战读取必须等价于：

```sql
SELECT ... FROM challenges
WHERE token_hash = ? AND expires_at > ?
LIMIT 1;
```

查不到时可在应用层区分无效 token 与已知过期记录，但对匿名用户不应泄露额外信息。提交尝试时再次检查过期时间，不能信任客户端的开始时间或 elapsed time；服务端至少校验合理范围和重复提交。

## Cron 清理

每小时运行，按小批次删除，避免一次大事务：

```sql
DELETE FROM challenges
WHERE id IN (
  SELECT id FROM challenges
  WHERE expires_at <= ?
  ORDER BY expires_at
  LIMIT 500
);
```

如果仍有 500 行被删除，Worker 可在单次 scheduled handler 内继续有限批次；剩余数据下一个小时再处理。`expires_at` 必须有索引，否则清理和读取都会浪费行读取额度。

删除操作也计入 D1 的 rows written。免费额度为每天 100,000 行写入，因此要监控挑战、尝试、索引更新和过期删除的合计，而不只看新建挑战数。

## 容量粗算

按“压缩头像 + 小型坐标元数据”20 KB 的规划值和 60 KB 的客户端硬上限分别粗算：

- 1,000 个同时有效挑战约 20 MB；最坏图像上限约 60 MB。
- 5,000 个同时有效挑战约 100 MB；最坏图像上限约 300 MB。
- 10,000 个同时有效挑战在规划值下约 200 MB，已经不应继续靠估算运行。
- 免费 D1 单数据库 500 MB，不能把 5 GB 账户总额度误当作单库上限。

实际还有 base64/JSON 膨胀、表、索引和尝试开销，所以当数据库达到约 100–150 MB 就应重新测量并做容量计划，而不是等到上限。优化顺序：降低头像分辨率/质量、改二进制存储、减少重复数据、把大 payload 移到 R2；不要先延长 TTL。

## Lucas Academy D1 的正确用法

可以使用同一个 Cloudflare 账户的免费 D1 能力，但建议：

- 新建 `painterly-chameleon-dev` 和 `painterly-chameleon-prod`。
- 不给游戏 Worker 绑定 Lucas Academy 的数据库。
- 每个环境使用不同 binding 和数据库；访问令牌和密钥绝不提交。平台部署配置需要的资源 ID 不是访问凭证，但应明确区分开发与生产。
- 在 Cloudflare dashboard 分数据库查看 rows read、rows written 和 storage。
- 设置 50%、75%、90% 使用量告警或人工周检。

免费计划目前是账户合计每天 500 万行读取、10 万行写入、5 GB 总存储；同时每个免费数据库最大 500 MB，账户最多 10 个数据库。达到每日读写上限时查询会失败直到 00:00 UTC 重置，因此上线前仍需设计清晰的升级开关。

官方依据：[D1 计费](https://developers.cloudflare.com/d1/platform/pricing/)、[D1 限制](https://developers.cloudflare.com/d1/platform/limits/)、[Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) 和 [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)。
