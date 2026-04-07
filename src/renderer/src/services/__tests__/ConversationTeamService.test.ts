import type { Topic } from '@renderer/types'
import type { Message } from '@renderer/types/newMessage'
import { AssistantMessageStatus, UserMessageStatus } from '@renderer/types/newMessage'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/utils/messageUtils/find', () => ({
  getMainTextContent: (message: Message & { __mockContent?: string }) => message.__mockContent ?? ''
}))

import {
  buildHiddenOrchestratorPrompt,
  buildSelectedSpeakerPrompt,
  DEFAULT_COLLABORATIVE_TEAM_CONFIG,
  getCollaborativeDiscussionSignals,
  getConversationResponseTargetKey,
  getTopicTeamConfig,
  parseCollaborativeTurnPlan,
  parseSelectedTargetKey,
  selectNextResponseTargetFallback
} from '../ConversationTeamService'

const createTopic = (overrides: Partial<Topic> = {}): Topic => ({
  id: 'topic-1',
  assistantId: 'assistant-1',
  name: 'Topic',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [],
  ...overrides
})

const assistantTarget = {
  kind: 'assistant' as const,
  key: 'participant:assistant-a',
  participantId: 'assistant-a',
  participantLabel: 'Architect',
  model: {
    id: 'gpt-4o-mini',
    provider: 'openai',
    name: 'GPT-4o mini',
    group: 'openai'
  },
  assistantConfig: {
    id: 'assistant-1',
    name: 'Architect',
    prompt: '',
    topics: [],
    type: 'assistant',
    model: {
      id: 'gpt-4o-mini',
      provider: 'openai',
      name: 'GPT-4o mini',
      group: 'openai'
    }
  }
}

const agentTarget = {
  kind: 'agent' as const,
  key: 'participant:agent-b',
  participantId: 'agent-b',
  participantLabel: 'Critic',
  agentId: 'agent-1'
}

const createMessage = (
  overrides: Partial<Message> & { __mockContent?: string } = {}
): Message & { __mockContent?: string } => ({
  id: overrides.id ?? 'message-1',
  role: overrides.role ?? 'assistant',
  assistantId: overrides.assistantId ?? 'assistant-1',
  topicId: overrides.topicId ?? 'topic-1',
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  status: overrides.status ?? AssistantMessageStatus.SUCCESS,
  blocks: overrides.blocks ?? [],
  ...overrides
})

describe('ConversationTeamService', () => {
  it('provides default team config when topic has no custom config', () => {
    expect(getTopicTeamConfig(createTopic())).toEqual(DEFAULT_COLLABORATIVE_TEAM_CONFIG)
  })

  it('normalizes custom maxTurns into the supported range', () => {
    expect(getTopicTeamConfig(createTopic({ teamConfig: { maxTurns: 99, moderatorEnabled: false } }))).toEqual({
      strategy: 'selector',
      maxTurns: 6,
      moderatorEnabled: false
    })
  })

  it('parses a selector response using participant label fallback', () => {
    expect(parseSelectedTargetKey('Critic', [assistantTarget, agentTarget])).toBe('agent-b')
  })

  it('parses a hidden orchestrator plan from json', () => {
    expect(
      parseCollaborativeTurnPlan(
        JSON.stringify({
          action: 'speak',
          speakerId: 'assistant-a',
          instruction: 'Open with the main recommendation first.'
        }),
        [assistantTarget, agentTarget]
      )
    ).toEqual({
      action: 'speak',
      speakerId: 'assistant-a',
      instruction: 'Open with the main recommendation first.'
    })
  })

  it('allows the hidden orchestrator to finish the discussion early', () => {
    expect(parseCollaborativeTurnPlan('{"action":"finish"}', [assistantTarget, agentTarget])).toEqual({
      action: 'finish'
    })
  })

  it('includes target capability summaries in the hidden orchestrator prompt', () => {
    const prompt = buildHiddenOrchestratorPrompt({
      topic: createTopic(),
      targets: [assistantTarget, agentTarget],
      turnIndex: 0,
      maxTurns: 3,
      hasVisibleReplies: false,
      targetCapabilitySummaries: {
        'assistant-a': 'web search; knowledge retrieval',
        'agent-b': 'tools: Read, Edit; files: /workspace'
      },
      latestUserRequest: 'Architect 和 Critic 先讨论一下方案和风险。',
      directlyAddressedParticipants: ['Architect', 'Critic'],
      suggestedVisibleReplyCount: 3
    })

    expect(prompt).toContain('capabilities: web search; knowledge retrieval')
    expect(prompt).toContain('capabilities: tools: Read, Edit; files: /workspace')
    expect(prompt).toContain('The user directly called on: Architect, Critic')
    expect(prompt).toContain('Up to 3 visible replies can feel natural')
  })

  it('derives discussion pacing signals from the latest user request', () => {
    const signals = getCollaborativeDiscussionSignals({
      messages: [
        createMessage({
          id: 'older-user-msg',
          role: 'user',
          status: UserMessageStatus.SUCCESS,
          __mockContent: 'Ignore this earlier turn.'
        }),
        createMessage({
          id: 'older-assistant-msg',
          participantId: 'assistant-a',
          participantLabel: 'Architect',
          __mockContent: 'Older reply.'
        }),
        createMessage({
          id: 'latest-user-msg',
          role: 'user',
          status: UserMessageStatus.SUCCESS,
          __mockContent: 'Architect 和 Critic 你们先讨论一下方案、风险和取舍，再给我建议。'
        })
      ],
      targets: [assistantTarget, agentTarget],
      maxTurns: 4
    })

    expect(signals.directlyAddressedParticipants).toEqual(['Architect', 'Critic'])
    expect(signals.suggestedVisibleReplyCount).toBe(3)
    expect(signals.visibleReplyCount).toBe(0)
  })

  it('guides later speakers to close the loop naturally', () => {
    const prompt = buildSelectedSpeakerPrompt({
      participantLabel: 'Critic',
      turnIndex: 2,
      maxTurns: 4,
      suggestedVisibleReplyCount: 2,
      lastSpeakerLabel: 'Architect'
    })

    expect(prompt).toContain('close the loop')
    expect(prompt).toContain('clear recommendation, decision, or next step')
  })

  it('falls back to an unspoken non-repeating target when selector output is invalid', () => {
    const selected = selectNextResponseTargetFallback({
      targets: [assistantTarget, agentTarget],
      messages: [
        createMessage({
          id: 'assistant-msg',
          participantId: 'assistant-a',
          participantLabel: 'Architect',
          __mockContent: 'We should ship behind a flag.'
        }),
        createMessage({
          id: 'user-msg',
          role: 'user',
          status: UserMessageStatus.SUCCESS,
          __mockContent: 'Critic, what risks do you see?'
        })
      ],
      usedTargetKeys: [getConversationResponseTargetKey(assistantTarget)],
      lastSpeakerKey: 'assistant-a'
    })

    expect(selected).toEqual(agentTarget)
  })
})
