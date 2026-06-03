import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fieldName?: string;
  sectionName?: string;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an exception:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
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
