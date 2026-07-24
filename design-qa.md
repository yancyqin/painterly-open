# Design QA — Hider Studio Live Brush parity

- Source visual truth: `/Users/yqin/.codex/visualizations/2026/07/21/019f823f-2939-7481-a2c7-165d001db168/painterly-chameleon/live6a-reference.png`
- Implementation screenshot: `/Users/yqin/.codex/visualizations/2026/07/21/019f823f-2939-7481-a2c7-165d001db168/painterly-chameleon/hider-studio-live.png`
- Focused comparison: `/Users/yqin/.codex/visualizations/2026/07/21/019f823f-2939-7481-a2c7-165d001db168/painterly-chameleon/live-brush-comparison.png`
- Viewport: 1280 × 720 CSS pixels.
- State: 6A Live Brush reference and the production Hider Studio Live Brush tab, Flat pose, Live on, fixed reviewed force strength, Size 26 on the Studio's 256px canvas (equivalent to Size 52 on 6A's 512px canvas), Flow 68.

**Findings**

- No actionable P0, P1, or P2 mismatch remains in the scoped force behavior. The production renderer now uses 6A's normalized seed, per-brush size ratios, mark spacing, randomized angle, opacity curve, gradients and half-scale motion distances.
- The different base avatar treatment is intentional: 6A displays the authored full-color Flat PNG, while Hider Studio starts from its ivory painting base. Live marks sample whichever finished paint is present underneath them.
- Fonts and typography: unchanged; this pass does not alter Studio type.
- Spacing and layout rhythm: unchanged. The Live controls remain inside the existing Studio panel and no controls overflow at the captured viewport.
- Colors and visual tokens: force marks introduce no color; they preserve the sampled paint RGB. The cursor keeps the existing Paint/Live ring colors and adds only a small translucent white center cross.
- Image quality and asset fidelity: the supplied Flat avatar asset and existing Studio ivory conversion remain intact; no replacement assets or filters were introduced.
- Copy and content: unchanged.

**Open Questions**

- None for this scope.

**Implementation Checklist**

- [x] Normalize persisted integer seeds back to 0–1 before force animation.
- [x] Match 6A brush size, flow, spacing, angle and fixed-strength behavior at half resolution.
- [x] Keep Live Brush force-only and sample finished paint color.
- [x] Add a centered translucent white cross to Paint and Live cursor rings.
- [x] Keep the 6A page unchanged during this correction pass.

**Comparison History**

- Pass 1 found two P1 behavior mismatches: production used raw 0–65535 seeds in drift math, and its brush sizes omitted 6A's half-scale/per-brush ratios. This made Petal Drift unstable and the other effects visibly oversized.
- Pass 2 fixed both mismatches and captured the production Hider Studio component. The focused comparison confirms equivalent relative mark scale and the expected intentional ivory-base difference. The centered cursor cross was checked in both Paint and Live tabs.

**Follow-up Polish**

- None required for the requested parity pass.

final result: passed
