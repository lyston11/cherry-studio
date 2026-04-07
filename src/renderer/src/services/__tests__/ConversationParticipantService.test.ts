import type { AgentEntity, Assistant, Model, Topic } from '@renderer/types'
import type { Message } from '@renderer/types/newMessage'
import { AssistantMessageStatus, UserMessageStatus } from '@renderer/types/newMessage'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/services/AssistantService', () => ({
  DEFAULT_ASSISTANT_SETTINGS: {
    contextCount: 10
  },
  getAssistantSettings: () => ({ contextCount: 10 }),
  getDefaultAssistant: () => ({
    id: 'assistant-default',
    name: 'Default Assistant',
    prompt: '',
    topics: [],
    type: 'assistant',
    model: {
      id: 'default-model',
      provider: 'openai',
      name: 'Default Model',
      group: 'openai'
    }
  }),
  getDefaultTopic: () => ({
    id: 'topic-default',
    assistantId: 'assistant-default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: 'Default Topic',
    messages: [],
    isNameManuallyEdited: false
  }),
  getAssistantById: (id: string) => ({
    id,
    name: `Assistant ${id}`,
    prompt: '',
    topics: [],
    type: 'assistant',
    model: {
      id: 'assistant-model',
      provider: 'openai',
      name: 'Assistant Model',
      group: 'openai'
    }
  }),
  getDefaultModel: () => ({
    id: 'default-model',
    provider: 'openai',
    name: 'Default Model',
    group: 'openai'
  }),
  getAssistantProvider: () => ({}),
  getProviderByModel: () => ({}),
  getProviderByModelId: () => ({}),
  getQuickModel: () => null,
  getTranslateModel: () => null,
  getDefaultTranslateAssistant: () => ({
    id: 'assistant-default',
    name: 'Default Assistant',
    prompt: '',
    topics: [],
    type: 'assistant'
  })
}))

vi.mock('@renderer/hooks/useModel', () => ({
  getModel: (id?: string, providerId?: string) =>
    id
      ? {
          id,
          provider: providerId ?? 'openai',
          name: `${providerId ?? 'openai'}:${id}`,
          group: providerId ?? 'openai'
        }
      : undefined
}))

vi.mock('@renderer/utils/messageUtils/find', () => ({
  getMainTextContent: (message: Message & { __mockContent?: string }) => message.__mockContent ?? ''
}))

import {
  buildAgentParticipantTurnPrompt,
  buildConversationResponseTargets,
  createConversationParticipantFromAgent
} from '../ConversationParticipantService'

const createModel = (overrides: Partial<Model> = {}): Model => ({
  id: 'gpt-4o-mini',
  provider: 'openai',
  name: 'GPT-4o mini',
  group: 'openai',
  ...overrides
})

const createAssistant = (): Assistant => ({
  id: 'assistant-1',
  name: 'Default Assistant',
  prompt: 'You are helpful',
  topics: [],
  type: 'assistant',
  model: createModel()
})

const createTopic = (participants: Topic['participants'] = []): Topic => ({
  id: 'topic-1',
  assistantId: 'assistant-1',
  name: 'Topic',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [],
  participants
})

const createMessage = (
  role: Message['role'],
  overrides: Partial<Message> & { __mockContent?: string } = {}
): Message & { __mockContent?: string } => ({
  id: overrides.id ?? `${role}-1`,
  role,
  assistantId: overrides.assistantId ?? 'assistant-1',
  topicId: overrides.topicId ?? 'topic-1',
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  status: overrides.status ?? (role === 'assistant' ? AssistantMessageStatus.SUCCESS : UserMessageStatus.SUCCESS),
  blocks: overrides.blocks ?? [],
  ...overrides
})

describe('ConversationParticipantService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds agent response targets with persisted session state', () => {
    const agent: AgentEntity = {
      id: 'agent-1',
      type: 'claude-code',
      name: 'Planner',
      description: 'Planning agent',
      instructions: 'Plan carefully',
      model: 'openai:gpt-4o-mini',
      accessible_paths: [],
      allowed_tools: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    const agentParticipant = {
      ...createConversationParticipantFromAgent(agent),
      sessionId: 'session-1',
      agentSessionId: 'runtime-1'
    }
    const topic = createTopic([agentParticipant])

    const targets = buildConversationResponseTargets({
      assistant: createAssistant(),
      topic
    })

    expect(targets).toHaveLength(1)
    expect(targets[0]).toMatchObject({
      kind: 'agent',
      agentId: 'agent-1',
      sessionId: 'session-1',
      agentSessionId: 'runtime-1',
      participantLabel: 'Planner'
    })
  })

  it('renders shared transcript prompts for agent participants', () => {
    const topic = createTopic([
      { id: 'agent:planner', type: 'agent', sourceAgentId: 'agent-1', label: 'Planner' },
      {
        id: 'assistant:critic',
        type: 'assistant',
        sourceAssistantId: 'assistant-2',
        label: 'Critic',
        model: createModel()
      }
    ])

    const prompt = buildAgentParticipantTurnPrompt({
      participantLabel: 'Planner',
      topic,
      messages: [
        createMessage('user', { id: 'user-1', __mockContent: 'How should we launch this feature?' }),
        createMessage('assistant', {
          id: 'assistant-1',
          participantId: 'assistant:critic',
          participantLabel: 'Critic',
          __mockContent: 'We need staged rollout first.'
        })
      ]
    })

    expect(prompt).toContain('Your identity in this conversation is "Planner".')
    expect(prompt).toContain('[User]\nHow should we launch this feature?')
    expect(prompt).toContain('[Critic]\nWe need staged rollout first.')
  })
})
