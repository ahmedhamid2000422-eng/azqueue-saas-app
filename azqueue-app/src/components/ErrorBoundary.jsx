import { Component } from "react";

/**
 * ErrorBoundary — catches unhandled JS errors in child component trees and
 * renders a friendly recovery screen instead of a blank white page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 *   // With a custom fallback:
 *   <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *     ...
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log for debugging without crashing further
    console.error("[ErrorBoundary] caught:", error, info?.componentStack ?? "");
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0c",
          color: "#f2f0ea",
          padding: "2rem",
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
        }}
      >
        {/* AQ badge */}
        <div
          style={{
            width: 44,
            height: 44,
            background: "#c9a86a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.5rem",
            borderRadius: 2,
          }}
        >
          <span style={{ color: "#141410", fontWeight: 600, fontSize: 14, fontFamily: "serif" }}>
            AQ
          </span>
        </div>

        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#6e6c65",
            marginBottom: "0.75rem",
          }}
        >
          Something went wrong
        </div>

        <h1
          style={{
            fontFamily: "serif",
            fontSize: 28,
            fontWeight: 300,
            color: "#e4cb95",
            marginBottom: "0.75rem",
            letterSpacing: "-0.02em",
          }}
        >
          This page ran into an error
        </h1>

        <p style={{ fontSize: 13, color: "#6e6c65", maxWidth: 380, lineHeight: 1.6, marginBottom: "2rem" }}>
          An unexpected error occurred. Try refreshing the page — if the problem
          continues, contact support.
        </p>

        {/* Show error message in dev mode */}
        {import.meta.env.DEV && this.state.error && (
          <pre
            style={{
              fontSize: 11,
              color: "#d49185",
              background: "#1a1a1e",
              border: "1px solid #2a2a2e",
              borderRadius: 2,
              padding: "1rem 1.25rem",
              maxWidth: 560,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              textAlign: "left",
              marginBottom: "1.5rem",
            }}
          >
            {this.state.error?.message}
          </pre>
        )}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#c9a86a",
              color: "#141410",
              border: "none",
              padding: "0.6rem 1.5rem",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.06em",
              cursor: "pointer",
              borderRadius: 1,
            }}
          >
            Refresh page
          </button>
          <button
            onClick={() => this.handleReset()}
            style={{
              background: "transparent",
              color: "#a8a69e",
              border: "1px solid #26262a",
              padding: "0.6rem 1.25rem",
              fontSize: 12,
              cursor: "pointer",
              borderRadius: 1,
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
