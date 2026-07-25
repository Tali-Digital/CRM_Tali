import React, { StrictMode, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  info: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    info: null,
  };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#ffebeb', color: '#d8000c', fontFamily: 'sans-serif' }}>
          <h2>Algo deu errado (Crash no React).</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Ver detalhes do erro</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.info && this.state.info.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
