import { ObservatoryLayout } from './components/observatory/ObservatoryLayout'
import { AppErrorBoundary } from './components/system/AppErrorBoundary'

export default function App() {
  return (
    <AppErrorBoundary>
      <ObservatoryLayout />
    </AppErrorBoundary>
  )
}
