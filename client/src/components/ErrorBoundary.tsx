import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h1>
            <p className="text-slate-700 mb-4">
              The PAR(2) Discovery Engine encountered an error. Please try refreshing the page.
            </p>
            <details className="text-sm text-slate-600">
              <summary className="cursor-pointer hover:text-slate-900 mb-2">
                Technical details
              </summary>
              <pre className="bg-slate-100 border border-slate-200 p-4 rounded overflow-auto text-xs text-slate-700">
                {this.state.error?.message}
                {'\n\n'}
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface WebGLBoundaryProps {
  children: ReactNode;
  fallbackMessage?: string;
}

interface WebGLBoundaryState {
  hasError: boolean;
}

export class WebGLErrorBoundary extends Component<WebGLBoundaryProps, WebGLBoundaryState> {
  public state: WebGLBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): Partial<WebGLBoundaryState> {
    return { hasError: true };
  }

  public componentDidCatch(error: Error) {
    console.warn('WebGL not available:', error.message);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 rounded-lg border border-slate-200 p-6 text-center">
          <svg viewBox="0 0 48 48" className="w-12 h-12 mb-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="4" width="40" height="40" rx="4" />
            <path d="M14 34 L24 14 L34 34 Z" strokeDasharray="4 2" />
            <circle cx="24" cy="24" r="3" fill="currentColor" opacity="0.4" />
          </svg>
          <p className="text-sm font-semibold text-slate-700 mb-1">3D View Unavailable</p>
          <p className="text-xs text-slate-500 max-w-xs">
            {this.props.fallbackMessage || 'Your browser does not support WebGL. Open this page in Chrome, Firefox, or Safari to see the interactive 3D visualization.'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
