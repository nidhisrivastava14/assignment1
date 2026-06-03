import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error details server-side or to a developer console
    console.error("ErrorBoundary caught an exception:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Return custom fallback UI if provided, otherwise a default inline banner
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      const label = this.props.fieldName 
        ? `[Field: ${this.props.fieldName}] - Invalid config`
        : this.props.sectionName
        ? `[Section: ${this.props.sectionName}] - Render failed`
        : "Component - Render failed";

      return (
        <div style={{
          padding: '10px 14px',
          margin: '4px 0',
          border: '1px dashed var(--error-border, #fecaca)',
          borderRadius: '8px',
          backgroundColor: 'var(--error-bg, #fef2f2)',
          color: 'var(--error-text, #dc2626)',
          fontSize: '13px',
          fontFamily: 'monospace',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontWeight: 'bold' }}>⚠️ Config Warning:</span>
          <span>{label}</span>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
