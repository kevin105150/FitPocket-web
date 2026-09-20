import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Suppress benign media play interruption errors globally
const isBenignMediaError = (message: any) => {
  if (!message) return false;
  const msg = String(message).toLowerCase();
  return (
    msg.includes('play()') ||
    msg.includes('pause()') ||
    msg.includes('interrupted') ||
    msg.includes('media was removed') ||
    msg.includes('load request') ||
    msg.includes('renderedcameraimpl') ||
    msg.includes('onabort') ||
    msg.includes('aborterror') ||
    msg.includes('notallowederror') ||
    msg.includes('notfounderror') ||
    msg.includes('securityerror') ||
    msg.includes('notreadableerror') ||
    msg.includes('track start failed') ||
    msg.includes('concurrent') ||
    msg.includes('request was cancelled') ||
    msg.includes('[vite] failed to connect') ||
    msg.includes('websocket') ||
    msg.includes('net::err_connection_refused')
  );
};

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (!reason) return;

  const message = reason.message || String(reason);
  const name = reason.name || '';
  const stack = reason.stack || '';
  
  if (
    name === 'AbortError' ||
    name === 'NotAllowedError' ||
    name === 'NotFoundError' ||
    name === 'NotReadableError' ||
    isBenignMediaError(message) ||
    isBenignMediaError(name) ||
    isBenignMediaError(stack)
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

// Suppress global uncaught media errors that might not be caught by unhandledrejection
window.onerror = (message, source, lineno, colno, error) => {
  if (isBenignMediaError(message)) {
    return true; 
  }
  if (error && (isBenignMediaError(error.name) || isBenignMediaError(error.message) || isBenignMediaError(error.stack))) {
    return true;
  }
  return false;
};

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  const combinedMessage = args.map(arg => {
    if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;
    if (arg && typeof arg === 'object') {
      try {
        // Some errors like DOMException have properties but aren't traditional Errors
        return `${arg.name || 'Error'}: ${arg.message || 'Unknown error'}\n${arg.stack || ''}`;
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  if (isBenignMediaError(combinedMessage)) {
    return;
  }
  
  // Extra check for Error-like objects in args
  const hasBenignError = args.some(arg => {
    if (!arg) return false;
    if (arg instanceof Error || (typeof arg === 'object' && (arg.name || arg.message))) {
      return (
        isBenignMediaError(arg.name) || 
        isBenignMediaError(arg.message) || 
        isBenignMediaError(arg.stack) ||
        isBenignMediaError(String(arg))
      );
    }
    return isBenignMediaError(String(arg));
  });
  
  if (hasBenignError) return;
  
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  const combinedMessage = args.map(arg => String(arg)).join(' ');
  if (isBenignMediaError(combinedMessage)) {
    return;
  }
  originalConsoleWarn(...args);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
