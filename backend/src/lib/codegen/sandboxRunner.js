/**
 * BuildX Live Preview Sandbox Runner & Automated Error Interceptor
 *
 * Runs inside the browser preview iframe to provide:
 * 1. Global error & unhandled rejection capturing with stack trace extraction.
 * 2. Automated error payload reporting to host window via postMessage (BUILDX_SANDBOX_ERROR).
 * 3. React Router context safety guards.
 * 4. Error overlay with 1-click Auto-Fix trigger dispatch.
 */

(function () {
  'use strict';

  function reportErrorToHost(errorPayload) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'BUILDX_SANDBOX_ERROR',
            source: 'live_preview_sandbox',
            timestamp: Date.now(),
            error: errorPayload,
          },
          '*'
        );
      }
    } catch (_) {
      /* ignore cross-origin postMessage restrictions */
    }
  }

  function renderErrorOverlay(title, message, stack) {
    var rootEl = document.getElementById('root') || document.body;
    if (!rootEl) return;

    var sanitizedMsg = String(message || 'Unknown runtime error').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var sanitizedStack = String(stack || 'No stack trace available').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    rootEl.innerHTML =
      '<div style="padding: 24px; color: #fca5a5; background: rgba(15, 10, 24, 0.95); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 16px; margin: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; box-shadow: 0 20px 50px rgba(0,0,0,0.6);">' +
      '  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(239,68,68,0.2); padding-bottom: 12px;">' +
      '    <div style="display: flex; align-items: center; gap: 10px;">' +
      '      <span style="font-size: 20px;">⚠️</span>' +
      '      <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #f87171;">' + title + '</h3>' +
      '    </div>' +
      '    <span style="font-size: 11px; color: #9ca3af; background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 99px;">AUTO-FIX READY</span>' +
      '  </div>' +
      '  <p style="font-size: 13px; color: #fee2e2; margin: 0 0 12px 0; line-height: 1.5;">' + sanitizedMsg + '</p>' +
      '  <pre style="background: rgba(0,0,0,0.5); color: #fca5a5; padding: 14px; border-radius: 10px; font-size: 11px; overflow-x: auto; max-height: 240px; margin: 0 0 16px 0; border: 1px solid rgba(255,255,255,0.05); line-height: 1.6;">' + sanitizedStack + '</pre>' +
      '  <div style="display: flex; gap: 10px; align-items: center;">' +
      '    <button id="buildx-autofix-btn" onclick="window.triggerBuildXAutoFix && window.triggerBuildXAutoFix()" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(99,102,241,0.4);">' +
      '      ⚡ Auto-Fix with Cortex Agent' +
      '    </button>' +
      '    <span style="font-size: 11px; color: #9ca3af;">Pipes stack trace to Nemotron 3 Ultra + GLM-5.2 pipeline</span>' +
      '  </div>' +
      '</div>';
  }

  // Global uncaught error listener
  window.addEventListener('error', function (e) {
    var errorPayload = {
      message: e.message || 'Uncaught runtime error',
      stack: (e.error && e.error.stack) || (e.filename ? e.filename + ':' + e.lineno + ':' + e.colno : ''),
      filename: e.filename || '',
      lineno: e.lineno || 0,
      colno: e.colno || 0,
    };

    reportErrorToHost(errorPayload);
    renderErrorOverlay('Sandbox Runtime Execution Error', errorPayload.message, errorPayload.stack);
  });

  // Global unhandled promise rejection listener
  window.addEventListener('unhandledrejection', function (e) {
    var msg = (e.reason && e.reason.message) || String(e.reason) || 'Unhandled promise rejection';
    var stk = (e.reason && e.reason.stack) || '';

    var errorPayload = {
      message: msg,
      stack: stk,
      type: 'unhandledrejection',
    };

    reportErrorToHost(errorPayload);
    renderErrorOverlay('Sandbox Unhandled Promise Rejection', errorPayload.message, errorPayload.stack);
  });

  // Helper trigger attached to window for overlay button
  window.triggerBuildXAutoFix = function () {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'BUILDX_TRIGGER_AUTO_FIX' }, '*');
    }
  };

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
