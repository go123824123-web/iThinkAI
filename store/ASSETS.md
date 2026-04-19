# Chrome Web Store 素材清单

---

## ✅ 必需素材（Required）

| 素材 | 规格 | 数量 | 状态 |
|------|------|------|------|
| 图标 (Icon) | 128×128 PNG | 1 | ✅ 已有 `icons/icon128.png` |
| 小宣传图 (Small Promo Tile) | 440×280 PNG/JPG | 1 | ✅ 已生成 `promo_small_440x280.png` |
| 截图 (Screenshots) | 1280×800 或 640×400 PNG/JPG | 1-5 | ⚠️ 已生成占位图，**建议替换为真实截图** |

---

## 🎨 可选素材（Optional，强烈建议）

| 素材 | 规格 | 用途 | 状态 |
|------|------|------|------|
| 大宣传图 (Large Promo Tile) | 920×680 PNG/JPG | 分类页展示 | ✅ `promo_large_920x680.png` |
| 宣传横幅 (Marquee) | 1400×560 PNG/JPG | 首页精选位 | ✅ `promo_marquee_1400x560.png` |

---

## 📸 截图拍摄建议

已经生成的 `screenshot_*.png` 是占位示意图。**上架前建议拍摄真实运行截图**，理想的 5 张顺序如下：

1. **思考弹窗主界面** — 在 ChatGPT 或 Claude 上展示完整的倒计时弹窗（这张最重要，会作为预览主图）
2. **写下想法的状态** — textarea 里写着示例文字的弹窗
3. **设置面板** — popup 打开，展示各项设置
4. **思考历史** — popup 的"思考记录"标签页
5. **统计面板** — popup 的"统计"标签页

### 拍摄技巧

- 用 Chrome 开发者工具的"设备模拟"固定视口为 1280×800
- 真实 AI 平台背景 + iThinkAI 弹窗的组合最有说服力
- 可以用 macOS 的 Cmd+Shift+4+Space 截取单个窗口
- 保存为 PNG，体积别超过 16 MB

---

## 🏷️ 图标当前存在的小问题

当前 `icons/icon128.png` 是简单的暂停符号。上架时建议：
- 保持当前纯色极简风格即可，Chrome 商店不要求精细设计
- 如果想更精致，可以加一个"i"字母和暂停符号的组合

---

## 📝 文件位置总览

```
store/
├── LISTING.md                      ← 商店文案（上传时复制粘贴）
├── PERMISSIONS.md                  ← 权限说明（审核时填写）
├── PRIVACY_POLICY.md               ← 隐私政策（需要托管为 URL）
├── ASSETS.md                       ← 本文件
├── promo_small_440x280.png         ← 必需
├── promo_large_920x680.png         ← 可选
├── promo_marquee_1400x560.png      ← 可选
├── screenshot_1_modal.png          ← 替换为真实截图
├── screenshot_2_settings.png       ← 替换为真实截图
├── screenshot_3_history.png        ← 替换为真实截图
└── screenshot_5_stats.png          ← 替换为真实截图
```
