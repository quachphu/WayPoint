// Side-effect import: loads the platform SDK so it can auto-init analytics
// (pageviews, presence) and uncaught-error reporting on startup. Required
// even if you don't call SDK methods directly — without this, Vite tree-
// shakes the package out of the bundle and telemetry never starts. Do not
// remove unless you intentionally want to disable platform telemetry.
import '@mindstudio-ai/interface';

import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <pre
          style={{
            padding: 24,
            color: '#ff5555',
            fontSize: 13,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {this.state.error.message}
          {'\n'}
          {this.state.error.stack}
        </pre>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
