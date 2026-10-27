import React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Catches render errors. `inline` keeps the app shell around the error
 * (used for pages); otherwise it fills the screen.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className={`flex items-center justify-center bg-canvas px-4 ${this.props.inline ? "min-h-[50vh]" : "min-h-screen"}`}
      >
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-danger-soft">
            <AlertTriangle className="h-5 w-5 text-danger-fg" aria-hidden="true" />
          </div>
          <h1 className="text-base font-semibold text-fg">Something went wrong</h1>
          <p className="mt-1 text-caption text-fg-muted">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-fg hover:bg-surface-2 transition-colors"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" /> Reload page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
