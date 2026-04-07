<h1 align="center">
  <a href="https://github.com/lyston11/cherry-studio-GroupChat">
    <img src="../../build/icon.png" width="150" height="150" alt="Cherry Studio 群聊版" /><br>
  </a>
</h1>
<p align="center">
  <a href="../../README.md">English</a> | 中文
</p>

# 🍒 Cherry Studio 群聊版

Cherry Studio 群聊版是一款面向多智能体群聊体验的桌面客户端。在 Cherry Studio 原有多模型桌面能力基础上，这个版本重点增强了类似群聊的协作式会话体验。

> 基于 [CherryHQ/cherry-studio](https://github.com/CherryHQ/cherry-studio) 修改而来。
>
> 本仓库继续遵循 `AGPL-3.0` 许可证发布，原项目版权声明与许可证文本均保留在 [LICENSE](../../LICENSE)。

# 🌠 界面

![](../images/group-chat-home.png)

![](../images/group-chat-discussion.png)

![](https://github.com/user-attachments/assets/f549e8a0-2385-40b4-b52b-2039e39f2930)

![](https://github.com/user-attachments/assets/58e0237c-4d36-40de-b428-53051d982026)

# 🧠 群聊架构

这个版本采用了 AutoGen 风格的多智能体编排思路，重点不是把多个模型并排展示，而是让它们在一个更像真实群聊的会话流里协作。

- **默认内置隐藏总控 agent**：每个群聊话题内部都会有一个不出现在可见消息流中的总控角色，负责判断该由谁继续发言、是否继续讨论，以及何时收束为最终答复。
- **Selector 式协作讨论**：所有群成员共享同一段上下文和同一条可见消息流。总控会按轮次调度不同成员发言，让他们补充观点、提出质疑、给出工具结果，再自然收束。
- **群聊式消息体验**：单 agent 会话保持 Cherry Studio 原本的使用方式；群聊会话则切换为基于头像的消息时间线，更接近微信或 QQ 群聊的阅读体验。
- **assistant 与 agent 可混合参会**：一个群聊里既可以放普通助手，也可以放 agent。建群时可选择成员，后续也可以继续把新的参与者加入到同一个群聊中。
- **能力感知调度**：在决定下一位发言者时，系统会结合各成员的模型特征、工具能力与 MCP 相关能力进行调度，而不是简单轮流发言。

# 🌟 主要特性

1. **多样化 LLM 服务支持**：

- ☁️ 支持主流 LLM 云服务：OpenAI、Gemini、Anthropic、硅基流动等
- 🔗 集成流行 AI Web 服务：Claude、Perplexity、Poe、腾讯元宝、知乎直答等
- 💻 支持 Ollama、LM Studio 本地模型部署

2. **智能助手与对话**：

- 📚 内置 300+ 预配置 AI 助手
- 🤖 支持自定义创建专属助手
- 💬 多模型同时对话，获得多样化观点

3. **文档与数据处理**：

- 📄 支持文本、图片、Office、PDF 等多种格式
- ☁️ WebDAV 文件管理与数据备份
- 📊 Mermaid 图表可视化
- 💻 代码高亮显示

4. **实用工具集成**：

- 🔍 全局搜索功能
- 📝 话题管理系统
- 🔤 AI 驱动的翻译功能
- 🎯 拖拽排序
- 🔌 小程序支持
- ⚙️ MCP(模型上下文协议) 服务

5. **优质使用体验**：

- 🖥️ Windows、Mac、Linux 跨平台支持
- 📦 开箱即用，无需配置环境
- 🎨 支持明暗主题与透明窗口
- 📝 完整的 Markdown 渲染
- 🤲 便捷的内容分享功能

# 📝 开发计划

我们正在积极开发以下功能和改进：

1. 🎯 **核心功能**

- 选择助手 - 智能内容选择增强
- 深度研究 - 高级研究能力
- 全局记忆 - 全局上下文感知
- 文档预处理 - 改进文档处理能力
- MCP 市场 - 模型上下文协议生态系统

2. 🗂 **知识管理**

- 笔记与收藏功能
- 动态画布可视化
- OCR 光学字符识别
- TTS 文本转语音支持

3. 📱 **平台支持**

- 鸿蒙版本 (PC)
- Android 应用（第一期）
- iOS 应用（第一期）
- 多窗口支持
- 窗口置顶功能

4. 🔌 **高级特性**

- 插件系统
- ASR 语音识别
- 助手与话题交互重构

# 🌈 主题

- 主题库：https://cherrycss.com
- Aero 主题：https://github.com/hakadao/CherryStudio-Aero
- PaperMaterial 主题：https://github.com/rainoffallingstar/CherryStudio-PaperMaterial
- 仿 Claude 主题：https://github.com/bjl101501/CherryStudio-Claudestyle-dynamic
- 霓虹枫叶主题：https://github.com/BoningtonChen/CherryStudio_themes

欢迎 PR 更多主题

# 🤝 贡献

我们欢迎对 Cherry Studio 群聊版的贡献！您可以通过以下方式参与：

1. **贡献代码**：开发新功能或优化现有代码
2. **修复错误**：提交您发现的错误修复
3. **维护问题**：帮助管理 GitHub 问题
4. **产品设计**：参与设计讨论
5. **撰写文档**：改进用户手册和指南
6. **社区参与**：加入讨论并帮助用户
7. **推广使用**：宣传 Cherry Studio 群聊版

参考[分支策略](./guides/branching-strategy.md)了解贡献指南

## 入门

1. **Fork 仓库**：Fork 并克隆到您的本地机器
2. **创建分支**：为您的更改创建分支
3. **提交更改**：提交并推送您的更改
4. **打开 Pull Request**：描述您的更改和原因

有关更详细的指南，请参阅我们的 [贡献指南](./guides/contributing.md)

# 📜 许可证

本仓库继续遵循 [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html) 许可证发布。如果您对本仓库进行再分发或修改，请保留原始许可证与版权声明。
