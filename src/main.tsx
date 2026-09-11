import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './ui/styles/tailwind.css';
import './ui/styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found — check index.html');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
