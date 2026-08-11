/** @vitest-environment jsdom */

import { defineComponent, h, type PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createBoardEngine, type NodeId } from '@lupinum/board-core'
import BoardRoot from '../src/components/BoardRoot.vue'
import { useBoardNode } from '../src/useBoardEngine'

describe('Vue board composables', () => {
  it('tracks node ids supplied through a reactive prop getter', async () => {
    const engine = createBoardEngine()
    const first = engine.createNode({ type: 'text', text: 'First' })
    const second = engine.createNode({ type: 'text', text: 'Second' })
    const Reader = defineComponent({
      props: {
        nodeId: {
          type: String as unknown as PropType<NodeId>,
          required: true,
        },
      },
      setup(props) {
        const { node } = useBoardNode(() => props.nodeId)
        return () => h('output', { class: 'active-node' }, node.value.text)
      },
    })
    const Shell = defineComponent({
      props: {
        nodeId: {
          type: String as unknown as PropType<NodeId>,
          required: true,
        },
      },
      setup(props) {
        return () =>
          h(
            BoardRoot,
            { engine },
            { default: () => h(Reader, { nodeId: props.nodeId }) },
          )
      },
    })
    const wrapper = mount(Shell, {
      props: { nodeId: first.id },
      attachTo: document.body,
    })

    expect(wrapper.find('.active-node').text()).toBe('First')

    await wrapper.setProps({ nodeId: second.id })

    expect(wrapper.find('.active-node').text()).toBe('Second')
  })
})
