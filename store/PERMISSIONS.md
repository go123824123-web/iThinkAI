# Permission Justifications for Chrome Web Store Review

> Chrome Web Store 审核时会逐项询问每个权限的使用理由。复制对应文本到开发者后台的权限说明框中。

---

## `storage`

**中文理由：**
用于本地保存用户的插件设置（如倒计时秒数、启用平台）和思考历史记录。所有数据仅存储在用户本地浏览器，不会上传。

**English justification:**
Used to locally persist user preferences (countdown duration, enabled platforms) and thinking history. All data is stored in the user's local browser via `chrome.storage.local` and is never transmitted off-device.

---

## Host Permissions

**声明的主机权限：**
- AI 服务站点：`chatgpt.com`, `chat.openai.com`, `claude.ai`, `gemini.google.com`, `chat.deepseek.com`, `kimi.moonshot.cn`, `chat.mistral.ai`, `poe.com`, `copilot.microsoft.com`, `tongyi.aliyun.com`

**中文理由：**
为了注入思考暂停 UI 和拦截发送操作，必须在这些具体 AI 平台上运行 content script。

**English justification:**
Required to inject the thinking modal UI and intercept send actions on these specific AI platforms.

---

## 是否使用远程代码 / Remote Code Use

**声明：否 (No)**

所有 JavaScript 代码都打包在扩展内，不从远程加载执行代码。

All JavaScript code is bundled within the extension package. No code is loaded or executed from remote sources.

---

## Single Purpose 单一用途声明

**中文：**
本扩展的单一用途是：在用户使用 AI 聊天服务时，通过强制暂停帮助用户保持独立思考能力。

**English:**
This extension's single purpose is to help users maintain independent thinking skills when using AI chat services, through a forced thinking pause.

---
