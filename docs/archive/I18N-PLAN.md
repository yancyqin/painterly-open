# i18n 架构计划

> **已归档 2026-07-20** — 16 语言已全部上线。长期规则(新 key 必须补全 16 语言、房间名不翻译等)已并入 ../ARCHITECTURE.md 的 i18n 一节。

## 当前状态

已启用 16 种语言：英语、简体中文、繁体中文、西班牙语、法语、德语、巴西葡萄牙语、日语、韩语、意大利语、俄语、阿拉伯语、印地语、印度尼西亚语、土耳其语和泰语。英语同步加载，其余 catalog 按 locale 动态加载；阿拉伯语自动使用 RTL。

客户端已有：

- `src/i18n/`：类型化英文消息目录、逐语言 catalog、locale 解析、插值和 DOM 文案挂载。
- `data-i18n`：HTML 壳层使用稳定 message key，不把英文当 key。
- `t(key)`：TypeScript 动态状态可复用同一消息目录。
- `?lang=`：为平台适配器和 QA 预留显式 locale 输入；不支持的值安全回退英文。

## 语言选择顺序

当前选择顺序：

1. 已验证的平台适配器传入的 locale。
2. URL 中显式的 `lang`（测试、iframe 和分享落地页）。
3. 本机明确保存的选择；账户验证时同步为 `preferred_locale`。
4. `navigator.languages`。
5. 英文回退。

分享链接默认不固定创建者语言，让接收者按自己的环境显示；只有课堂或平台容器明确要求时才附带语言。

## 文案规则

- 不拼接可见句子；复数、性别和语序通过完整 message/`Intl.PluralRules` 处理。
- 日期、相对时间和数字使用 `Intl.DateTimeFormat`、`Intl.RelativeTimeFormat` 和 `Intl.NumberFormat`。
- API 返回稳定错误 code 和诊断英文；客户端按 code 映射本地化用户文案。
- Canvas 内需要显示的可见文字必须由 DOM overlay 或消息目录提供，不能烘焙进背景图。
- 艺术房间标题、艺术家说明和合规 attribution 与 UI 文案分开建 catalog namespace。
- 支付产品名和商店描述由各平台本地化资源管理，不直接复用按钮文案。
- 两词挑战房间名是刻意的跨语言识别码：始终使用同一套简单英文词库，不翻译；搜索框、状态和操作文案仍按当前 locale 翻译。

## 文件结构（加入翻译时）

```text
src/i18n/
  index.ts
  en.ts
  zh-Hans.ts
  ...
```

非英文 catalog 必须满足英文 key 的完整类型，构建时拒绝缺 key。大 catalog 使用按 locale 动态导入，英文保留为同步 fallback，避免所有语言进入首屏包。

## 上线前 QA

- 先用伪本地化检查 30–40% 文案膨胀、窄屏按钮和 inspection 控件。
- 为 RTL 预留 `dir`，布局使用逻辑属性，角色朝向和移动方向不跟随文字方向反转。
- 检查键盘提示在触屏平台是否需要隐藏，平台按钮名称是否不同。
- 每个正式 locale 至少人工走通创建、绘画、发布、分享、寻找、结果、账户和购买恢复。
