import { DashboardLayout } from './components/layout/DashboardLayout'
import { AppErrorBoundary } from './components/system/AppErrorBoundary'

export default function App() {
  return (
    <AppErrorBoundary>
      <DashboardLayout />
    </AppErrorBoundary>
  )
}
