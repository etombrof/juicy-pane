// one of your messages, by its transcript id; null = none
export type MessageId = string | null
// the live window as the status line has it; tokens/percent absent until the first response
export type Fill = { tokens?: number; percent?: number; window: number }

declare module 'claude-code' {
  interface PluginState {
    'juicy-pane': {
      selected: MessageId // the message Ctrl+Up/Down landed on; null = the normal view
      here: MessageId // the message the side pane's block is on
      fill: Fill // the context window's fill, the pane's last line
    }
  }
}
