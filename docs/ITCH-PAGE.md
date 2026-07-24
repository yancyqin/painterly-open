# itch.io 页面（导流 / 免费试玩）

## 定位
itch.io **不做付费墙**。原因：painterly 是要连后端（Worker + D1）的网页应用；itch 的 HTML5
浏览器游戏原生付款基本只有"捐赠"，真付费只有"可下载"结构，而下载版跑不起后端。而且和网页版
免费玩的是同一份内容，锁在 itch 付费墙后没人会买。

所以 itch = **免费曝光 + 试玩 + 链接回 `pc.lucasacademy.org`**（发行顺序第 1 步，见 DECISIONS.md D-015）。收费在别处：
- **网页**：$2.99 一次解锁全部藏房（Stripe，见 MONETIZATION-BUILD.md）；来找永远免费。
- **App（之后）**：Apple 付费 App，$2.99 一次性买断，**无内购**。
- **itch**：Free / "Name your own price"（允许打赏支持），不锁内容。CrazyGames/Poki 不上（不要广告门户）。

## 页面怎么建（不需要那个 key）
1. 在 itch 后台建项目，Kind = HTML。
2. 最省事：**不上传可玩 build**，正文放截图/GIF + 一个大按钮"▶ 免费在线玩"链接到 `https://pc.lucasacademy.org`。
3. 价格设 Free 或 "Name your own price"。
4. `butler` 和那个 itch API key **这一步用不到**（页面在网站后台手建；key 只在将来真上传可玩 build 时才需要）。

## 封面 & 截图清单（你截或我从预览出）
- **封面 630×500**（itch 要求）：一间房 + 半隐的变色龙。
- 截图 3–5 张：大厅（6 个房间卡）、上色画室（关伪装的默认龙 vs 上好色的对比）、寻找页的近看、找到瞬间。
- 可选 15 秒 GIF/短视频：上色 → 藏 → 分享 → 找到。
- 标签：`hide-and-seek` `painting` `casual` `relaxing` `multiplayer`(async) `browser` `family-friendly`。
- 分级：全年龄。

## 文案（EN）
**Title:** Painterly Chameleon
**Tagline:** Paint a chameleon, hide it inside a famous-painting room, and dare a friend to find it.
**Short:** A calm hide-and-seek toy. Paint your chameleon to blend into a Van Gogh parlor, a Monet garden, an unfinished fresco… then send a 24-hour link. No install — plays in any browser.
**Body:**
- 🎨 Paint & camouflage — borrow the room's own colors, light and edges.
- 🫥 Hide — place your chameleon anywhere in the room.
- 🔗 Share — a link any friend opens in a browser; one hide, many seekers.
- 6 painterly art houses · 16 languages · no ads · no account needed just to play.

**▶ Play free:** https://pc.lucasacademy.org
_Support the next room:_ https://ko-fi.com/yancyqin

## 文案（ZH）
**标题：** 绘画变色龙
**一句话：** 给变色龙上色，把它藏进名画房间，让朋友来找。
**简介：** 一个安静的捉迷藏小玩具。把变色龙涂成融进梵高客厅、莫奈花园、未完成壁画的样子，
再发一条 24 小时链接。免安装，任意浏览器可玩。
- 🎨 上色伪装 —— 借用房间自己的颜色、光影和边缘。
- 🫥 藏起来 —— 把变色龙放在房间任意角落。
- 🔗 分享 —— 一条链接，朋友在浏览器就能玩；一次藏，多人找。
- 6 个绘画房间 · 16 种语言 · 无广告 · 玩不需要账号。

**▶ 免费在线玩：** https://pc.lucasacademy.org

## 上线闸门
- 直接网页的"发布→打开→开始→完成"漏斗已稳定（现已线上=最新版 ✅）。
- 页面文案不暗示官方/美术馆背书（用 "inspired by/致敬" 措辞，见 COMPLIANCE.md）。
- 不在 itch 偷偷打开外部付费；付费一律走网页/App 的合规结账。
