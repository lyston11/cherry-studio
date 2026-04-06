import type { Assistant, CollaborativeTeamConfig, ConversationParticipant, Topic } from '@renderer/types'
import type { FC } from 'react'

import TopicContent from './TopicContent'

interface Props {
  assistant: Assistant
  participants: ConversationParticipant[]
  teamConfig: Required<CollaborativeTeamConfig>
  topic: Topic
  onRemoveParticipant: (participantId: string) => void
  onTeamConfigChange: (config: CollaborativeTeamConfig) => void
}

const ChatNavbarContent: FC<Props> = ({
  assistant,
  participants,
  teamConfig,
  topic,
  onRemoveParticipant,
  onTeamConfigChange
}) => {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between">
      <TopicContent
        assistant={assistant}
        participants={participants}
        teamConfig={teamConfig}
        topic={topic}
        onRemoveParticipant={onRemoveParticipant}
        onTeamConfigChange={onTeamConfigChange}
      />
    </div>
  )
}

export default ChatNavbarContent
