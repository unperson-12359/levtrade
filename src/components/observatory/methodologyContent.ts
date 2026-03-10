import type { IndicatorCategory } from '../../observatory/types'

export interface ObservatoryReadingStep {
  id: 'market' | 'pressure' | 'selected' | 'deep-dive'
  step: string
  title: string
  question: string
  readNext: string
}

export interface MethodologyCard {
  title: string
  summary: string
}

export interface CategoryExplanation {
  category: IndicatorCategory
  summary: string
}

export interface LiveStatusNote {
  label: string
  meaning: string
}

export const OBSERVATORY_READING_STEPS: ObservatoryReadingStep[] = [
  {
    id: 'market',
    step: '01',
    title: 'Start with market state',
    question: 'What is price doing right now, and does the live read feel coherent?',
    readNext: 'Then move to the heatmap to see where signal pressure is clustering.',
  },
  {
    id: 'pressure',
    step: '02',
    title: 'Read signal pressure',
    question: 'Which categories are firing, and is the pressure broad or isolated?',
    readNext: 'Select a candle to turn pressure into a concrete event explanation.',
  },
  {
    id: 'selected',
    step: '03',
    title: 'Explain the selected candle',
    question: 'Why did this candle matter, and which indicators made it important?',
    readNext: 'Open the full report when the selected candle looks materially interesting.',
  },
  {
    id: 'deep-dive',
    step: '04',
    title: 'Validate with deep-dive tools',
    question: 'Do analytics or the network view confirm that this is meaningful context?',
    readNext: 'Use methodology and analytics as interpretation tools, not as your first read.',
  },
]

export const OBSERVATORY_PAGE_PURPOSES: MethodologyCard[] = [
  {
    title: 'Observatory',
    summary: 'Your live reading surface. Use it to scan market state, see where indicator pressure is building, and pick the candle worth explaining.',
  },
  {
    title: 'Candle report',
    summary: 'Your event explanation surface. Use it after selecting a heatmap cell to understand why a candle mattered and which indicators were active.',
  },
  {
    title: 'Analytics',
    summary: 'Your persistence surface. Use it to learn which indicators recur, stay active, or cluster together over longer stretches of the visible window.',
  },
]

export const OBSERVATORY_CATEGORY_EXPLANATIONS: CategoryExplanation[] = [
  {
    category: 'Trend',
    summary: 'Direction and regime structure. Read this when you want to know whether the market is leaning, drifting, or trending cleanly.',
  },
  {
    category: 'Momentum',
    summary: 'Speed and directional force. Read this to see whether price is accelerating, exhausting, or failing to follow through.',
  },
  {
    category: 'Volatility',
    summary: 'Range expansion and compression. Read this to understand whether the move is quiet, stretched, or unstable.',
  },
  {
    category: 'Volume',
    summary: 'Participation and activity. Read this to see whether the move is getting real market participation or fading on weak engagement.',
  },
  {
    category: 'Structure',
    summary: 'Price-location and state transitions. Read this to know whether price is leaving one condition and entering another.',
  },
]

export const OBSERVATORY_LIVE_STATUS_NOTES: LiveStatusNote[] = [
  {
    label: 'Live',
    meaning: 'Updates are flowing normally. Read the shell as an active market surface.',
  },
  {
    label: 'Updating',
    meaning: 'The app is refreshing in the background. Keep reading the current state while new context arrives.',
  },
  {
    label: 'Delayed',
    meaning: 'The shell still has context, but new market data is arriving slower than normal. Read broad structure before acting on small changes.',
  },
  {
    label: 'Disconnected',
    meaning: 'Live transport is interrupted. Use the current view as context only until updates resume.',
  },
]

export const OBSERVATORY_DAILY_WORKFLOW: string[] = [
  'Pick the market and timeframe, then check whether the shell is live, updating, or delayed before interpreting pressure.',
  'Use the chart and 24h change to frame the move before looking at the heatmap.',
  'Scan the heatmap for broad, repeated, or unusually dense category pressure rather than reacting to one isolated light-up.',
  'Select the candle that looks most important and read the selected-day card before opening the full report.',
  'Open the report only when the candle meaning is not obvious from the live shell.',
  'Use analytics or network view to validate whether the active indicators are persistent, correlated, or one-off noise.',
]
