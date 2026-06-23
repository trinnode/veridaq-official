"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
  portal?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.portal ? `:${this.props.portal}` : ""}]`, error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-void p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-error/30 bg-error/10">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="max-w-md text-sm text-muted">
            {this.props.portal ? `The ${this.props.portal} portal encountered an error.` : "An unexpected error occurred."}
          </p>
          <pre className="max-w-lg overflow-auto rounded border border-surface-border bg-surface-card p-4 text-left font-mono text-xs text-red-400">
            {this.state.error?.message ?? "Unknown error"}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="bg-accent text-void rounded-lg px-6 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
