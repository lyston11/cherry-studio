import AssistantAvatar from '@renderer/components/Avatar/AssistantAvatar'
import Scrollbar from '@renderer/components/Scrollbar'
import { db } from '@renderer/databases'
import { useAssistants } from '@renderer/hooks/useAssistant'
import { getDefaultGroupTopic } from '@renderer/services/AssistantService'
import {
  CONVERSATION_PARTICIPANT_MIME_TYPE,
  createConversationParticipantFromAssistant,
  getTopicParticipants,
  isGroupConversationTopic
} from '@renderer/services/ConversationParticipantService'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { useAppDispatch } from '@renderer/store'
import { addTopic as addTopicAction } from '@renderer/store/assistants'
import type { Assistant, Topic } from '@renderer/types'
import type { MenuProps } from 'antd'
import { Dropdown, Tooltip } from 'antd'
import dayjs from 'dayjs'
import { Plus, Users } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import CreateGroupChatPopup from './components/CreateGroupChatPopup'

interface Props {
  activeAssistant: Assistant
  activeTopic: Topic
  setActiveConversation: (assistant: Assistant, topic: Topic) => void
  onCreateAssistant: () => void
}

type ConversationListItem = {
  key: string
  assistant: Assistant
  topic: Topic
  isGroup: boolean
  title: string
  subtitle: string
  timestamp: string
}

const ConversationsTab: FC<Props> = ({ activeAssistant, activeTopic, setActiveConversation, onCreateAssistant }) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { assistants } = useAssistants()
  const [hoveredConversationId, setHoveredConversationId] = useState<string | null>(null)

  const activeGroupAssistantIds = useMemo(
    () =>
      new Set(
        getTopicParticipants(activeTopic)
          .map((participant) => participant.sourceAssistantId)
          .filter((value): value is string => !!value)
      ),
    [activeTopic]
  )

  const conversations = useMemo<ConversationListItem[]>(() => {
    const defaultSingleTopicName = t('chat.default.topic.name')

    return assistants
      .flatMap((assistant) =>
        assistant.topics.map((topic) => {
          const isGroup = isGroupConversationTopic(topic)
          const participants = getTopicParticipants(topic)
          const title =
            !isGroup && topic.name === defaultSingleTopicName ? assistant.name || t('chat.default.name') : topic.name
          const subtitle = isGroup
            ? participants.map((participant) => participant.label).join(' · ') || t('chat.group.members.empty')
            : assistant.model?.name || assistant.defaultModel?.name || t('common.sessions')

          return {
            key: topic.id,
            assistant,
            topic,
            isGroup,
            title,
            subtitle,
            timestamp: topic.updatedAt || topic.createdAt
          }
        })
      )
      .sort((left, right) => {
        if (left.topic.pinned !== right.topic.pinned) {
          return left.topic.pinned ? -1 : 1
        }

        return dayjs(right.timestamp).valueOf() - dayjs(left.timestamp).valueOf()
      })
  }, [assistants, t])

  const handleCreateGroup = useCallback(async () => {
    const result = await CreateGroupChatPopup.show({
      assistants,
      initialSelectedAssistantIds: activeAssistant?.id ? [activeAssistant.id] : []
    })

    if (!result) {
      return
    }

    const selectedAssistants = assistants.filter((assistant) => result.assistantIds.includes(assistant.id))
    const participants = selectedAssistants
      .map((assistant) => createConversationParticipantFromAssistant(assistant))
      .filter((participant): participant is NonNullable<typeof participant> => !!participant)

    if (participants.length === 0) {
      window.toast.error(t('chat.group.create.empty'))
      return
    }

    const ownerAssistant = selectedAssistants[0] ?? activeAssistant
    const topic = {
      ...getDefaultGroupTopic(ownerAssistant.id),
      name: result.name || t('chat.default.group_topic.name'),
      participants
    }

    await db.topics.add({ id: topic.id, messages: [] })
    dispatch(addTopicAction({ assistantId: ownerAssistant.id, topic }))
    setActiveConversation(ownerAssistant, topic)
  }, [activeAssistant, assistants, dispatch, setActiveConversation, t])

  const quickCreateItems = useMemo<MenuProps['items']>(
    () => [
      {
        key: 'assistant',
        label: t('chat.add.assistant.title'),
        onClick: () => onCreateAssistant()
      },
      {
        key: 'group',
        label: t('chat.add.group.title'),
        onClick: () => void handleCreateGroup()
      }
    ],
    [handleCreateGroup, onCreateAssistant, t]
  )

  const handleAddParticipant = useCallback((assistantId: string) => {
    void EventEmitter.emit(EVENT_NAMES.ADD_TOPIC_PARTICIPANT, { assistantId })
  }, [])

  const formatTimestamp = useCallback((value: string) => {
    const date = dayjs(value)
    return date.isSame(dayjs(), 'day') ? date.format('HH:mm') : date.format('MM/DD')
  }, [])

  return (
    <Container>
      <Header>
        <HeaderTitle>{t('common.sessions')}</HeaderTitle>
        <Dropdown menu={{ items: quickCreateItems }} trigger={['click']} placement="bottomRight">
          <HeaderButton>
            <Plus size={15} />
          </HeaderButton>
        </Dropdown>
      </Header>

      <ConversationList>
        {conversations.map((conversation) => {
          const isActive = conversation.topic.id === activeTopic.id
          const canInviteToGroup =
            isGroupConversationTopic(activeTopic) &&
            !conversation.isGroup &&
            !activeGroupAssistantIds.has(conversation.assistant.id)

          const handleDragStart = (event: React.DragEvent<HTMLButtonElement>) => {
            if (!canInviteToGroup) {
              event.preventDefault()
              return
            }

            event.dataTransfer.effectAllowed = 'copy'
            event.dataTransfer.setData(
              CONVERSATION_PARTICIPANT_MIME_TYPE,
              JSON.stringify({
                participantType: 'assistant',
                assistantId: conversation.assistant.id
              })
            )
          }

          return (
            <ConversationItem
              key={conversation.key}
              type="button"
              draggable={canInviteToGroup}
              $active={isActive}
              onClick={() => setActiveConversation(conversation.assistant, conversation.topic)}
              onDragStart={handleDragStart}
              onMouseEnter={() => setHoveredConversationId(conversation.key)}
              onMouseLeave={() =>
                setHoveredConversationId((current) => (current === conversation.key ? null : current))
              }>
              <ConversationAvatar>
                {conversation.isGroup ? (
                  <GroupAvatar>
                    <Users size={15} />
                  </GroupAvatar>
                ) : (
                  <AssistantAvatar assistant={conversation.assistant} size={26} />
                )}
              </ConversationAvatar>

              <ConversationMain>
                <ConversationTopRow>
                  <ConversationTitle>{conversation.title}</ConversationTitle>
                  <ConversationTime>{formatTimestamp(conversation.timestamp)}</ConversationTime>
                </ConversationTopRow>
                <ConversationBottomRow>
                  <ConversationSubtitle>{conversation.subtitle}</ConversationSubtitle>
                </ConversationBottomRow>
              </ConversationMain>

              {canInviteToGroup && hoveredConversationId === conversation.key && (
                <Tooltip title={t('chat.input.participants.assistant_action')}>
                  <InviteButton
                    onClick={(event) => {
                      event.stopPropagation()
                      handleAddParticipant(conversation.assistant.id)
                    }}>
                    <Plus size={13} />
                  </InviteButton>
                </Tooltip>
              )}
            </ConversationItem>
          )
        })}
      </ConversationList>
    </Container>
  )
}

const Container = styled(Scrollbar)`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 10px;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`

const HeaderTitle = styled.div`
  color: var(--color-text);
  font-size: 15px;
  font-weight: 600;
`

const HeaderButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-background);
  color: var(--color-text-secondary);
  cursor: pointer;

  &:hover {
    color: var(--color-text);
    background: var(--color-list-item-hover);
  }
`

const ConversationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ConversationItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(var(--assistants-width) - 20px);
  padding: 10px 12px;
  border: none;
  border-radius: var(--list-item-border-radius);
  background: ${({ $active }) => ($active ? 'var(--color-list-item)' : 'transparent')};
  box-shadow: ${({ $active }) => ($active ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none')};
  cursor: pointer;
  text-align: left;

  &:hover {
    background: ${({ $active }) => ($active ? 'var(--color-list-item)' : 'var(--color-list-item-hover)')};
  }
`

const ConversationAvatar = styled.div`
  flex-shrink: 0;
`

const GroupAvatar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-primary);
`

const ConversationMain = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const ConversationTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`

const ConversationBottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ConversationTitle = styled.div`
  min-width: 0;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ConversationSubtitle = styled.div`
  min-width: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ConversationTime = styled.div`
  flex-shrink: 0;
  color: var(--color-text-tertiary);
  font-size: 11px;
`

const InviteButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-background-mute) 60%, transparent);
  color: var(--color-text-secondary);
  cursor: pointer;
`

export default ConversationsTab
