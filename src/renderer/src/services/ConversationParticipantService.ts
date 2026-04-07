import { getModel } from '@renderer/hooks/useModel'
import type { AgentEntity } from '@renderer/types'
import type { Assistant, ConversationParticipant, ConversationParticipantType, Model, Topic } from '@renderer/types'
import type { Message } from '@renderer/types/newMessage'
import { getMainTextContent } from '@renderer/utils/messageUtils/find'

import { getAssistantById, getDefaultModel } from './AssistantService'
import { getModelUniqId } from './ModelService'

export const CONVERSATION_PARTICIPANT_MIME_TYPE = 'application/x-cherry-studio-participant'

export type ConversationParticipantDragPayload =
  | {
      participantType?: 'assistant'
      assistantId: string
    }
  | {
      participantType: 'agent'
      agentId: string
    }

type ConversationResponseTargetBase = {
  key: string
  participantId?: string
  participantLabel?: string
  participantType?: ConversationParticipantType
  model?: Model
}

export type AssistantConversationResponseTarget = ConversationResponseTargetBase & {
  kind: 'assistant'
  model: Model
  assistantConfig: Assistant
}

export type AgentConversationResponseTarget = ConversationResponseTargetBase & {
  kind: 'agent'
  agentId: string
  sessionId?: string
  agentSessionId?: string
}

export type ConversationResponseTarget = AssistantConversationResponseTarget | AgentConversationResponseTarget

export function hasConversationParticipantDragType(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) {
    return false
  }

  return Array.from(dataTransfer.types || []).includes(CONVERSATION_PARTICIPANT_MIME_TYPE)
}

export function parseConversationParticipantDragPayload(
  raw: string | null | undefined
): ConversationParticipantDragPayload | null {
  if (!raw) {
    return null
  }

  try {
    const payload = JSON.parse(raw) as Record<string, unknown>
    if (payload.participantType === 'agent' && typeof payload.agentId === 'string') {
      return { participantType: 'agent', agentId: payload.agentId }
    }

    if (typeof payload.assistantId === 'string') {
      return {
        participantType: 'assistant',
        assistantId: payload.assistantId
      }
    }

    return null
  } catch {
    return null
  }
}

export function getConversationParticipantType(
  participant: ConversationParticipant | undefined
): ConversationParticipantType {
  return participant?.type === 'agent' || !!participant?.sourceAgentId ? 'agent' : 'assistant'
}

export function isAgentConversationParticipant(participant: ConversationParticipant | undefined) {
  return getConversationParticipantType(participant) === 'agent'
}

export function createConversationParticipantFromAssistant(assistant: Assistant): ConversationParticipant | null {
  const model = assistant.model ?? assistant.defaultModel ?? getDefaultModel()
  if (!model) {
    return null
  }

  return {
    id: `assistant:${assistant.id}:${getModelUniqId(model)}`,
    type: 'assistant',
    sourceAssistantId: assistant.id,
    label: assistant.name || model.name,
    emoji: assistant.emoji,
    model
  }
}

function resolveAgentModel(agent: Pick<AgentEntity, 'model'>): Model | undefined {
  const [providerId, modelId] = agent.model?.split(':') ?? [undefined, undefined]

  if (providerId && modelId) {
    return getModel(modelId, providerId)
  }

  return getModel(agent.model)
}

export function createConversationParticipantFromAgent(agent: AgentEntity): ConversationParticipant {
  const model = resolveAgentModel(agent)

  return {
    id: `agent:${agent.id}`,
    type: 'agent',
    sourceAgentId: agent.id,
    label: agent.name || agent.id,
    emoji: agent.configuration?.avatar,
    model
  }
}

export function getTopicParticipants(topic?: Topic): ConversationParticipant[] {
  return Array.isArray(topic?.participants) ? topic.participants.filter(Boolean) : []
}

export function isGroupConversationTopic(topic?: Topic): boolean {
  if (!topic) {
    return false
  }

  return topic.chatMode === 'group' || getTopicParticipants(topic).length > 0
}

export function isCollaborativeConversationTopic(topic?: Topic): boolean {
  return isGroupConversationTopic(topic) && getTopicParticipants(topic).length > 0
}

export function getParticipantById(topic: Topic | undefined, participantId: string | undefined) {
  if (!participantId) {
    return undefined
  }

  return getTopicParticipants(topic).find((participant) => participant.id === participantId)
}

export function upsertTopicParticipant(topic: Topic, participant: ConversationParticipant): Topic {
  const participants = getTopicParticipants(topic)
  if (participants.some((current) => current.id === participant.id)) {
    return topic
  }

  return {
    ...topic,
    participants: [...participants, participant]
  }
}

export function updateTopicParticipant(
  topic: Topic,
  participantId: string,
  updates: Partial<ConversationParticipant>
): Topic {
  const participants = getTopicParticipants(topic)
  let changed = false

  const nextParticipants = participants.map((participant) => {
    if (participant.id !== participantId) {
      return participant
    }

    changed = true
    return {
      ...participant,
      ...updates
    }
  })

  return changed
    ? {
        ...topic,
        participants: nextParticipants
      }
    : topic
}

export function removeTopicParticipant(topic: Topic, participantId: string): Topic {
  const participants = getTopicParticipants(topic).filter((participant) => participant.id !== participantId)

  return {
    ...topic,
    participants
  }
}

export function resolveAssistantForParticipant(
  participant: ConversationParticipant,
  fallbackAssistant: Assistant
): Assistant {
  if (isAgentConversationParticipant(participant)) {
    return {
      ...fallbackAssistant,
      model: participant.model ?? fallbackAssistant.model
    }
  }

  const sourceAssistant = participant.sourceAssistantId ? getAssistantById(participant.sourceAssistantId) : undefined
  const assistantConfig = sourceAssistant ?? fallbackAssistant

  return {
    ...assistantConfig,
    model: participant.model ?? assistantConfig.model
  }
}

export function buildConversationResponseTargets({
  assistant,
  topic,
  mentionedModels
}: {
  assistant: Assistant
  topic?: Topic
  mentionedModels?: Model[]
}): ConversationResponseTarget[] {
  const participants = isGroupConversationTopic(topic) ? getTopicParticipants(topic) : []
  const targets = participants.reduce<ConversationResponseTarget[]>((result, participant) => {
    if (isAgentConversationParticipant(participant)) {
      if (!participant.sourceAgentId) {
        return result
      }

      result.push({
        kind: 'agent',
        key: `participant:${participant.id}`,
        agentId: participant.sourceAgentId,
        sessionId: participant.sessionId,
        agentSessionId: participant.agentSessionId,
        participantId: participant.id,
        participantLabel: participant.label,
        participantType: 'agent',
        model: participant.model
      })

      return result
    }

    const model = participant.model ?? assistant.model ?? getDefaultModel()
    if (!model) {
      return result
    }

    result.push({
      kind: 'assistant',
      key: `participant:${participant.id}`,
      model,
      assistantConfig: resolveAssistantForParticipant(participant, assistant),
      participantId: participant.id,
      participantLabel: participant.label,
      participantType: 'assistant'
    })

    return result
  }, [])

  if (isGroupConversationTopic(topic)) {
    return targets
  }

  const usedModelIds = new Set(targets.map((target) => (target.model ? getModelUniqId(target.model) : target.key)))

  for (const model of mentionedModels ?? []) {
    const modelUniqId = getModelUniqId(model)
    if (usedModelIds.has(modelUniqId)) {
      continue
    }

    usedModelIds.add(modelUniqId)
    targets.push({
      kind: 'assistant',
      key: `mention:${modelUniqId}`,
      model,
      assistantConfig: {
        ...assistant,
        model
      }
    })
  }

  return targets
}

export function getResponseTargetForMessage({
  message,
  assistant,
  topic
}: {
  message: Message
  assistant: Assistant
  topic?: Topic
}): ConversationResponseTarget | null {
  if (message.participantId) {
    const participant = getParticipantById(topic, message.participantId)

    if (participant && isAgentConversationParticipant(participant)) {
      if (!participant.sourceAgentId) {
        return null
      }

      return {
        kind: 'agent',
        key: `participant:${message.participantId}`,
        agentId: participant.sourceAgentId,
        sessionId: participant.sessionId,
        agentSessionId: participant.agentSessionId ?? message.agentSessionId,
        participantId: message.participantId,
        participantLabel: message.participantLabel ?? participant.label,
        participantType: 'agent',
        model: participant.model ?? message.model
      }
    }

    const model = participant?.model ?? message.model ?? assistant.model ?? getDefaultModel()

    if (!model) {
      return null
    }

    return {
      kind: 'assistant',
      key: `participant:${message.participantId}`,
      model,
      assistantConfig: participant
        ? resolveAssistantForParticipant(participant, assistant)
        : {
            ...assistant,
            model
          },
      participantId: message.participantId,
      participantLabel: message.participantLabel ?? participant?.label,
      participantType: participant ? getConversationParticipantType(participant) : 'assistant'
    }
  }

  const model = message.model ?? assistant.model ?? getDefaultModel()
  if (!model) {
    return null
  }

  return {
    kind: 'assistant',
    key: `message:${message.id}`,
    model,
    assistantConfig: {
      ...assistant,
      model
    }
  }
}

export function filterMessagesForParticipantContext(
  messages: Message[],
  participantId: string | undefined,
  topic?: Topic
): Message[] {
  if (isCollaborativeConversationTopic(topic)) {
    return messages
  }

  if (!participantId) {
    return messages
  }

  return messages.filter((message) => {
    if (message.role !== 'assistant') {
      return true
    }

    if (!message.participantId) {
      return true
    }

    return message.participantId === participantId
  })
}

export function buildParticipantDiscussionPrompt({
  participantLabel,
  topic
}: {
  participantLabel?: string
  topic?: Topic
}): string {
  if (!participantLabel || !isCollaborativeConversationTopic(topic)) {
    return ''
  }

  const participants = getTopicParticipants(topic)
  const roster = participants.map((participant) => participant.label).filter(Boolean)
  const otherParticipants = roster.filter((label) => label !== participantLabel)

  const rosterLine =
    otherParticipants.length > 0 ? `Other participants in this discussion: ${otherParticipants.join(', ')}.` : ''

  return [
    'You are participating in a multi-agent group discussion.',
    `Your identity in this conversation is "${participantLabel}".`,
    'Transcript messages from agents are prefixed with speaker labels such as "[Name]". Treat them as comments from other participants in the same group chat.',
    rosterLine,
    'Write like a real teammate in a lively group chat: concise, conversational, and responsive to what others already said.',
    `Reply only as "${participantLabel}". Do not speak for other participants, and when helpful explicitly react to their earlier points before giving your own answer to the user.`
  ]
    .filter(Boolean)
    .join('\n')
}

function formatTranscriptSpeaker(message: Message) {
  if (message.role === 'user') {
    return 'User'
  }

  if (message.participantLabel) {
    return message.participantLabel
  }

  return message.model?.name || 'Assistant'
}

export function buildParticipantTranscript(messages: Message[]) {
  return messages
    .map((message) => {
      const content = getMainTextContent(message)?.trim()
      if (!content) {
        return null
      }

      return `[${formatTranscriptSpeaker(message)}]\n${content}`
    })
    .filter(Boolean)
    .join('\n\n')
}

export function buildAgentParticipantTurnPrompt({
  participantLabel,
  topic,
  messages
}: {
  participantLabel?: string
  topic?: Topic
  messages: Message[]
}) {
  const transcript = buildParticipantTranscript(messages)
  const collaborationPrompt = buildParticipantDiscussionPrompt({ participantLabel, topic })

  return [
    collaborationPrompt,
    'The following transcript is the shared team discussion visible to every participant.',
    transcript ? `<shared_transcript>\n${transcript}\n</shared_transcript>` : '',
    'Continue the discussion by responding to the latest user request and, when useful, react to earlier participant messages.'
  ]
    .filter(Boolean)
    .join('\n\n')
}
