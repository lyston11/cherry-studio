import AssistantAvatar from '@renderer/components/Avatar/AssistantAvatar'
import { TopView } from '@renderer/components/TopView'
import type { Assistant } from '@renderer/types'
import { Checkbox, Input, Modal } from 'antd'
import { Users } from 'lucide-react'
import type { FC } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

type ShowParams = {
  assistants: Assistant[]
  initialSelectedAssistantIds?: string[]
}

type CreateGroupChatResult = {
  name: string
  assistantIds: string[]
}

interface Props extends ShowParams {
  resolve: (data: CreateGroupChatResult | null) => void
}

const PopupContainer: FC<Props> = ({ assistants, initialSelectedAssistantIds = [], resolve }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  const [name, setName] = useState('')
  const [selectedAssistantIds, setSelectedAssistantIds] = useState<string[]>(initialSelectedAssistantIds)

  const assistantOptions = useMemo(
    () =>
      assistants.map((assistant) => ({
        id: assistant.id,
        assistant
      })),
    [assistants]
  )

  const closeWith = (payload: CreateGroupChatResult | null) => {
    resolve(payload)
  }

  const onCancel = () => {
    setOpen(false)
    CreateGroupChatPopup.hide()
    closeWith(null)
  }

  const onOk = () => {
    if (selectedAssistantIds.length === 0) {
      window.toast.error(t('chat.group.create.empty'))
      return
    }

    setOpen(false)
    CreateGroupChatPopup.hide()
    closeWith({
      name: name.trim(),
      assistantIds: selectedAssistantIds
    })
  }

  return (
    <StyledModal
      centered
      open={open}
      title={t('chat.add.group.title')}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      onOk={onOk}
      onCancel={onCancel}
      destroyOnClose
      width={420}>
      <Content>
        <Input
          allowClear
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('chat.group.create.placeholder')}
        />

        <SectionHeader>
          <Users size={15} />
          <span>{t('chat.group.create.members')}</span>
        </SectionHeader>

        <AssistantList>
          <Checkbox.Group
            value={selectedAssistantIds}
            onChange={(values) => setSelectedAssistantIds(values as string[])}>
            {assistantOptions.map(({ id, assistant }) => (
              <AssistantOption key={id}>
                <Checkbox value={id}>
                  <AssistantOptionInner>
                    <AssistantAvatar assistant={assistant} size={24} />
                    <AssistantMeta>
                      <AssistantName>{assistant.name || t('chat.default.name')}</AssistantName>
                      {assistant.model?.name && <AssistantModel>{assistant.model.name}</AssistantModel>}
                    </AssistantMeta>
                  </AssistantOptionInner>
                </Checkbox>
              </AssistantOption>
            ))}
          </Checkbox.Group>
        </AssistantList>
      </Content>
    </StyledModal>
  )
}

const StyledModal = styled(Modal)`
  .ant-modal-body {
    padding-top: 12px;
  }
`

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
`

const AssistantList = styled.div`
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;

  .ant-checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ant-checkbox-wrapper {
    width: 100%;
    margin-inline-start: 0;
  }
`

const AssistantOption = styled.div`
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--color-background-mute) 26%, transparent);
`

const AssistantOptionInner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
`

const AssistantMeta = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const AssistantName = styled.div`
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
`

const AssistantModel = styled.div`
  color: var(--color-text-secondary);
  font-size: 12px;
`

const TopViewKey = 'CreateGroupChatPopup'

export default class CreateGroupChatPopup {
  static hide() {
    TopView.hide(TopViewKey)
  }

  static show(props: ShowParams) {
    return new Promise<CreateGroupChatResult | null>((resolve) => {
      TopView.show(
        <PopupContainer
          {...props}
          resolve={(value) => {
            resolve(value)
            TopView.hide(TopViewKey)
          }}
        />,
        TopViewKey
      )
    })
  }
}
