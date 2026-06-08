import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }
  
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('React app mounted successfully');
} catch (error) {
  console.error('Error mounting React app:', error);
  document.body.innerHTML = '<div style="padding:20px;color:red;">Error loading app: ' + error.message + '</div>';
}