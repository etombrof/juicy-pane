import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'juicy-pane',
  component: 'Pane',
  requestId: 'juicy-pane',
  surface: 'terminal',
  props: {
    title: 'Your messages',
    isFocused: false,
    bodyColumns: 32,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const ROW = { origin: { kind: 'composer' }, isExpanded: true } as const
const ON = { first: 0, last: 2, of: 3 }
const uuid = (k: number) => `0000000${k}-aaaa-4bbb-8ccc-dddddddddddd`
// how Claude Code draws a row once its list re-chains: the uuid's first 24 characters, then the block's index
const drawnId = (k: number) => `${uuid(k).slice(0, 24)}000000000000`

test('identical messages: the block is on the one on screen, not the oldest with that text', async ($, on) => {
  const clock = mock.clock(on)
  mock.session(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>row</Text>
  })
  for (const k of [0, 1, 2]) {
    await $.session.append({
      door: 'prompt',
      origin: { kind: 'composer' },
      uuid: uuid(k),
      message: { type: 'user', role: 'user', content: [{ type: 'text', text: 'go ahead' }] },
    })
  }
  const pane = await $.ui.mount(PANE)
  await clock.advance(1000)
  const block = async () =>
    (await pane.findAll({ type: 'Text' })).flatMap(t =>
      /^ \d\./.test(t.text) && t.props.backgroundColor === 'permission' ? [t.text.trim()] : [],
    )

  // the view at the bottom: the newest rows draw first
  const third = await $.ui.mount({ plugin: 'juicy-pane', component: 'UserMessage', requestId: drawnId(2), surface: 'terminal', props: { ...ROW, text: 'go ahead', onScreen: ON } })
  const second = await $.ui.mount({ plugin: 'juicy-pane', component: 'UserMessage', requestId: drawnId(1), surface: 'terminal', props: { ...ROW, text: 'go ahead', onScreen: ON } })
  await clock.advance(1000)
  expect(await block()).toEqual(['2. go ahead'])

  await third.unmount()
  await second.unmount()
  await pane.unmount()
})
