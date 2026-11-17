import { expect, mock, test } from 'claude-code/testing'

// Ctrl+Down past your last message goes to the bottom. With your last two messages on screen there,
// the block went to the topmost one (the one before last): a step down moved it up.

const BAND = {
  plugin: 'juicy-pane',
  component: 'AbovePrompt',
  requestId: 'juicy-pane',
  surface: 'terminal',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

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
const row = (k: number, onScreen: typeof ON | null) =>
  ({
    plugin: 'juicy-pane',
    component: 'UserMessage',
    requestId: `u${k}`,
    surface: 'terminal',
    props: { ...ROW, text: `message ${k + 1}`, onScreen },
  }) as const

test('Ctrl+Down past your last message keeps the block on it', async ($, on) => {
  const clock = mock.clock(on)
  mock.session(on)
  on('ui.render', { component: 'UserMessage', plugin: 'juicy-pane' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>row</Text>
  })
  for (const k of [0, 1, 2]) {
    await $.session.append({
      door: 'prompt',
      origin: { kind: 'composer' },
      uuid: `u${k}`,
      message: { type: 'user', role: 'user', content: [{ type: 'text', text: `message ${k + 1}` }] },
    })
  }
  const band = await $.ui.mount(BAND)
  const pane = await $.ui.mount(PANE)
  const texts = async () => (await pane.findAll({ type: 'Text' })).map(t => t.text)
  const header = async () => (await texts()).find(t => /messages$|\d\/\d/.test(t))
  const block = async () =>
    (await pane.findAll({ type: 'Text' })).flatMap(t =>
      /^ \d\./.test(t.text) && t.props.backgroundColor === 'permission' ? [t.text.trim()] : [],
    )
  // the kit cannot scroll, so a jump ends in a rejected scroll; the recount still runs
  const press = async (key: 'up' | 'down') => {
    await band.press({ key }).catch(() => undefined)
    await clock.advance(1000)
  }

  // the bottom, your last two messages on screen; the normal view keeps the topmost
  const second = await $.ui.mount(row(1, ON))
  const third = await $.ui.mount(row(2, ON))
  await clock.advance(1000)
  expect(await block()).toEqual(['2. message 2'])

  // Ctrl+Down from the normal view: the bottom, on your last message
  await press('down')
  expect(await header()).toBe(' 3 messages')
  expect(await block()).toEqual(['3. message 3'])

  // up to your last message, then down past it again: the block never moves up
  await press('up')
  expect(await header()).toBe(' 3/3')
  expect(await block()).toEqual(['3. message 3'])
  await press('down')
  expect(await header()).toBe(' 3 messages')
  expect(await block()).toEqual(['3. message 3'])

  // up again goes to the one before, as before
  await press('up')
  await press('up')
  expect(await header()).toBe(' 2/3')
  expect(await block()).toEqual(['2. message 2'])

  // a long last answer: none of your messages on screen at the bottom. An older row that left the
  // screen before the jump must not decide where the block goes
  await press('down')
  const first = await $.ui.mount(row(0, ON))
  await first.redraw({ ...ROW, text: 'message 1', onScreen: null })
  await clock.advance(1)
  await first.unmount()
  await second.unmount()
  await third.unmount()
  await press('down')
  expect(await header()).toBe(' 3 messages')
  expect(await block()).toEqual(['3. message 3'])

  await pane.unmount()
  await band.unmount()
})
