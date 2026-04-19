<div align="center">

# iThinkAI — 先思考，再问 AI

**拦截你发给 AI 的每一句话，给你 10 秒先想想。让独立思考变回肌肉记忆。**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-green)](./manifest.json)
[![Version](https://img.shields.io/badge/version-1.2.0-orange)](https://github.com/go123824123-web/iThinkAI/releases)

</div>

---

## 为什么做这个

你是不是也发现，自己越来越懒得思考了？

问题一冒出来，手比脑子快，「咔」一下就丢给 ChatGPT。
AI 给你完美答案，你点头收下。
半年后你发现——你连这个问题「原本该怎么想」都忘了。

**iThinkAI 就是给你大脑的一个暂停键。**

当你在 ChatGPT、Claude、Gemini 等 AI 平台按下发送时，它会拦下你的问题，弹出一个 10 秒的思考窗口，问你一句：

> 如果是你自己来回答，你会怎么说？

你可以跳过，也可以写下自己的想法。写完再让 AI 回答，两相对比，思考力一点点长回来。

---

## 核心功能

- 🧠 **思考倒计时** — 发送前 10 秒缓冲，节奏你说了算（3–60 秒可调）
- ✍️ **写下你的想法** — 让自己先答一遍，再看 AI 怎么答
- 📊 **思考记录** — 保存每次问题和想法，随时回看对照
- 📈 **统计面板** — 看看自己累计思考了多久
- 🌙 **暗色模式** — 自动适配系统主题

## 支持的 AI 平台

ChatGPT · Claude · Gemini · DeepSeek · Kimi · Mistral · Poe · Microsoft Copilot · 通义千问

---

## 安装

### 方式 A：Chrome Web Store（推荐）

审核通过后可从 Chrome 应用商店一键安装（审核中）。

### 方式 B：手动加载（开发者 / 抢先体验）

1. 从 [Releases](https://github.com/go123824123-web/iThinkAI/releases) 下载最新 `iThinkAI-v*.zip` 并解压
2. 打开 Chrome → 地址栏输入 `chrome://extensions/`
3. 右上角打开「**开发者模式**」
4. 点击「**加载已解压的扩展程序**」
5. 选择刚解压的文件夹（包含 `manifest.json` 的那一级）

## 本地开发

```bash
git clone https://github.com/go123824123-web/iThinkAI.git
cd iThinkAI
```

然后按上面「手动加载」第 2 步开始，选择 clone 下来的根目录即可。改完代码在 `chrome://extensions/` 点刷新按钮就能看到效果。

### 目录结构

```
iThinkAI/
├── manifest.json         Manifest V3 声明
├── content/              注入 AI 站点的倒计时弹窗
│   ├── content.js
│   └── content.css
├── popup/                工具栏图标点开的设置面板
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── icons/                16 / 48 / 128 图标
└── store/                Chrome Web Store 相关素材、隐私政策、截图
```

---

## 隐私承诺

- ✅ **完全本地运行**，所有数据都在你的浏览器里
- ✅ **零网络请求**，不上传一个字节
- ✅ **开源**，代码透明可查
- ✅ 只读取你主动输入的问题，用于本地展示

完整隐私政策：<https://ithinkai.pages.dev/privacy.html>

### 申请的权限

| 权限 | 用途 |
|------|------|
| `storage` | 本地保存设置 + 思考历史（`chrome.storage.local`） |
| `activeTab` | 向已声明的 AI 站点注入思考暂停 UI |
| host permissions（10 个 AI 站点） | 同上，限定作用域 |

**没有** `webRequest`、`tabs`、`cookies`、`history` 等敏感权限。

---

## Roadmap

- [ ] 主题自定义（颜色、字体、文案）
- [ ] 导出思考记录为 Markdown
- [ ] 每周思考报告
- [ ] 更多 AI 平台支持（按用户反馈加）

欢迎 issue 提需求。

## 贡献

欢迎 PR。简单流程：

1. Fork
2. 新建 feature 分支
3. 提交修改（建议跟着现有 manifest 的权限最小化原则走）
4. 开 PR，描述清楚改了什么、为什么

## License

[MIT](./LICENSE) © ithinkstudio

---

<div align="center">

**「先思考，再问 AI。」**
工具是工具，你才是你。

</div>
