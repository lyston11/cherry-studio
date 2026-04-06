import AddAssistantPopup from '@renderer/components/Popups/AddAssistantPopup'
import { useNavbarPosition } from '@renderer/hooks/useSettings'
import type { Assistant, Topic } from '@renderer/types'
import { classNames } from '@renderer/utils'
import type { FC } from 'react'
import { useCallback } from 'react'
import styled from 'styled-components'

import Conversations from './ConversationsTab'
import Topics from './TopicsTab'

interface Props {
  activeAssistant: Assistant
  activeTopic: Topic
  setActiveAssistant: (assistant: Assistant) => void
  setActiveConversation: (assistant: Assistant, topic: Topic) => void
  setActiveTopic: (topic: Topic) => void
  position: 'left' | 'right'
  style?: React.CSSProperties
}

const HomeTabs: FC<Props> = ({
  activeAssistant,
  activeTopic,
  setActiveAssistant,
  setActiveConversation,
  setActiveTopic,
  position,
  style
}) => {
  const { isLeftNavbar } = useNavbarPosition()
  const borderStyle = '0.5px solid var(--color-border)'
  const border =
    position === 'left'
      ? { borderRight: isLeftNavbar ? borderStyle : 'none' }
      : { borderLeft: isLeftNavbar ? borderStyle : 'none', borderTopLeftRadius: 0 }

  const onCreateAssistant = useCallback(async () => {
    const assistant = await AddAssistantPopup.show()
    if (!assistant) {
      return
    }

    const topic = assistant.topics?.[0]
    if (topic) {
      setActiveConversation(assistant, topic)
      return
    }

    setActiveAssistant(assistant)
  }, [setActiveAssistant, setActiveConversation])

  return (
    <Container style={{ ...border, ...style }} className={classNames('home-tabs', { right: position === 'right' })}>
      <TabContent className="home-tabs-content">
        {position === 'left' ? (
          <Conversations
            activeAssistant={activeAssistant}
            activeTopic={activeTopic}
            setActiveConversation={setActiveConversation}
            onCreateAssistant={onCreateAssistant}
          />
        ) : (
          <Topics
            assistant={activeAssistant}
            activeTopic={activeTopic}
            setActiveTopic={setActiveTopic}
            position={position}
          />
        )}
      </TabContent>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: var(--assistants-width);
  transition: width 0.3s;
  height: calc(100vh - var(--navbar-height));
  position: relative;

  &.right {
    height: calc(100vh - var(--navbar-height));
  }

  [navbar-position='left'] & {
    background-color: var(--color-background);
  }
  [navbar-position='top'] & {
    height: calc(100vh - var(--navbar-height));
  }
  overflow: hidden;
  .collapsed {
    width: 0;
    border-left: none;
  }
`

const TabContent = styled.div`
  display: flex;
  transition: width 0.3s;
  flex: 1;
  flex-direction: column;
  overflow-y: hidden;
  overflow-x: hidden;
`

export default HomeTabs
