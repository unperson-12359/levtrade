import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store'
import {
  buildRemoteAppState,
  emptyRemoteState,
  fetchRemoteState,
  mergeRemoteAndLocalState,
  pushRemoteState,
  stableSerializeState,
} from '../services/sync'

const SYNC_DEBOUNCE_MS = 2_000

export function useCloudSync() {
  const trackedSetups = useStore((s) => s.trackedSetups)
  const trackedSignals = useStore((s) => s.trackedSignals)
  const trackedOutcomes = useStore((s) => s.trackedOutcomes)
  const trackerLastRunAt = useStore((s) => s.trackerLastRunAt)
  const riskInputs = useStore((s) => s.riskInputs)
  const riskInputsUpdatedAt = useStore((s) => s.riskInputsUpdatedAt)

  const snapshot = useMemo(
    () =>
      buildRemoteAppState({
        trackedSetups,
        trackedSignals,
        trackedOutcomes,
        trackerLastRunAt,
        riskInputs,
        riskInputsUpdatedAt,
      }),
    [trackedOutcomes, trackedSetups, trackedSignals, trackerLastRunAt, riskInputs, riskInputsUpdatedAt],
  )

  const serializedSnapshot = useMemo(() => stableSerializeState(snapshot), [snapshot])
  const hasHydratedRef = useRef(false)
  const lastSyncedRef = useRef('')

  async function syncNow() {
    useStore.getState().setSyncStatus('syncing')
    useStore.getState().setSyncError(null)

    try {
      const localState = buildRemoteAppState({
        trackedSetups: useStore.getState().trackedSetups,
        trackedSignals: useStore.getState().trackedSignals,
        trackedOutcomes: useStore.getState().trackedOutcomes,
        trackerLastRunAt: useStore.getState().trackerLastRunAt,
        riskInputs: useStore.getState().riskInputs,
        riskInputsUpdatedAt: useStore.getState().riskInputsUpdatedAt,
      })

      const remoteState = await fetchRemoteState()
      const mergedState = mergeRemoteAndLocalState(localState, remoteState ?? emptyRemoteState())
      applyMergedState(mergedState)

      const remoteSerialized = remoteState ? stableSerializeState(remoteState) : ''
      const mergedSerialized = stableSerializeState(mergedState)
      const acceptedState =
        remoteSerialized === mergedSerialized
          ? mergedState
          : await pushRemoteState(mergedState)

      applyMergedState(acceptedState)
      lastSyncedRef.current = stableSerializeState(acceptedState)
      hasHydratedRef.current = true
      useStore.getState().setLastCloudSyncAt(Date.now())
      useStore.getState().setSyncStatus('synced')
      useStore.getState().setSyncError(null)
    } catch (error) {
      hasHydratedRef.current = false
      const message = error instanceof Error ? error.message : 'Cloud sync failed.'
      useStore.getState().setSyncError(message)
      useStore.getState().setSyncStatus(navigator.onLine ? 'error' : 'offline')
    }
  }

  useEffect(() => {
    void syncNow()
  }, [])

  useEffect(() => {
    if (!hasHydratedRef.current && !lastSyncedRef.current) {
      return
    }

    if (serializedSnapshot === lastSyncedRef.current) {
      return
    }

    useStore.getState().setSyncStatus('syncing')

    const timer = window.setTimeout(async () => {
      try {
        if (!hasHydratedRef.current) {
          await syncNow()
          return
        }

        const acceptedState = await pushRemoteState(snapshot)
        applyMergedState(acceptedState)
        lastSyncedRef.current = stableSerializeState(acceptedState)
        useStore.getState().setLastCloudSyncAt(Date.now())
        useStore.getState().setSyncStatus('synced')
        useStore.getState().setSyncError(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cloud sync failed.'
        useStore.getState().setSyncError(message)
        useStore.getState().setSyncStatus(navigator.onLine ? 'error' : 'offline')
      }
    }, SYNC_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [serializedSnapshot, snapshot])

  return { syncNow }
}

function applyMergedState(state: ReturnType<typeof emptyRemoteState>) {
  useStore.setState({
    trackedSetups: state.trackedSetups,
    trackedSignals: state.trackedSignals,
    trackedOutcomes: state.trackedOutcomes,
    trackerLastRunAt: state.trackerLastRunAt,
    riskInputs: state.riskInputs,
    riskInputsUpdatedAt: state.riskInputsUpdatedAt,
  })

  const store = useStore.getState()
  store.resolveTrackedOutcomes()
  store.resolveSetupOutcomes()
  store.pruneTrackerHistory()
  store.pruneSetupHistory()
}
