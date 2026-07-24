# Art-house content

这里存放平台无关的艺术房间定义和资产来源台账。`van-gogh-house`、`monet-garden-house`、`outdoor-masters-journey`、`world-remembers-color` 与 `luminous-tide-dreamscape` 垂直切片已经迁入，但所有迁入资产默认仍是 `prototype`，不能因为进入商业仓库就视为已清权。

## 计划中的房间包结构

```text
<art-house-id>/
  manifest.json
  provenance.json
  scenes/
  props/
  brushes/
  audio/
  locale/
```

`manifest.json` 描述运行时内容：

- 稳定 `art_house_id` 和内容版本。
- 场景、碰撞区域、前景/背景层和安全点击区域。
- 允许的角色、道具和创意画笔。
- 资源哈希、尺寸和预加载优先级。
- 可本地化的显示键，不直接写营销名称。

`provenance.json` 描述发布权利：

- 每个底层作品、扫描、纹理、字体、音频和生成素材的来源。
- 作者、年代、许可证/条款、商业使用判断和核验日期。
- 人工修改与创作贡献。
- `prototype`、`cleared` 或 `blocked` 状态。

构建流程只允许 `cleared` 资产进入 production 包。商业产品的内容包可导出为 Snake Lab 能消费的格式，但 Snake Lab 不是本仓库的运行时依赖。

当前 playtest 例外：`src/game/assets` 可以包含 `prototype` 资产供本地/受控验证；公开收费构建必须增加清权构建闸门。
