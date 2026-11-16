import { expect, test } from 'claude-code/testing'

import { gauge } from '../hooks/register'

test('gauge fills by percent and fits the width', () => {
  const line = gauge({ tokens: 38_400, percent: 40, window: 1_000_000 }, 30)
  expect(line).toBe(`ctx ${'█'.repeat(7)}${'░'.repeat(11)} 38k 40%`)
  expect(line.length).toBe(30)
})

test('gauge before the first response shows a dash, empty bar', () => {
  expect(gauge({ window: 1_000_000 }, 12)).toBe('ctx ░░░░░░ —')
})

test('gauge never wraps in a narrow pane', () => {
  expect(gauge({ tokens: 38_400, percent: 40, window: 1_000_000 }, 13).length).toBe(13)
  expect(gauge({ tokens: 38_400, percent: 40, window: 1_000_000 }, 8).length).toBe(8)
})

test('gauge works out the percent when only tokens are given', () => {
  expect(gauge({ tokens: 500_000, window: 1_000_000 }, 30)).toContain(' 500k 50%')
})
