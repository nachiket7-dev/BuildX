/**
 * BuildX Live Preview Sandbox Runner
 * This script runs inside the browser iframe to provide module resolution,
 * React Router context management, mock API handling, and error boundaries.
 */

(function () {
  'use strict';

  // Global error handlers
  window.addEventListener('error', function (e) {
    var rootEl = document.getElementById('root') || document.body;
    rootEl.innerHTML =
      '<div style="padding: 24px; color: #fca5a5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; margin: 20px; font-family: monospace;">' +
      '<h3 style="margin-top: 0; font-size: 16px; font-weight: 700;">Live Preview Execution Error</h3>' +
      '<p style="font-size: 14px; margin: 10px 0;">' + (e.message || '') + '</p>' +
      '<pre style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; font-size: 11px; overflow-x: auto; margin: 0;">' + (e.error && e.error.stack || '') + '</pre>' +
      '</div>';
  });

  window.addEventListener('unhandledrejection', function (e) {
    var msg = (e.reason && e.reason.message) || String(e.reason) || 'Unhandled rejection';
    var stk = (e.reason && e.reason.stack) || '';
    var rootEl = document.getElementById('root') || document.body;
    rootEl.innerHTML =
      '<div style="padding: 24px; color: #fca5a5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; margin: 20px; font-family: monospace;">' +
      '<h3 style="margin-top: 0; font-size: 16px; font-weight: 700;">Live Preview Runtime Error</h3>' +
      '<p style="font-size: 14px; margin: 10px 0;">' + msg + '</p>' +
      '<pre style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; font-size: 11px; overflow-x: auto; margin: 0;">' + stk + '</pre>' +
      '</div>';
  });

  // Prevent double <Router> nesting crashes (UNSAFE_invariant)
  if (window.ReactRouterDOM) {
    (function () {
      function isInsideRouter() {
        try {
          var NavCtx = (window.ReactRouter && window.ReactRouter.UNSAFE_NavigationContext)
            || (window.ReactRouterDOM && window.ReactRouterDOM.UNSAFE_NavigationContext);
          if (NavCtx && window.React && window.React.useContext) {
            var ctx = window.React.useContext(NavCtx);
            return ctx !== null && ctx !== undefined;
          }
        } catch (e) {}
        return false;
      }

      function createSafeRouterComponent(Original) {
        if (!Original) return Original;
        return function SafeRouter(props) {
          if (isInsideRouter()) {
            return props.children || null;
          }
          return window.React.createElement(Original, props);
        };
      }

      var SafeBrowserRouter = createSafeRouterComponent(window.ReactRouterDOM.BrowserRouter);
      var SafeHashRouter = createSafeRouterComponent(window.ReactRouterDOM.HashRouter);
      var SafeMemoryRouter = createSafeRouterComponent(window.ReactRouterDOM.MemoryRouter);
      var SafeRouter = createSafeRouterComponent(window.ReactRouterDOM.Router || (window.ReactRouter && window.ReactRouter.Router));

      window.ReactRouterDOM.BrowserRouter = SafeBrowserRouter;
      window.ReactRouterDOM.HashRouter = SafeHashRouter;
      window.ReactRouterDOM.MemoryRouter = SafeMemoryRouter;
      if (window.ReactRouterDOM.Router) window.ReactRouterDOM.Router = SafeRouter;
      if (window.ReactRouter) {
        window.ReactRouter.BrowserRouter = SafeBrowserRouter;
        window.ReactRouter.Router = SafeRouter;
      }
    })();
  }
})();
