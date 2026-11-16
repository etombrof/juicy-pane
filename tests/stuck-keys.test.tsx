import { expect, mock, test } from 'claude-code/testing'

// Ctrl+Up/Down press the band's Buttons. A Button whose site draws again gets a new handle, and two
// draws in quick succession could leave the terminal pressing a released one: the keys went dead.
// So moving must not draw the band again: not the selection, not the recount, not a new message.

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

test('moving with the keys never draws the band again, and the pane header says where you are', async ($, on) => {
  const clock = mock.clock(on)
  mock.session(on)
  let bandDraws = 0
  on('ui.render', { component: 'AbovePrompt', plugin: 'juicy-pane' }, ($, e, next) => {
    bandDraws += 1
    return next(e)
  })
  on('ui.render', { component: 'UserMessage', plugin: 'juicy-pane' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>row</Text>
  })
  const say = (k: number) =>
    $.session.append({
      door: 'prompt',
      origin: { kind: 'composer' },
      uuid: `u${k}`,
      message: { type: 'user', role: 'user', content: [{ type: 'text', text: `message ${k + 1}` }] },
    })
  for (const k of [0, 1, 2]) await say(k)

  const band = await $.ui.mount(BAND)
  const pane = await $.ui.mount(PANE)
  const rows = [await $.ui.mount({ ...ROW_SITE('u1'), props: { ...ROW, text: 'message 2', onScreen: ON } })]
  await clock.advance(1000)
  const header = async () => (await pane.findAll({ type: 'Text' })).map(t => t.text).find(t => /messages$|\d\/\d/.test(t))
  expect(await header()).toBe(' 3 messages')
  const drawn = bandDraws
  expect(drawn).toBeGreaterThan(0)

  // three presses in a row, faster than a recount: the kit cannot scroll, so a press may end in a
  // rejected scroll after the selection moved; that is the jump's part, not the band's
  for (const n of [1, 2, 3]) {
    await band.press({ key: 'up' }).catch(() => undefined)
    await clock.advance(n === 3 ? 1000 : 50)
  }
  expect(await header()).toBe(' 1/3')
  await band.press({ key: 'down' }).catch(() => undefined)
  await clock.advance(1000)
  expect(await header()).toBe(' 2/3')

  // a new message joins the list: the pane draws it, the band still does not draw
  await say(3)
  await clock.advance(1000)
  expect((await pane.findAll({ type: 'Text' })).some(t => t.text.includes('4. message 4'))).toBe(true)
  expect(bandDraws).toBe(drawn)

  for (const r of rows) await r.unmount()
  await pane.unmount()
  await band.unmount()
})

function ROW_SITE(requestId: string) {
  return { plugin: 'juicy-pane', component: 'UserMessage', requestId, surface: 'terminal' } as const
}
