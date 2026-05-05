import React from "react";
import { BG, MUTED, ACCENT } from "../lib/constants";

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", gap: 12, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#DC2626" }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: MUTED, maxWidth: 480, textAlign: "center", wordBreak: "break-word" }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 8, padding: "8px 20px", borderRadius: 7, border: "none", background: ACCENT, color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
