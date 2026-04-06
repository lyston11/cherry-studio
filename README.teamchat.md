# Cherry Studio TeamChat Edition

中文建议名：`Cherry Studio 群聊协作版`

这是一个基于 Cherry Studio 定制的多 Agent 群聊版本。它的目标不是把多个模型并排展示，而是把群聊体验做得更像微信、QQ 或飞书中的群消息：

- 左侧同时展示单聊会话和群聊会话
- 右侧群聊区按时间流展示每个 Agent 的发言
- 每个 Agent 以独立身份参与同一上下文
- 群聊内部存在一个隐藏总控 Agent，负责决定谁先说、谁补充、何时收尾
- 可见聊天记录里只显示真实群成员，不显示总控 Agent

这份文档记录的是当前这个定制版本的功能边界、技术设计和后续演进方向，不等同于上游官方 README。

## 版本命名建议

主推荐：

- 英文名：`Cherry Studio TeamChat Edition`
- 中文名：`Cherry Studio 群聊协作版`
- 简称：`TeamChat`

如果你之后准备对外发布，也可以考虑下面几个备选：

- `Cherry Studio TeamFlow`
- `Cherry Studio Group Agent Edition`
- `Cherry Studio 群智版`

当前这一版最贴切的名字，仍然是 `Cherry Studio TeamChat Edition`，因为它最准确地表达了“多 Agent 群聊”这个核心体验。

## 这一版解决的问题

原始 Cherry Studio 更偏向：

- 单助手对话
- 多模型并行回复
- 面向单会话的工具调用

这个版本重点改造成：

- 单 Agent 会话保持原有体验
- 群聊会话作为一级会话类型存在
- 不同 Assistant / Agent 可以像“加入群聊”一样一起回答
- 群成员共享上下文，但保留各自模型、工具、MCP、知识库与身份
- 群聊内部使用隐藏编排器，让讨论更接近真人聊天节奏

## 核心功能

### 1. 单聊与群聊并存

左侧会话列表已改成“单聊 + 群聊”混合模式，体验更像 IM：

- 单 Agent 会话继续沿用原有 Cherry Studio 逻辑
- 群聊会话与单聊会话一起出现在左侧列表
- 群聊项使用群组图标和成员摘要展示

### 2. 新建群聊

左侧新增了创建入口：

- 点击左侧顶部的小 `+` 按钮
- 选择“创建群聊”
- 在弹窗中选择初始成员
- 创建后直接进入该群聊

当前创建弹窗默认从 Assistant 列表中选择初始成员，后续可继续向群中加入更多成员。

### 3. 群成员加入方式

当前支持两种方式把成员加入群聊：

- 在群聊界面中通过事件入口加入成员
- 从左侧 Assistant / Agent 列表中拖拽到当前群聊区域

这意味着群聊创建完成后，不是固定死成员的，可以继续扩展。

### 4. 群聊消息流体验

右侧群聊区已改成统一消息流，而不是模型并排卡片：

- 每个成员在同一个消息时间线里发言
- 每条消息保留自己的头像和身份
- 成员在共享上下文中接话、补充、质疑、收尾
- 用户看起来像在和一个“AI 群聊”互动

### 5. 隐藏总控 Agent

群聊内部默认存在一个隐藏总控 Agent：

- 总控 Agent 不显示在 UI 中
- 它不直接回答用户
- 它只负责决定下一位应该发言的成员
- 它会判断是否需要继续讨论，还是已经可以结束

当前实现借鉴了 AutoGen 的 selector / moderator 架构思路，但做了产品化改造：

- 总控固定存在
- 不提供用户可见的开关或选择器
- 只保留内部编排能力

### 6. 群成员保留各自能力

群聊不是“把所有 Agent 扁平化成同一个模型”，而是保留各自原始能力：

- Assistant 成员继续使用自己的模型配置
- Assistant 成员继续使用自己的 Web Search、知识库、Memory、MCP、URL Context、工具模式
- Agent 成员继续使用自己的 `allowed_tools`
- Agent 成员继续使用自己的 `mcps`
- Agent 成员继续使用自己的 `slash_commands`
- Agent 成员继续使用自己的 `accessible_paths`

也就是说，群聊只是把这些成员放进同一个共享讨论上下文，而不是抹平他们之间的差异。

### 7. 真人化讨论节奏

这一版不只是“随机轮流说话”，而是尽量模拟真实多人聊天节奏：

- 第一位更偏主答
- 第二位更偏补充、风险、反例或工具验证
- 最后一位更偏收口、给建议或落地结论
- 如果讨论已经足够，会提前结束，不强制每个人都说

## 技术实现

### 数据模型扩展

为了支持群聊，会话和消息模型新增了群聊相关字段。

### Topic 扩展

文件：

- [src/renderer/src/types/index.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/types/index.ts)

关键字段：

- `chatMode?: 'single' | 'group'`
- `participants?: ConversationParticipant[]`
- `teamConfig?: CollaborativeTeamConfig`

说明：

- `chatMode` 用于区分单聊和群聊
- `participants` 保存群成员
- `teamConfig` 保存群聊轮数等协作参数

### ConversationParticipant

文件：

- [src/renderer/src/types/index.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/types/index.ts)

关键字段：

- `type?: 'assistant' | 'agent'`
- `sourceAssistantId?: string`
- `sourceAgentId?: string`
- `label`
- `emoji`
- `model`
- `sessionId`
- `agentSessionId`

说明：

- 统一抽象 Assistant 成员和 Agent 成员
- 让群聊侧不必区分 UI 展示方式
- 让消息分发层可以解析到真实执行目标

### Message 扩展

文件：

- [src/renderer/src/types/newMessage.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/types/newMessage.ts)

关键字段：

- `participantId?: string`
- `participantLabel?: string`
- `agentSessionId?: string`

说明：

- `participantId` 和 `participantLabel` 用于在统一消息流中标识是哪位群成员发言
- `agentSessionId` 用于 Agent 会话续跑和工具执行链路恢复

### 群成员与目标解析

文件：

- [src/renderer/src/services/ConversationParticipantService.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/services/ConversationParticipantService.ts)

这一层负责：

- 识别当前 Topic 是否为群聊
- 读取和维护群成员列表
- 将群成员解析成可执行的 `ConversationResponseTarget`
- 支持 Assistant / Agent 两种成员类型
- 构造共享讨论 transcript
- 提供拖拽加入群聊所需的数据格式

关键能力包括：

- `createConversationParticipantFromAssistant`
- `createConversationParticipantFromAgent`
- `buildConversationResponseTargets`
- `buildParticipantTranscript`
- `buildAgentParticipantTurnPrompt`

### 隐藏总控与编排器

文件：

- [src/renderer/src/services/ConversationTeamService.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/services/ConversationTeamService.ts)
- [src/renderer/src/store/thunk/messageThunk.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/store/thunk/messageThunk.ts)

### 编排思路

群聊内部使用一个“隐藏 lead orchestrator”：

- 读取共享讨论 transcript
- 读取当前候选成员列表
- 读取每个成员的能力摘要
- 判断下一位谁更适合发言
- 给下一位一条很短的私有指导
- 判断当前是否已经可以结束

它不会出现在可见消息流里。

### 能力感知分派

总控在选人时会读取成员能力摘要：

- Assistant 成员：工具模式、MCP、Web Search、知识库、URL Context、图片生成、Memory
- Agent 成员：工具白名单、MCP、命令、文件访问路径

这使得它在遇到下面这些问题时更会挑人：

- 需要搜索网页
- 需要知识库召回
- 需要读写文件
- 需要调用 MCP
- 需要命令执行或代码工具

### 每轮刷新

当前版本已经做成“每个可见回合刷新一次”：

- 每一轮选人前重新读取当前群成员
- 每一轮重新构建能力摘要
- 新增 Agent、修改配置、增强工具后，下一轮即可被总控感知

### 真人化信号

总控除了看能力，还会看群聊节奏信号：

- 用户有没有点名某个成员
- 这一轮更像单答还是讨论
- 当前已经回复了几轮
- 是否已经可以自然收尾

这部分逻辑集中在 `getCollaborativeDiscussionSignals`。

### 消息执行链路

文件：

- [src/renderer/src/store/thunk/messageThunk.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/store/thunk/messageThunk.ts)

### Assistant 成员执行

Assistant 成员在群聊中的执行路径仍然沿用原始 Assistant 对话链路：

- 组装群聊上下文 prompt
- 注入共享 transcript
- 调用 `fetchAndProcessAssistantResponseImpl`
- 最终进入 `transformMessagesAndFetch`

这意味着 Assistant 在群聊中仍然可以使用自己已有的：

- 模型能力
- MCP
- 知识库
- Web Search
- Memory

### Agent 成员执行

Agent 成员的执行链路会：

- 先确保存在对应 session
- 若没有则创建 session
- 再以该 session 继续执行
- 在回复时注入共享群聊 transcript

执行核心包括：

- `ensureAgentParticipantSession`
- `fetchAndProcessAgentResponseImpl`

因此 Agent 在群聊里仍然能保留自己的工具和执行环境。

### UI 结构改造

### 左侧会话栏

文件：

- [src/renderer/src/pages/home/Tabs/ConversationsTab.tsx](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/pages/home/Tabs/ConversationsTab.tsx)
- [src/renderer/src/pages/home/Tabs/index.tsx](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/pages/home/Tabs/index.tsx)

改动点：

- 左侧统一展示单聊与群聊
- 顶部 `+` 按钮新增“创建群聊”
- 群聊项显示群图标、标题和成员摘要
- 当前激活群聊时，可从左侧项直接邀请成员

### 创建群聊弹窗

文件：

- [src/renderer/src/pages/home/Tabs/components/CreateGroupChatPopup.tsx](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/pages/home/Tabs/components/CreateGroupChatPopup.tsx)

改动点：

- 弹窗选择初始成员
- 支持自定义群聊名称
- 不再用复杂的多 Agent 配置界面取代日常操作

### 群成员展示与设置

文件：

- [src/renderer/src/pages/home/components/ChatNavBar/ChatNavbarContent/TopicContent.tsx](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/pages/home/components/ChatNavBar/ChatNavbarContent/TopicContent.tsx)
- [src/renderer/src/pages/home/Inputbar/TopicParticipantsInput.tsx](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/pages/home/Inputbar/TopicParticipantsInput.tsx)

改动点：

- 群成员头像被收纳到顶部紧凑区域
- 鼠标悬停显示成员信息
- 点击小按钮弹出成员和轮数设置
- 只保留必要设置，避免“多 Agent 控制台”式复杂界面

### 群聊拖拽加入

文件：

- [src/renderer/src/pages/home/Chat.tsx](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/pages/home/Chat.tsx)
- [src/renderer/src/pages/agents/components/AgentItem.tsx](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/pages/agents/components/AgentItem.tsx)
- [src/renderer/src/pages/home/Tabs/components/AssistantItem.tsx](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/pages/home/Tabs/components/AssistantItem.tsx)

改动点：

- Assistant 和 Agent 都可作为拖拽源
- 当前激活群聊时，右侧聊天区可接收拖入成员
- 群聊创建后可持续扩展，不需要重建群

### 当前性能优化

为了减少群聊等待时间，当前版本已做如下优化：

### 1. 减少不必要的总控决策

当满足以下情况时，会直接走快路径：

- 只剩一个候选成员
- 第一轮且用户只点名了一个成员
- 当前讨论已经达到建议回复数

这样可以少跑一次隐藏总控模型调用。

### 2. 合并同一轮中的 Agent 配置拉取

同一轮里原本会发生两次相近读取：

- 一次用于构建能力摘要
- 一次用于真正执行 Agent 回复

现在同一轮里会复用 Agent 读取结果，减少重复请求。

## 当前边界与已知限制

这版已经可以用，但仍有一些明确边界：

### 1. 总控固定隐藏

当前不支持：

- 用户切换总控角色
- 在 UI 中显示总控
- 为不同群聊显式配置不同总控模型

这是有意为之，目的是保持产品体验简洁。

### 2. 群聊回复是顺序式，不是完全并行

当前可见回复按顺序进行，优点是：

- 群聊更像真人聊天
- 后说的人可以接上前面的人

代价是：

- 整体首轮完整结束时间会比完全并行略长

### 3. 初始建群以 Assistant 为主

当前“创建群聊”弹窗默认面向 Assistant 建群。
Agent 可以在建群后继续加入，但不是初始弹窗的主入口。

### 4. 速度瓶颈仍主要来自模型和工具

即使做了调度层提速，群聊速度仍可能受下面因素影响：

- 模型本身首字延迟
- MCP 调用耗时
- 工具调用耗时
- Agent session 初始化耗时

## 关键文件清单

如果后续继续开发，这几个文件最关键：

- [src/renderer/src/types/index.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/types/index.ts)
  话题、群成员、团队配置的数据结构
- [src/renderer/src/types/newMessage.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/types/newMessage.ts)
  群消息元数据结构
- [src/renderer/src/services/ConversationParticipantService.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/services/ConversationParticipantService.ts)
  群成员抽象、目标解析、共享 transcript、拖拽协议
- [src/renderer/src/services/ConversationTeamService.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/services/ConversationTeamService.ts)
  隐藏总控 prompt、节奏信号、回退选人逻辑
- [src/renderer/src/store/thunk/messageThunk.ts](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/store/thunk/messageThunk.ts)
  群聊编排与执行主链路
- [src/renderer/src/pages/home/Tabs/ConversationsTab.tsx](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/pages/home/Tabs/ConversationsTab.tsx)
  左侧 IM 风格会话列表与建群入口
- [src/renderer/src/pages/home/Chat.tsx](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/pages/home/Chat.tsx)
  群聊成员拖拽加入与群聊交互承接
- [src/renderer/src/pages/home/Inputbar/TopicParticipantsInput.tsx](/Users/lyston/PycharmProjects/cherry-studio/src/renderer/src/pages/home/Inputbar/TopicParticipantsInput.tsx)
  群成员紧凑展示与设置面板

## 推荐后续演进

如果继续做这一版，建议按下面顺序推进：

### 1. 群聊 session 预热

目标：

- 降低 Agent 首次发言等待时间

### 2. 初始建群支持 Agent 直接勾选

目标：

- 建群时直接混选 Assistant 与 Agent

### 3. 群角色模板

目标：

- 为每个群成员增加默认角色，如主答、审稿、执行、反方、落地

### 4. 群聊轮次可视化

目标：

- 在不暴露隐藏总控的前提下，让用户更清楚群聊正在“讨论中”还是“已收尾”

## 验证状态

本版本相关逻辑已通过如下验证：

- `eslint`
- `tsgo --noEmit -p tsconfig.web.json --composite false`
- `vitest` 中与群聊编排和群成员解析相关的测试

## 一句话总结

`Cherry Studio TeamChat Edition` 的核心不是“多模型一起输出”，而是“让多个不同能力的 Assistant / Agent 以群聊方式共同思考，并由一个隐藏总控在内部完成编排”。

如果把原版 Cherry Studio 理解为“单人 AI 工作台”，那么这一版更接近：

`一个可以拉人组局、一起讨论、共享上下文、各自调用能力的 AI 群聊工作台。`
