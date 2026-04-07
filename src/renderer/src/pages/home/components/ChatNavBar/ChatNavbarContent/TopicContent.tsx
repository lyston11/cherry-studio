import EmojiIcon from '@renderer/components/EmojiIcon'
import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import TopicParticipantsInput from '@renderer/pages/home/Inputbar/TopicParticipantsInput'
import AssistantSettingsPopup from '@renderer/pages/settings/AssistantSettings'
import { isGroupConversationTopic } from '@renderer/services/ConversationParticipantService'
import type { Assistant, CollaborativeTeamConfig, ConversationParticipant, Topic } from '@renderer/types'
import { getLeadingEmoji } from '@renderer/utils'
import { ChevronRight, Users } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import SelectModelButton from '../../SelectModelButton'
import Tools from '../Tools'

type TopicContentProps = {
  assistant: Assistant
  participants: ConversationParticipant[]
  teamConfig: Required<CollaborativeTeamConfig>
  topic: Topic
  onRemoveParticipant: (participantId: string) => void
  onTeamConfigChange: (config: CollaborativeTeamConfig) => void
}

const TopicContent = ({
  assistant,
  participants,
  teamConfig,
  topic,
  onRemoveParticipant,
  onTeamConfigChange
}: TopicContentProps) => {
  const { t } = useTranslation()
  const assistantName = useMemo(() => assistant.name || t('chat.default.name'), [assistant.name, t])
  const isGroupTopic = isGroupConversationTopic(topic)
  const participantCount = participants.length

  if (isGroupTopic) {
    return (
      <>
        <div className="ml-2 flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--color-primary-soft) text-(--color-primary)">
              <Users size={15} />
            </div>
            <span className="truncate font-medium text-xs">{topic.name}</span>
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-(--color-background-mute) px-1.5 text-(--color-text-secondary) text-[10px]">
              {participantCount}
            </span>
          </div>
          <TopicParticipantsInput
            compact
            participants={participants}
            teamConfig={teamConfig}
            onRemoveParticipant={onRemoveParticipant}
            onTeamConfigChange={onTeamConfigChange}
          />
        </div>
        <Tools assistant={assistant} />
      </>
    )
  }

  return (
    <>
      <HorizontalScrollContainer className="ml-2 flex-initial">
        <div className="flex flex-nowrap items-center gap-2">
          {/* Assistant Label */}
          <div
            className="flex h-full cursor-pointer items-center gap-1.5"
            onClick={() => AssistantSettingsPopup.show({ assistant })}>
            <EmojiIcon emoji={assistant.emoji || getLeadingEmoji(assistantName)} size={24} />
            <span className="max-w-40 truncate text-xs">{assistantName}</span>
          </div>

          {/* Separator */}
          <ChevronRight className="h-4 w-4 text-gray-400" />

          {/* Model Button */}
          <SelectModelButton assistant={assistant} />
        </div>
      </HorizontalScrollContainer>
      <Tools assistant={assistant} />
    </>
  )
}

export default TopicContent
