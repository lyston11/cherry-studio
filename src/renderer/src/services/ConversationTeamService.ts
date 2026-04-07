import type { ConversationResponseTarget } from '@renderer/services/ConversationParticipantService'
import type { CollaborativeTeamConfig, Topic } from '@renderer/types'
import type { Message } from '@renderer/types/newMessage'
import { getMainTextContent } from '@renderer/utils/messageUtils/find'

export const DEFAULT_COLLABORATIVE_TEAM_CONFIG: Required<CollaborativeTeamConfig> = {
  strategy: 'selector',
  maxTurns: 3,
  moderatorEnabled: false
}

export function getTopicTeamConfig(topic?: Topic): Required<CollaborativeTeamConfig> {
  const config = topic?.teamConfig
  const maxTurns =
    typeof config?.maxTurns === 'number' && Number.isFinite(config.maxTurns)
      ? Math.max(1, Math.min(6, Math.round(config.maxTurns)))
      : DEFAULT_COLLABORATIVE_TEAM_CONFIG.maxTurns

  return {
    strategy: config?.strategy ?? DEFAULT_COLLABORATIVE_TEAM_CONFIG.strategy,
    maxTurns,
    moderatorEnabled: config?.moderatorEnabled ?? DEFAULT_COLLABORATIVE_TEAM_CONFIG.moderatorEnabled
  }
}

export function getConversationResponseTargetLabel(target: ConversationResponseTarget) {
  return target.participantLabel || target.model?.name || (target.kind === 'agent' ? target.agentId : target.key)
}

export type CollaborativeTargetCapabilitySummary = Record<string, string | undefined>
export type CollaborativeDiscussionSignals = {
  latestUserRequest?: string
  directlyAddressedParticipants: string[]
  suggestedVisibleReplyCount: number
  visibleReplyCount: number
}

export type CollaborativeTurnPlan =
  | {
      action: 'finish'
    }
  | {
      action: 'speak'
      speakerId: string
      instruction?: string
    }

function getCandidateLines(
  targets: ConversationResponseTarget[],
  targetCapabilitySummaries?: CollaborativeTargetCapabilitySummary
) {
  return targets.map((target) => {
    const key = getConversationResponseTargetKey(target)
    const capabilitySummary = targetCapabilitySummaries?.[key]
    return [
      '- id: ' + key,
      `  name: ${getConversationResponseTargetLabel(target)}`,
      capabilitySummary ? `  capabilities: ${capabilitySummary}` : ''
    ]
      .filter(Boolean)
      .join('\n')
  })
}

function extractJsonObject(raw: string) {
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = [codeBlockMatch?.[1], raw.match(/\{[\s\S]*\}/)?.[0]].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch {
      continue
    }
  }

  return null
}

function normalizePlannerAction(value: unknown): CollaborativeTurnPlan['action'] | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (['finish', 'stop', 'done', 'end'].includes(normalized)) {
    return 'finish'
  }

  if (['speak', 'reply', 'continue', 'respond'].includes(normalized)) {
    return 'speak'
  }

  return null
}

function getLatestDiscussionMessages(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return messages.slice(index)
    }
  }

  return messages
}

function truncateText(value: string, maxLength = 240) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`
}

function inferSuggestedVisibleReplyCount({
  latestUserRequest,
  directlyAddressedParticipants,
  maxTurns
}: {
  latestUserRequest?: string
  directlyAddressedParticipants: string[]
  maxTurns: number
}) {
  const normalized = latestUserRequest?.toLowerCase() ?? ''
  let suggestedCount = 1

  const asksForDebate =
    /讨论|辩论|头脑风暴|互相|一起聊|聊一聊|各自|分别|群聊|roundtable|brainstorm|debate|discuss among yourselves|talk it through/i.test(
      normalized
    )
  const asksForAnalysis =
    /对比|比较|权衡|利弊|优缺点|风险|方案|架构|设计|规划|评估|评审|取舍|trade[\s-]?off|compare|comparison|pros and cons|risk|plan|architecture|design|review|analysis|analyze/i.test(
      normalized
    )
  const asksForTools =
    /查|搜索|联网|网页|资料|文档|文件|代码|运行|测试|mcp|工具|仓库|repo|file|docs|documentation|search|browse|web|run|test|tool/i.test(
      normalized
    )

  if (asksForAnalysis || asksForTools || normalized.length > 120 || directlyAddressedParticipants.length > 1) {
    suggestedCount = 2
  }

  if (asksForDebate) {
    suggestedCount = 3
  }

  return Math.max(1, Math.min(maxTurns, suggestedCount))
}

export function getCollaborativeDiscussionSignals({
  messages,
  targets,
  maxTurns
}: {
  messages: Message[]
  targets: ConversationResponseTarget[]
  maxTurns: number
}): CollaborativeDiscussionSignals {
  const latestDiscussion = getLatestDiscussionMessages(messages)
  const latestUserMessage = [...latestDiscussion].reverse().find((message) => message.role === 'user')
  const latestUserRequest = latestUserMessage ? getMainTextContent(latestUserMessage)?.trim() : undefined
  const normalizedRequest = latestUserRequest?.toLowerCase() ?? ''
  const directlyAddressedParticipants = targets
    .map((target) => getConversationResponseTargetLabel(target))
    .filter((label, index, labels) => labels.indexOf(label) === index)
    .filter((label) => normalizedRequest.includes(label.toLowerCase()))
  const visibleReplyCount = latestDiscussion.filter(
    (message) => message.role === 'assistant' && !!getMainTextContent(message)?.trim()
  ).length

  return {
    latestUserRequest: latestUserRequest ? truncateText(latestUserRequest) : undefined,
    directlyAddressedParticipants,
    suggestedVisibleReplyCount: inferSuggestedVisibleReplyCount({
      latestUserRequest,
      directlyAddressedParticipants,
      maxTurns
    }),
    visibleReplyCount
  }
}

export function buildHiddenOrchestratorPrompt({
  topic,
  targets,
  turnIndex,
  maxTurns,
  lastSpeakerLabel,
  hasVisibleReplies,
  targetCapabilitySummaries,
  latestUserRequest,
  directlyAddressedParticipants,
  suggestedVisibleReplyCount,
  visibleReplyCount
}: {
  topic?: Topic
  targets: ConversationResponseTarget[]
  turnIndex: number
  maxTurns: number
  lastSpeakerLabel?: string
  hasVisibleReplies: boolean
  targetCapabilitySummaries?: CollaborativeTargetCapabilitySummary
  latestUserRequest?: string
  directlyAddressedParticipants?: string[]
  suggestedVisibleReplyCount?: number
  visibleReplyCount?: number
}) {
  const teamPrompt = topic?.prompt ? `Topic guidance:\n${topic.prompt}` : ''
  const lastSpeakerLine = lastSpeakerLabel
    ? `The most recent visible speaker was "${lastSpeakerLabel}". Prefer a different speaker unless a quick direct follow-up is truly necessary.`
    : ''
  const latestUserRequestLine = latestUserRequest ? `Latest user request:\n${latestUserRequest}` : ''
  const directlyAddressedLine =
    directlyAddressedParticipants && directlyAddressedParticipants.length > 0
      ? `The user directly called on: ${directlyAddressedParticipants.join(', ')}. Unless tools or context strongly suggest otherwise, one of them should usually open the visible reply.`
      : ''
  const pacingLine =
    suggestedVisibleReplyCount && suggestedVisibleReplyCount <= 1
      ? 'This looks like a quick request. Prefer a single visible reply unless another participant can add a clearly distinct missing angle.'
      : suggestedVisibleReplyCount === 2
        ? 'This looks like a short back-and-forth. Prefer two visible replies: one main answer and one complementary, skeptical, or tool-backed follow-up.'
        : suggestedVisibleReplyCount
          ? `This looks like a brief group discussion. Up to ${suggestedVisibleReplyCount} visible replies can feel natural, but each extra turn must add a distinct perspective.`
          : ''
  const progressLine =
    typeof visibleReplyCount === 'number' && visibleReplyCount > 0
      ? `There have already been ${visibleReplyCount} visible participant replies in this round.`
      : ''
  const closingLine =
    suggestedVisibleReplyCount && turnIndex + 1 >= suggestedVisibleReplyCount
      ? 'If another turn would mostly repeat earlier points, finish now. Only continue if there is unresolved disagreement, missing evidence, or an important tool result still needed.'
      : ''

  return [
    'You are the hidden lead orchestrator for a multi-agent group chat.',
    'You never appear in the visible transcript. Your only job is to decide whether another visible participant should speak, and if so who it should be.',
    'Make the group chat feel human. Usually one relevant participant opens, then one complementary or opposing participant adds value. Do not make everyone answer by default.',
    'When the task needs tools, MCP, web search, knowledge retrieval, files, or external execution, prefer the candidate whose listed capabilities fit that need best.',
    'For follow-up turns, prefer a participant who can add a new angle such as risk, tradeoff, evidence, implementation detail, counterexample, or tool result instead of paraphrasing.',
    `You are planning visible turn ${turnIndex + 1} of at most ${maxTurns}.`,
    hasVisibleReplies
      ? 'If the user already has a solid answer, you may end the visible discussion now.'
      : 'At least one visible participant must answer the user.',
    lastSpeakerLine,
    latestUserRequestLine,
    directlyAddressedLine,
    pacingLine,
    progressLine,
    closingLine,
    teamPrompt,
    'Return strict JSON only, using one of these shapes:',
    '{"action":"speak","speakerId":"<candidate id>","instruction":"<one short private note for that speaker>"}',
    '{"action":"finish"}',
    'Candidates:',
    getCandidateLines(targets, targetCapabilitySummaries).join('\n')
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildTeamSelectorPrompt({
  topic,
  targets,
  turnIndex,
  maxTurns,
  lastSpeakerLabel
}: {
  topic?: Topic
  targets: ConversationResponseTarget[]
  turnIndex: number
  maxTurns: number
  lastSpeakerLabel?: string
}) {
  const teamPrompt = topic?.prompt ? `Topic guidance:\n${topic.prompt}` : ''
  const candidateLines = targets.map((target) => {
    const key = getConversationResponseTargetKey(target)
    return `- id: ${key}\n  name: ${getConversationResponseTargetLabel(target)}`
  })
  const lastSpeakerLine = lastSpeakerLabel
    ? `The last speaker was "${lastSpeakerLabel}". Prefer a different speaker unless repeating is clearly necessary.`
    : ''

  return [
    'You are the selector for a multi-agent discussion.',
    `Choose exactly one next speaker for turn ${turnIndex + 1} of ${maxTurns}.`,
    'Return only one speaker id from the candidate list. Do not add explanation.',
    lastSpeakerLine,
    teamPrompt,
    'Candidates:',
    candidateLines.join('\n')
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildSelectedSpeakerPrompt({
  participantLabel,
  turnIndex,
  maxTurns,
  instruction,
  lastSpeakerLabel,
  suggestedVisibleReplyCount
}: {
  participantLabel?: string
  turnIndex: number
  maxTurns: number
  instruction?: string
  lastSpeakerLabel?: string
  suggestedVisibleReplyCount?: number
}) {
  if (!participantLabel) {
    return ''
  }

  const likelyClosingTurn =
    turnIndex + 1 >= maxTurns || (!!suggestedVisibleReplyCount && turnIndex + 1 >= suggestedVisibleReplyCount)
  const turnGuidance =
    turnIndex === 0
      ? 'You are opening the visible group reply. Answer the user directly with your main take, but do not try to cover every angle. Leave room for others to add a different perspective.'
      : likelyClosingTurn
        ? lastSpeakerLabel
          ? `React naturally to what "${lastSpeakerLabel}" just said, add one decisive missing point, and help the group close the loop instead of opening a new branch.`
          : 'Add one decisive missing point and help the group close the loop instead of opening a new branch.'
        : lastSpeakerLabel
          ? `Build naturally on what "${lastSpeakerLabel}" just said: agree and extend, gently disagree, or add one missing angle such as risk, tradeoff, evidence, implementation detail, or a tool result.`
          : 'Build on the existing discussion by adding one missing angle instead of restarting from scratch.'
  const lengthGuidance =
    turnIndex === 0
      ? 'Keep the opening reply concise, roughly 2 to 4 sentences unless the user clearly needs more detail.'
      : likelyClosingTurn
        ? 'Be concise, but make the group land on a clear recommendation, decision, or next step.'
        : 'Keep your reply focused, conversational, and clearly additive.'

  return [
    `The hidden lead asked "${participantLabel}" to speak next.`,
    `This is visible discussion turn ${turnIndex + 1} of up to ${maxTurns}.`,
    turnGuidance,
    instruction ? `Private guidance from the hidden lead: ${instruction}` : '',
    lengthGuidance,
    'Do not mention any hidden planner, orchestration, or internal selection process.'
  ].join('\n')
}

export function buildModeratorPrompt({ topic, targets }: { topic?: Topic; targets: ConversationResponseTarget[] }) {
  const roster = targets.map(getConversationResponseTargetLabel).join(', ')
  const teamPrompt = topic?.prompt ? `Topic guidance:\n${topic.prompt}` : ''

  return [
    'You are the moderator of a multi-agent discussion.',
    teamPrompt,
    roster ? `Participants involved: ${roster}.` : '',
    'Read the full shared transcript, synthesize the strongest points from the participants, resolve conflicts when possible, and answer the user directly.',
    'Your reply should be the final answer for this round. Do not simulate other participants speaking again.'
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function parseCollaborativeTurnPlan(
  raw: string,
  targets: ConversationResponseTarget[]
): CollaborativeTurnPlan | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const parsed = extractJsonObject(trimmed)
  const parsedAction =
    normalizePlannerAction(parsed?.action) ??
    (parsed?.shouldContinue === false ? 'finish' : null) ??
    normalizePlannerAction(trimmed)

  if (parsedAction === 'finish') {
    return { action: 'finish' }
  }

  const speakerIdCandidate =
    (typeof parsed?.speakerId === 'string' && parsed.speakerId) ||
    (typeof parsed?.nextSpeakerId === 'string' && parsed.nextSpeakerId) ||
    (typeof parsed?.participantId === 'string' && parsed.participantId) ||
    trimmed

  const speakerId = parseSelectedTargetKey(speakerIdCandidate, targets)
  if (!speakerId) {
    return null
  }

  const instruction =
    typeof parsed?.instruction === 'string' && parsed.instruction.trim() ? parsed.instruction.trim() : undefined

  return {
    action: 'speak',
    speakerId,
    instruction
  }
}

export function parseSelectedTargetKey(raw: string, targets: ConversationResponseTarget[]) {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.replace(/^["'`\s]+|["'`\s]+$/g, '')
  const byKey = targets.find((target) => getConversationResponseTargetKey(target) === normalized)
  if (byKey) {
    return getConversationResponseTargetKey(byKey)
  }

  const byLabel = targets.find(
    (target) => getConversationResponseTargetLabel(target).toLowerCase() === normalized.toLowerCase()
  )
  if (byLabel) {
    return getConversationResponseTargetKey(byLabel)
  }

  const idMatch = normalized.match(/participant[:_]?id"?\s*[:=]\s*"?(?<id>[^"\s,}]+)/i)
  if (idMatch?.groups?.id) {
    const matched = targets.find((target) => getConversationResponseTargetKey(target) === idMatch.groups!.id)
    if (matched) {
      return getConversationResponseTargetKey(matched)
    }
  }

  return null
}

export function getConversationResponseTargetKey(target: ConversationResponseTarget) {
  return target.participantId || target.key
}

export function selectNextResponseTargetFallback({
  targets,
  messages,
  usedTargetKeys,
  lastSpeakerKey
}: {
  targets: ConversationResponseTarget[]
  messages: Message[]
  usedTargetKeys: string[]
  lastSpeakerKey?: string
}) {
  if (targets.length === 0) {
    return null
  }

  const filteredTargets =
    targets.length > 1 && lastSpeakerKey
      ? targets.filter((target) => getConversationResponseTargetKey(target) !== lastSpeakerKey)
      : targets

  const freshTargets = filteredTargets.filter(
    (target) => !usedTargetKeys.includes(getConversationResponseTargetKey(target))
  )
  const candidateTargets = freshTargets.length > 0 ? freshTargets : filteredTargets

  const latestText = [...messages]
    .reverse()
    .map((message) => getMainTextContent(message)?.trim())
    .find(Boolean)
    ?.toLowerCase()

  if (latestText) {
    const mentionedTarget = candidateTargets.find((target) =>
      latestText.includes(getConversationResponseTargetLabel(target).toLowerCase())
    )
    if (mentionedTarget) {
      return mentionedTarget
    }
  }

  return candidateTargets[0] ?? targets[0] ?? null
}
