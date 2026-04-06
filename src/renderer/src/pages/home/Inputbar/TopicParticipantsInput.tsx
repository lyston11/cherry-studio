import EmojiAvatar from '@renderer/components/Avatar/EmojiAvatar'
import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import CustomTag from '@renderer/components/Tags/CustomTag'
import { isAgentConversationParticipant } from '@renderer/services/ConversationParticipantService'
import type { CollaborativeTeamConfig, ConversationParticipant } from '@renderer/types'
import { firstLetter, isEmoji } from '@renderer/utils/naming'
import { Avatar, InputNumber, Popover, Tooltip } from 'antd'
import { Bot, Users, X } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  participants: ConversationParticipant[]
  teamConfig: Required<CollaborativeTeamConfig>
  onTeamConfigChange: (config: CollaborativeTeamConfig) => void
  onRemoveParticipant: (participantId: string) => void
  compact?: boolean
}

const TopicParticipantsInput: FC<Props> = ({
  participants,
  teamConfig,
  onTeamConfigChange,
  onRemoveParticipant,
  compact = false
}) => {
  const { t } = useTranslation()

  const renderParticipantAvatar = (participant: ConversationParticipant, size: number) => {
    if (participant.emoji) {
      if (isEmoji(participant.emoji)) {
        return <EmojiAvatar size={size} fontSize={size * 0.52}>{participant.emoji}</EmojiAvatar>
      }

      return (
        <Avatar
          src={participant.emoji}
          size={size}
          icon={isAgentConversationParticipant(participant) ? <Bot size={size * 0.55} /> : undefined}>
          {firstLetter(participant.label).toUpperCase()}
        </Avatar>
      )
    }

    if (participant.model && !isAgentConversationParticipant(participant)) {
      return <ModelAvatar model={participant.model} size={size} />
    }

    return (
      <Avatar
        size={size}
        icon={isAgentConversationParticipant(participant) ? <Bot size={size * 0.55} /> : <Users size={size * 0.55} />}
        style={{
          backgroundColor: isAgentConversationParticipant(participant)
            ? 'color-mix(in srgb, var(--color-primary) 18%, var(--color-background))'
            : 'color-mix(in srgb, var(--color-info) 18%, var(--color-background))',
          color: isAgentConversationParticipant(participant) ? 'var(--color-primary)' : 'var(--color-info)'
        }}>
        {firstLetter(participant.label).toUpperCase()}
      </Avatar>
    )
  }

  const settingsContent = (
    <SettingsContent>
      <SettingsSection>
        <SectionHeader>
          <SectionTitle>
            <Users size={14} />
            <span>{t('chat.group.members.title')}</span>
          </SectionTitle>
          <SectionMeta>{t('chat.group.members.count', { count: participants.length })}</SectionMeta>
        </SectionHeader>
        {participants.length > 0 ? (
          <ParticipantList>
            {participants.map((participant) => {
              const typeLabel = isAgentConversationParticipant(participant)
                ? t('common.agent_one')
                : t('common.assistant')

              return (
                <ParticipantListItem key={participant.id}>
                  <ParticipantSummary>
                    {renderParticipantAvatar(participant, 24)}
                    <ParticipantText>
                      <ParticipantName>{participant.label}</ParticipantName>
                      <ParticipantDetail>
                        {typeLabel}
                        {participant.model?.name ? ` · ${participant.model.name}` : ''}
                      </ParticipantDetail>
                    </ParticipantText>
                  </ParticipantSummary>
                  <RemoveParticipantButton
                    type="button"
                    aria-label={t('common.delete')}
                    onClick={() => onRemoveParticipant(participant.id)}>
                    <X size={14} />
                  </RemoveParticipantButton>
                </ParticipantListItem>
              )
            })}
          </ParticipantList>
        ) : (
          <CompactEmptyState>
            <Users size={14} />
            <EmptyText>{t('chat.group.members.empty')}</EmptyText>
          </CompactEmptyState>
        )}
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection>
        <SettingRow>
          <SettingLabel>{t('chat.input.participants.team.turns')}</SettingLabel>
          <InputNumber
            size="small"
            min={1}
            max={6}
            value={teamConfig.maxTurns}
            onChange={(value) => onTeamConfigChange({ maxTurns: Number(value) || 1 })}
          />
        </SettingRow>
      </SettingsSection>
    </SettingsContent>
  )

  if (compact) {
    return (
      <CompactContainer>
        {participants.length > 0 && (
          <CompactAvatars>
            {participants.map((participant) => {
              const typeLabel = isAgentConversationParticipant(participant)
                ? t('common.agent_one')
                : t('common.assistant')

              return (
                <Popover
                  key={participant.id}
                  trigger="hover"
                  arrow={false}
                  mouseEnterDelay={0.12}
                  placement="bottom"
                  content={
                    <HoverCard>
                      <HoverTitle>{participant.label}</HoverTitle>
                      <HoverMeta>{typeLabel}</HoverMeta>
                      {participant.model?.name && <HoverMeta>{participant.model.name}</HoverMeta>}
                    </HoverCard>
                  }>
                  <ParticipantAvatarButton type="button">{renderParticipantAvatar(participant, 24)}</ParticipantAvatarButton>
                </Popover>
              )
            })}
          </CompactAvatars>
        )}
        <Tooltip title={t('chat.group.members.title')} mouseEnterDelay={0.6}>
          <Popover trigger="click" arrow={false} placement="bottomRight" content={settingsContent}>
            <SettingsButton type="button">
              <Users size={14} />
            </SettingsButton>
          </Popover>
        </Tooltip>
      </CompactContainer>
    )
  }

  return (
    <Container>
      <Panel $isEmpty={participants.length === 0}>
        <PanelHeader>
          <PanelTitle>
            <Users size={15} />
            <span>{t('chat.group.members.title')}</span>
          </PanelTitle>
          <Tooltip title={t('chat.group.members.title')} mouseEnterDelay={0.6}>
            <Popover trigger="click" arrow={false} placement="bottomRight" content={settingsContent}>
              <SettingsButton type="button">
                <Users size={14} />
              </SettingsButton>
            </Popover>
          </Tooltip>
        </PanelHeader>

        {participants.length > 0 ? (
          <ContentArea>
            <HorizontalScrollContainer dependencies={[participants]} expandable>
              {participants.map((participant) => (
                <CustomTag
                  key={participant.id}
                  icon={renderParticipantAvatar(participant, 18)}
                  color="#13a8a8"
                  closable
                  onClose={() => onRemoveParticipant(participant.id)}>
                  {participant.emoji && isEmoji(participant.emoji) ? `${participant.emoji} ${participant.label}` : participant.label}
                </CustomTag>
              ))}
            </HorizontalScrollContainer>
          </ContentArea>
        ) : (
          <EmptyState>
            <Users size={15} />
            <EmptyText>{t('chat.group.members.empty')}</EmptyText>
          </EmptyState>
        )}
      </Panel>
    </Container>
  )
}

const Container = styled.div`
  width: 100%;
  padding: 6px 14px 0;
`

const Panel = styled.div<{ $isEmpty: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: ${({ $isEmpty }) =>
    $isEmpty
      ? 'color-mix(in srgb, var(--color-background-mute) 40%, transparent)'
      : 'color-mix(in srgb, var(--color-background-soft) 75%, transparent)'};
  border: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
`

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`

const PanelTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text);
  font-size: 12px;
  font-weight: 600;
`

const ContentArea = styled.div`
  min-width: 0;
`

const CompactContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-shrink: 0;
`

const CompactAvatars = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: min(240px, 34vw);
  overflow-x: auto;
  padding: 2px 0 2px 2px;

  &::-webkit-scrollbar {
    display: none;
  }
`

const ParticipantAvatarButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: transform 0.18s ease;

  &:hover {
    transform: translateY(-1px);
  }
`

const SettingsButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-background-mute) 50%, transparent);
  color: var(--color-text-2);
  cursor: pointer;
`

const SettingsContent = styled.div`
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const SettingsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text);
  font-size: 12px;
  font-weight: 600;
`

const SectionMeta = styled.span`
  color: var(--color-text-secondary);
  font-size: 11px;
`

const ParticipantList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ParticipantListItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const ParticipantSummary = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`

const ParticipantText = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

const ParticipantName = styled.span`
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ParticipantDetail = styled.span`
  color: var(--color-text-secondary);
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const RemoveParticipantButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;

  &:hover {
    background: color-mix(in srgb, var(--color-error) 12%, transparent);
    color: var(--color-error);
  }
`

const SettingsDivider = styled.div`
  height: 1px;
  background: color-mix(in srgb, var(--color-border) 80%, transparent);
`

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const SettingLabel = styled.span`
  color: var(--color-text);
  font-size: 13px;
`

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
`

const CompactEmptyState = styled(EmptyState)`
  padding: 2px 0;
`

const HoverCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const HoverTitle = styled.span`
  color: var(--color-text);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
`

const HoverMeta = styled.span`
  color: var(--color-text-secondary);
  font-size: 11px;
  line-height: 1.35;
`

const EmptyText = styled.span`
  line-height: 1.4;
`

export default TopicParticipantsInput
