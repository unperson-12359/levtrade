import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useStore } from '../../store'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
  message: string
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      message: '',
    }
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: toErrorMessage(error),
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    useStore.getState().pushRuntimeDiagnostic({
      source: 'react.boundary',
      message: toErrorMessage(error),
      stack: info.componentStack || toErrorStack(error),
    })
  }

  private onReload = () => {
    window.location.reload()
  }

  private onTryAgain = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="app-crash-shell">
        <section className="app-crash-card">
          <div className="panel-kicker">Runtime guard</div>
          <h1 className="panel-title">The app hit an unexpected error</h1>
          <p className="app-crash-copy" title={this.state.message}>
            {this.state.message}
          </p>
          <div className="app-crash-actions">
            <button type="button" className="chart-reset-button" onClick={this.onTryAgain}>
              Try again
            </button>
            <button type="button" className="chart-reset-button" onClick={this.onReload}>
              Reload
            </button>
          </div>
        </section>
      </div>
    )
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown runtime error'
  }
}

function toErrorStack(error: unknown): string | null {
  if (error instanceof Error) return error.stack ?? null
  return null
}
