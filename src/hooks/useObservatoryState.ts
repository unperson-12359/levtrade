import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDataManager } from './useDataManager'
import { useHashRouter } from './useHashRouter'
import { useIndicatorObservatory, type ObservatoryLiveStatus } from './useIndicatorObservatory'
import {
  resolveDisplayLiveStatus,
  strongestCategory,
  toneFromHealthStatus,
} from '../observatory/format'
import type {
  CandleHitCluster,
  CorrelationEdge,
  IndicatorCategory,
  IndicatorHealthStatus,
  IndicatorMetric,
  ObservatorySnapshot,
} from '../observatory/types'
import type { PriceContext } from '../observatory/priceContext'
import { useStore } from '../store'
import type { TrackedCoin } from '../types/market'
import type { ObservatoryRoute } from './useHashRouter'

type ClusterPresentationMode = 'simple' | 'pro'
import type { RuntimeDiagnostic } from '../store/uiSlice'

const CATEGORY_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Structure']
export const ALLOWED_INTERVALS = ['4h', '1d'] as const
export type AllowedInterval = (typeof ALLOWED_INTERVALS)[number]
export type ViewMode = 'basic' | 'advanced'
export type PrimaryView = 'timeline' | 'network'

export interface ObservatoryState {
  // Route & market context
  route: ObservatoryRoute
  selectedCoin: TrackedCoin
  timeframe: AllowedInterval
  prices: Record<TrackedCoin, number | null>

  // Observatory data
  snapshot: ObservatorySnapshot
  priceContext: PriceContext
  liveStatus: ObservatoryLiveStatus
  loading: boolean

  // View controls
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  primaryView: PrimaryView
  setPrimaryView: (view: PrimaryView) => void
  clusterMode: ClusterPresentationMode
  setClusterMode: (mode: ClusterPresentationMode) => void
  showDiagnostics: boolean
  setShowDiagnostics: (show: boolean) => void
  chartCollapsed: boolean
  setChartCollapsed: (collapsed: boolean) => void
  catalogOpen: boolean
  setCatalogOpen: (open: boolean) => void
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void

  // Indicator selection + derived
  selectedIndicatorId: string | null
  setSelectedIndicatorId: (id: string | null) => void
  selectedIndicator: IndicatorMetric | null
  indicatorsByCategory: Record<IndicatorCategory, IndicatorMetric[]>
  mapIndicators: IndicatorMetric[]
  mapEdges: CorrelationEdge[]
  selectedEdges: CorrelationEdge[]

  // Timeline selection + derived
  selectedClusterTime: number | null
  setSelectedClusterTime: (time: number | null) => void
  selectedTimelineCluster: CandleHitCluster | null
  latestTimelineCluster: CandleHitCluster | null
  selectedClusterCategory: IndicatorCategory | null
  reportCluster: CandleHitCluster | null
  pulseSummary: Array<{ category: IndicatorCategory; count: number }>

  // Navigation
  openCandleReport: (time: number) => void
  openObservatory: () => void
  openAnalytics: () => void
  openMethodology: () => void
  openHeatmap: () => void
  handleSelectCoin: (coin: TrackedCoin) => void
  handleSelectInterval: (interval: AllowedInterval) => void
  onPrev: (() => void) | null
  onNext: (() => void) | null

  // Page flags
  isReportPage: boolean
  isAnalyticsPage: boolean
  isMethodologyPage: boolean
  isTimelineView: boolean

  // Status
  healthStatus: IndicatorHealthStatus
  healthTone: 'good' | 'warn' | 'critical'
  diagnosticsCount: number
  hasDiagnostics: boolean
  liveDisplayStatus: 'live' | 'updating' | 'delayed' | 'disconnected'
  latestRuntimeMessage: string | null
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  runtimeDiagnostics: RuntimeDiagnostic[]
  observatoryGuideExpanded: boolean
  toggleObservatoryGuideExpanded: () => void
}

export function useObservatoryState(): ObservatoryState {
  useDataManager()

  const selectedCoin = useStore((state) => state.selectedCoin)
  const selectCoin = useStore((state) => state.selectCoin)
  const selectedInterval = useStore((state) => state.selectedInterval)
  const setInterval = useStore((state) => state.setInterval)
  const observatoryGuideExpanded = useStore((state) => state.observatoryGuideExpanded)
  const toggleObservatoryGuideExpanded = useStore((state) => state.toggleObservatoryGuideExpanded)
  const connectionStatus = useStore((state) => state.connectionStatus)
  const runtimeDiagnostics = useStore((state) => state.runtimeDiagnostics)
  const prices = useStore((state) => state.prices)

  const {
    route,
    navigateToHeatmap,
    navigateToObservatory,
    navigateToAnalytics,
    navigateToMethodology,
    navigateToReport,
  } = useHashRouter()

  const { snapshot, priceContext, liveStatus, loading } = useIndicatorObservatory(selectedCoin)
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null)
  const [selectedClusterTime, setSelectedClusterTime] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('basic')
  const [primaryView, setPrimaryView] = useState<PrimaryView>('timeline')
  const [clusterMode, setClusterMode] = useState<ClusterPresentationMode>('simple')
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [chartCollapsed, setChartCollapsed] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (selectedInterval !== '4h' && selectedInterval !== '1d') {
      setInterval('4h')
    }
  }, [selectedInterval, setInterval])

  useEffect(() => {
    if (route.coin && route.coin !== selectedCoin) {
      selectCoin(route.coin)
    }
    if (route.interval && route.interval !== selectedInterval) {
      setInterval(route.interval)
    }
  }, [route.coin, route.interval, selectCoin, selectedCoin, selectedInterval, setInterval])

  const indicatorIdSet = useMemo(
    () => new Set(snapshot.indicators.map((i) => i.id)),
    [snapshot.indicators],
  )
  const indicatorIdKey = useMemo(() => [...indicatorIdSet].join(','), [indicatorIdSet])

  useEffect(() => {
    if (indicatorIdSet.size === 0) {
      setSelectedIndicatorId(null)
      return
    }
    if (selectedIndicatorId && indicatorIdSet.has(selectedIndicatorId)) return
    setSelectedIndicatorId(snapshot.indicators[0]?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorIdKey])

  const timelineTimeSet = useMemo(
    () => new Set(snapshot.timeline.map((c) => c.time)),
    [snapshot.timeline],
  )
  const timelineTimeKey = useMemo(() => [...timelineTimeSet].join(','), [timelineTimeSet])

  useEffect(() => {
    if (route.page === 'report') return
    if (timelineTimeSet.size === 0) {
      setSelectedClusterTime(null)
      return
    }
    if (selectedClusterTime && timelineTimeSet.has(selectedClusterTime)) return
    setSelectedClusterTime(snapshot.timeline[snapshot.timeline.length - 1]?.time ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineTimeKey, route.page])

  useEffect(() => {
    setMenuOpen(false)
  }, [route.page, selectedCoin])

  const selectedIndicator = useMemo(
    () => snapshot.indicators.find((indicator) => indicator.id === selectedIndicatorId) ?? null,
    [selectedIndicatorId, snapshot.indicators],
  )

  const indicatorsByCategory = useMemo(() => {
    const grouped: Record<IndicatorCategory, typeof snapshot.indicators> = {
      Trend: [],
      Momentum: [],
      Volatility: [],
      Volume: [],
      Structure: [],
    }
    for (const indicator of snapshot.indicators) {
      grouped[indicator.category].push(indicator)
    }
    return grouped
  }, [snapshot.indicators])

  const mapIndicators = useMemo(() => {
    if (viewMode === 'advanced') return snapshot.indicators
    const keep = new Set<string>()
    for (const category of CATEGORY_ORDER) {
      for (const indicator of indicatorsByCategory[category].slice(0, 4)) {
        keep.add(indicator.id)
      }
    }
    if (selectedIndicatorId) keep.add(selectedIndicatorId)
    return snapshot.indicators.filter((indicator) => keep.has(indicator.id))
  }, [indicatorsByCategory, selectedIndicatorId, snapshot.indicators, viewMode])

  const mapEdges = useMemo(() => {
    const allowed = new Set(mapIndicators.map((indicator) => indicator.id))
    const filtered = snapshot.edges.filter((edge) => allowed.has(edge.a) && allowed.has(edge.b))
    if (viewMode === 'advanced') return filtered
    return filtered.filter((edge) => edge.strength >= 0.45).slice(0, 48)
  }, [mapIndicators, snapshot.edges, viewMode])

  const selectedEdges = useMemo(() => {
    if (!selectedIndicator) return []
    return snapshot.edges
      .filter((edge) => edge.a === selectedIndicator.id || edge.b === selectedIndicator.id)
      .slice(0, viewMode === 'advanced' ? 10 : 6)
  }, [selectedIndicator, snapshot.edges, viewMode])

  const timeframe = (selectedInterval === '1d' ? '1d' : '4h') as AllowedInterval
  const isReportPage = route.page === 'report'
  const isAnalyticsPage = route.page === 'analytics'
  const isMethodologyPage = route.page === 'methodology'
  const reportCluster = useMemo(() => {
    if (!isReportPage || route.time === null) return null
    return snapshot.timeline.find((cluster) => cluster.time === route.time) ?? null
  }, [isReportPage, route.time, snapshot.timeline])

  const selectedTimelineCluster = useMemo(() => {
    if (snapshot.timeline.length === 0) return null
    return snapshot.timeline.find((cluster) => cluster.time === selectedClusterTime) ?? snapshot.timeline[snapshot.timeline.length - 1] ?? null
  }, [selectedClusterTime, snapshot.timeline])

  const latestTimelineCluster = useMemo(
    () => snapshot.timeline[snapshot.timeline.length - 1] ?? null,
    [snapshot.timeline],
  )

  const pulseSummary = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        count: latestTimelineCluster?.laneCounts[category] ?? 0,
      })),
    [latestTimelineCluster],
  )

  const openCandleReport = useCallback(
    (time: number) => navigateToReport(selectedCoin, timeframe, time),
    [navigateToReport, selectedCoin, timeframe],
  )
  const openObservatory = useCallback(
    () => navigateToObservatory(selectedCoin, timeframe),
    [navigateToObservatory, selectedCoin, timeframe],
  )
  const openAnalytics = useCallback(
    () => navigateToAnalytics(selectedCoin, timeframe),
    [navigateToAnalytics, selectedCoin, timeframe],
  )
  const openMethodology = useCallback(
    () => navigateToMethodology(selectedCoin, timeframe),
    [navigateToMethodology, selectedCoin, timeframe],
  )
  const openHeatmap = useCallback(
    () => navigateToHeatmap(selectedCoin, timeframe),
    [navigateToHeatmap, selectedCoin, timeframe],
  )
  const applyMarketContext = useCallback((nextCoin: TrackedCoin, nextInterval: AllowedInterval) => {
    selectCoin(nextCoin)
    setInterval(nextInterval)

    if (isAnalyticsPage) {
      navigateToAnalytics(nextCoin, nextInterval)
      return
    }

    if (isMethodologyPage) {
      navigateToMethodology(nextCoin, nextInterval)
      return
    }

    navigateToObservatory(nextCoin, nextInterval)
  }, [
    isAnalyticsPage,
    isMethodologyPage,
    navigateToAnalytics,
    navigateToMethodology,
    navigateToObservatory,
    selectCoin,
    setInterval,
  ])
  const handleSelectCoin = useCallback(
    (coin: TrackedCoin) => applyMarketContext(coin, timeframe),
    [applyMarketContext, timeframe],
  )
  const handleSelectInterval = useCallback(
    (interval: AllowedInterval) => applyMarketContext(selectedCoin, interval),
    [applyMarketContext, selectedCoin],
  )

  const { onPrev, onNext } = useMemo(() => {
    if (!isReportPage || route.time === null || snapshot.timeline.length === 0) {
      return { onPrev: null, onNext: null }
    }
    const idx = snapshot.timeline.findIndex((cluster) => cluster.time === route.time)
    if (idx === -1) return { onPrev: null, onNext: null }
    const prevTime = idx > 0 ? snapshot.timeline[idx - 1]!.time : null
    const nextTime = idx < snapshot.timeline.length - 1 ? snapshot.timeline[idx + 1]!.time : null
    return {
      onPrev: prevTime !== null ? () => navigateToReport(selectedCoin, timeframe, prevTime, { replace: true }) : null,
      onNext: nextTime !== null ? () => navigateToReport(selectedCoin, timeframe, nextTime, { replace: true }) : null,
    }
  }, [isReportPage, route.time, snapshot.timeline, navigateToReport, selectedCoin, timeframe])

  const healthStatus = snapshot.health.status
  const healthTone = toneFromHealthStatus(healthStatus)
  const diagnosticsCount = runtimeDiagnostics.length + Math.max(snapshot.health.warnings.length, snapshot.health.status === 'healthy' ? 0 : 1)
  const hasDiagnostics = runtimeDiagnostics.length > 0 || snapshot.health.status !== 'healthy'
  const liveDisplayStatus = resolveDisplayLiveStatus(connectionStatus, liveStatus)
  const latestRuntimeMessage = runtimeDiagnostics[runtimeDiagnostics.length - 1]?.message ?? null
  const isTimelineView = primaryView === 'timeline'
  const selectedClusterCategory = selectedTimelineCluster ? strongestCategory(selectedTimelineCluster) : null

  useEffect(() => {
    if (hasDiagnostics) {
      setShowDiagnostics(true)
      return
    }
    setShowDiagnostics(false)
  }, [hasDiagnostics])

  return {
    route,
    selectedCoin,
    timeframe,
    prices,
    snapshot,
    priceContext,
    liveStatus,
    loading,
    viewMode,
    setViewMode,
    primaryView,
    setPrimaryView,
    clusterMode,
    setClusterMode,
    showDiagnostics,
    setShowDiagnostics,
    chartCollapsed,
    setChartCollapsed,
    catalogOpen,
    setCatalogOpen,
    menuOpen,
    setMenuOpen,
    selectedIndicatorId,
    setSelectedIndicatorId,
    selectedIndicator,
    indicatorsByCategory,
    mapIndicators,
    mapEdges,
    selectedEdges,
    selectedClusterTime,
    setSelectedClusterTime,
    selectedTimelineCluster,
    latestTimelineCluster,
    selectedClusterCategory,
    reportCluster,
    pulseSummary,
    openCandleReport,
    openObservatory,
    openAnalytics,
    openMethodology,
    openHeatmap,
    handleSelectCoin,
    handleSelectInterval,
    onPrev,
    onNext,
    isReportPage,
    isAnalyticsPage,
    isMethodologyPage,
    isTimelineView,
    healthStatus,
    healthTone,
    diagnosticsCount,
    hasDiagnostics,
    liveDisplayStatus,
    latestRuntimeMessage,
    connectionStatus,
    runtimeDiagnostics,
    observatoryGuideExpanded,
    toggleObservatoryGuideExpanded,
  }
}
