import { loggerService } from '@logger'
import type { ContentSearchRef } from '@renderer/components/ContentSearch'
import { ContentSearch } from '@renderer/components/ContentSearch'
import { HStack } from '@renderer/components/Layout'
import MultiSelectActionPopup from '@renderer/components/Popups/MultiSelectionPopup'
import PromptPopup from '@renderer/components/Popups/PromptPopup'
import { SelectChatModelPopup } from '@renderer/components/Popups/SelectModelPopup'
import { QuickPanelProvider } from '@renderer/components/QuickPanel'
import { isEmbeddingModel, isRerankModel, isWebSearchModel } from '@renderer/config/models'
import { useAgents } from '@renderer/hooks/agents/useAgents'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { useChatContext } from '@renderer/hooks/useChatContext'
import { useNavbarPosition, useSettings } from '@renderer/hooks/useSettings'
import { useShortcut } from '@renderer/hooks/useShortcuts'
import { useShowTopics } from '@renderer/hooks/useStore'
import { useTimer } from '@renderer/hooks/useTimer'
import { getAssistantById } from '@renderer/services/AssistantService'
import {
  CONVERSATION_PARTICIPANT_MIME_TYPE,
  createConversationParticipantFromAgent,
  createConversationParticipantFromAssistant,
  getTopicParticipants,
  hasConversationParticipantDragType,
  isGroupConversationTopic,
  parseConversationParticipantDragPayload,
  removeTopicParticipant,
  upsertTopicParticipant
} from '@renderer/services/ConversationParticipantService'
import { getTopicTeamConfig } from '@renderer/services/ConversationTeamService'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import type { Assistant, ConversationParticipant, Model, Topic } from '@renderer/types'
import { classNames } from '@renderer/utils'
import { Flex } from 'antd'
import { debounce } from 'lodash'
import { AnimatePresence, motion } from 'motion/react'
import type { FC } from 'react'
import React, { useCallback, useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import ChatNavbar from './components/ChatNavBar'
import Inputbar from './Inputbar/Inputbar'
import ChatNavigation from './Messages/ChatNavigation'
import Messages from './Messages/Messages'
import Tabs from './Tabs'

const logger = loggerService.withContext('Chat')

interface Props {
  assistant: Assistant
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
  setActiveAssistant: (assistant: Assistant) => void
  setActiveConversation: (assistant: Assistant, topic: Topic) => void
}

const Chat: FC<Props> = (props) => {
  const { activeTopic, setActiveAssistant, setActiveConversation, setActiveTopic } = props
  const { assistant, updateAssistant, updateTopic } = useAssistant(props.assistant.id)
  const { agents } = useAgents()
  const { t } = useTranslation()
  const { topicPosition, messageStyle, messageNavigation } = useSettings()
  const { showTopics } = useShowTopics()
  const { isMultiSelectMode } = useChatContext(activeTopic)
  const { isTopNavbar } = useNavbarPosition()

  const mainRef = React.useRef<HTMLDivElement>(null)
  const contentSearchRef = React.useRef<ContentSearchRef>(null)
  const [filterIncludeUser, setFilterIncludeUser] = useState(false)
  const [isDraggingParticipant, setIsDraggingParticipant] = useState(false)

  const { setTimeoutTimer } = useTimer()
  const isGroupTopic = isGroupConversationTopic(activeTopic)

  useEffect(() => {
    setIsDraggingParticipant(false)
  }, [activeTopic.id])

  useHotkeys('esc', () => {
    contentSearchRef.current?.disable()
  })

  useShortcut('search_message_in_chat', () => {
    try {
      const selectedText = window.getSelection()?.toString().trim()
      contentSearchRef.current?.enable(selectedText)
    } catch (error) {
      logger.error('Error enabling content search:', error as Error)
    }
  })

  useShortcut('rename_topic', async () => {
    const topic = props.activeTopic
    if (!topic) return

    void EventEmitter.emit(EVENT_NAMES.SHOW_TOPIC_SIDEBAR)

    const name = await PromptPopup.show({
      title: t('chat.topics.edit.title'),
      message: '',
      defaultValue: topic.name || '',
      extraNode: <div style={{ color: 'var(--color-text-3)', marginTop: 8 }}>{t('chat.topics.edit.title_tip')}</div>
    })
    if (name && topic.name !== name) {
      const updatedTopic = { ...topic, name, isNameManuallyEdited: true }
      updateTopic(updatedTopic as Topic)
    }
  })

  useShortcut('select_model', async () => {
    const modelFilter = (m: Model) => !isEmbeddingModel(m) && !isRerankModel(m)
    const selectedModel = await SelectChatModelPopup.show({ model: assistant?.model, filter: modelFilter })
    if (selectedModel) {
      const enabledWebSearch = isWebSearchModel(selectedModel)
      updateAssistant({
        ...props.assistant,
        model: selectedModel,
        enableWebSearch: enabledWebSearch && props.assistant.enableWebSearch
      })
    }
  })

  const contentSearchFilter: NodeFilter = {
    acceptNode(node) {
      const container = node.parentElement?.closest('.message-content-container')
      if (!container) return NodeFilter.FILTER_REJECT

      const message = container.closest('.message')
      if (!message) return NodeFilter.FILTER_REJECT

      if (filterIncludeUser) {
        return NodeFilter.FILTER_ACCEPT
      }
      if (message.classList.contains('message-assistant')) {
        return NodeFilter.FILTER_ACCEPT
      }
      return NodeFilter.FILTER_REJECT
    }
  }

  const userOutlinedItemClickHandler = () => {
    setFilterIncludeUser(!filterIncludeUser)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeoutTimer(
          'userOutlinedItemClickHandler',
          () => {
            contentSearchRef.current?.search()
            contentSearchRef.current?.focus()
          },
          0
        )
      })
    })
  }

  let firstUpdateCompleted = false
  const firstUpdateOrNoFirstUpdateHandler = debounce(() => {
    contentSearchRef.current?.silentSearch()
  }, 10)

  const messagesComponentUpdateHandler = () => {
    if (firstUpdateCompleted) {
      firstUpdateOrNoFirstUpdateHandler()
    }
  }

  const messagesComponentFirstUpdateHandler = () => {
    setTimeoutTimer('messagesComponentFirstUpdateHandler', () => (firstUpdateCompleted = true), 300)
    firstUpdateOrNoFirstUpdateHandler()
  }

  const mainHeight = isTopNavbar ? 'calc(100vh - var(--navbar-height) - 6px)' : 'calc(100vh - var(--navbar-height))'

  const syncActiveTopic = useCallback(
    (nextTopic: Topic) => {
      updateTopic(nextTopic)
      setActiveTopic(nextTopic)
    },
    [setActiveTopic, updateTopic]
  )

  const handleAddParticipant = useCallback(
    (participant: ConversationParticipant) => {
      if (!isGroupConversationTopic(activeTopic)) {
        return
      }

      const nextTopic = upsertTopicParticipant(activeTopic, participant)
      if (nextTopic === activeTopic) {
        return
      }

      syncActiveTopic(nextTopic)
    },
    [activeTopic, syncActiveTopic]
  )

  const handleRemoveParticipant = useCallback(
    (participantId: string) => {
      syncActiveTopic(removeTopicParticipant(activeTopic, participantId))
    },
    [activeTopic, syncActiveTopic]
  )

  const handleTeamConfigChange = useCallback(
    (updates: NonNullable<Topic['teamConfig']>) => {
      syncActiveTopic({
        ...activeTopic,
        teamConfig: {
          ...getTopicTeamConfig(activeTopic),
          ...updates
        }
      })
    },
    [activeTopic, syncActiveTopic]
  )

  const resolveParticipantPayload = useCallback(
    (rawPayload: string | null) => {
      const payload = parseConversationParticipantDragPayload(rawPayload)
      if (!payload) {
        return null
      }

      if (payload.participantType === 'agent') {
        const agent = agents?.find((item) => item.id === payload.agentId)
        return agent ? createConversationParticipantFromAgent(agent) : null
      }

      const assistantToAdd = payload.assistantId === assistant.id ? assistant : getAssistantById(payload.assistantId)
      if (!assistantToAdd) {
        return null
      }

      return createConversationParticipantFromAssistant(assistantToAdd)
    },
    [agents, assistant]
  )

  useEffect(() => {
    const unsubscribes = [
      EventEmitter.on(
        EVENT_NAMES.ADD_TOPIC_PARTICIPANT,
        ({ assistantId, agentId }: { assistantId?: string; agentId?: string }) => {
          if (!isGroupConversationTopic(activeTopic)) {
            return
          }

          if (assistantId) {
            const assistantToAdd = assistantId === assistant.id ? assistant : getAssistantById(assistantId)
            if (!assistantToAdd) {
              return
            }

            const participant = createConversationParticipantFromAssistant(assistantToAdd)
            if (participant) {
              handleAddParticipant(participant)
            }
            return
          }

          if (!agentId) {
            return
          }

          const agentToAdd = agents?.find((item) => item.id === agentId)
          if (agentToAdd) {
            handleAddParticipant(createConversationParticipantFromAgent(agentToAdd))
          }
        }
      )
    ]

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe())
    }
  }, [activeTopic, agents, assistant, handleAddParticipant])

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isGroupTopic || !hasConversationParticipantDragType(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setIsDraggingParticipant(true)
    },
    [isGroupTopic]
  )

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isGroupTopic || !hasConversationParticipantDragType(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setIsDraggingParticipant(true)
    },
    [isGroupTopic]
  )

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isGroupTopic || !hasConversationParticipantDragType(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (event.currentTarget.contains(event.relatedTarget as Node)) {
        return
      }

      setIsDraggingParticipant(false)
    },
    [isGroupTopic]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isGroupTopic || !hasConversationParticipantDragType(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setIsDraggingParticipant(false)

      const participant = resolveParticipantPayload(event.dataTransfer.getData(CONVERSATION_PARTICIPANT_MIME_TYPE))
      if (participant) {
        handleAddParticipant(participant)
      }
    },
    [handleAddParticipant, isGroupTopic, resolveParticipantPayload]
  )

  return (
    <Container id="chat" className={classNames([messageStyle, { 'multi-select-mode': isMultiSelectMode }])}>
      <HStack>
        <motion.div
          layout
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
          <Main
            ref={mainRef}
            id="chat-main"
            vertical
            flex={1}
            justify="space-between"
            style={{ height: mainHeight, width: '100%' }}>
            <QuickPanelProvider>
              <ChatNavbar
                activeAssistant={props.assistant}
                activeTopic={activeTopic}
                participants={getTopicParticipants(activeTopic)}
                setActiveTopic={setActiveTopic}
                setActiveAssistant={setActiveAssistant}
                setActiveConversation={setActiveConversation}
                teamConfig={getTopicTeamConfig(activeTopic)}
                onRemoveParticipant={handleRemoveParticipant}
                onTeamConfigChange={handleTeamConfigChange}
                position="left"
              />
              <div
                className="flex min-h-0 flex-1 flex-col"
                style={{ height: `calc(${mainHeight} - var(--navbar-height))` }}>
                <GroupChatFrame
                  $isActiveDropTarget={isGroupTopic && isDraggingParticipant}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}>
                  <Messages
                    key={activeTopic.id}
                    assistant={assistant}
                    topic={activeTopic}
                    setActiveTopic={setActiveTopic}
                    onComponentUpdate={messagesComponentUpdateHandler}
                    onFirstUpdate={messagesComponentFirstUpdateHandler}
                  />
                  {isGroupTopic && isDraggingParticipant && <DropHint>{t('chat.group.drop.hint')}</DropHint>}
                </GroupChatFrame>
                <ContentSearch
                  ref={contentSearchRef}
                  searchTarget={mainRef as React.RefObject<HTMLElement>}
                  filter={contentSearchFilter}
                  includeUser={filterIncludeUser}
                  onIncludeUserChange={userOutlinedItemClickHandler}
                />
                {messageNavigation === 'buttons' && <ChatNavigation containerId="messages" />}
                <Inputbar assistant={assistant} setActiveTopic={setActiveTopic} topic={activeTopic} />
                {isMultiSelectMode && <MultiSelectActionPopup topic={activeTopic} />}
              </div>
            </QuickPanelProvider>
          </Main>
        </motion.div>
        <AnimatePresence initial={false}>
          {topicPosition === 'right' && showTopics && (
            <motion.div
              key="right-tabs"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'var(--assistants-width)', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{
                overflow: 'hidden'
              }}>
              <Tabs
                activeAssistant={assistant}
                activeTopic={activeTopic}
                setActiveAssistant={setActiveAssistant}
                setActiveConversation={setActiveConversation}
                setActiveTopic={setActiveTopic}
                position="right"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </HStack>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--navbar-height));
  flex: 1;
  overflow: hidden;
  [navbar-position='top'] & {
    height: calc(100vh - var(--navbar-height) - 6px);
    background-color: var(--color-background);
    border-top-left-radius: 10px;
    border-bottom-left-radius: 10px;
  }
`

const Main = styled(Flex)`
  [navbar-position='left'] & {
    height: calc(100vh - var(--navbar-height));
  }
  transform: translateZ(0);
  position: relative;
`

const GroupChatFrame = styled.div<{ $isActiveDropTarget: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  border-radius: 16px;
  transition:
    box-shadow 0.2s ease,
    background 0.2s ease;
  box-shadow: ${({ $isActiveDropTarget }) => ($isActiveDropTarget ? 'inset 0 0 0 1px var(--color-primary)' : 'none')};
  background: ${({ $isActiveDropTarget }) =>
    $isActiveDropTarget ? 'color-mix(in srgb, var(--color-primary) 7%, transparent)' : 'transparent'};
`

const DropHint = styled.div`
  position: absolute;
  inset: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--color-primary);
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
`

export default Chat
