import { useEffect, useRef, useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { RuntimeErrorPayload } from '../../context/VFSContext';

interface InstantPreviewEngineProps {
  files: Record<string, string>;
  appName?: string;
  onErrorStateChange?: (error: RuntimeErrorPayload | null) => void;
  isInspecting?: boolean;
}

export function InstantPreviewEngine({
  files,
  appName = 'BuildX App',
  onErrorStateChange,
  isInspecting = false,
}: InstantPreviewEngineProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isCompiling, setIsCompiling] = useState(true);

  // Inspector & Interactive Prototype Helper Script
  const inspectorScript = `
  <script>
    (function() {
      // ── 1. Interactive Prototype Navigation Handlers ───────────────────────
      window.switchScreen = function(screenId) {
        if (!screenId) return;
        var cleanId = String(screenId).toLowerCase().replace(/^screen-/, '');
        
        // Hide all screens
        var allScreens = document.querySelectorAll('[id^="screen-"], [data-screen], .screen-container, main > div, section[id]');
        for (var i = 0; i < allScreens.length; i++) {
          var s = allScreens[i];
          if (s.id && (s.id.startsWith('screen-') || s.id === cleanId || s.getAttribute('data-screen'))) {
            s.style.display = 'none';
            s.classList.add('hidden');
          }
        }

        // Show target screen
        var target = document.getElementById('screen-' + cleanId) ||
                     document.getElementById(cleanId) ||
                     document.querySelector('[data-screen="' + cleanId + '"]');
        if (target) {
          target.style.display = 'block';
          target.classList.remove('hidden');
        }

        // Update active class on buttons
        var buttons = document.querySelectorAll('button');
        for (var b = 0; b < buttons.length; b++) {
          var btn = buttons[b];
          var oc = btn.getAttribute('onclick') || '';
          if (oc.indexOf('switchScreen') !== -1) {
            if (oc.indexOf(cleanId) !== -1) {
              btn.classList.add('bg-white/10', 'text-white', 'font-semibold');
              btn.classList.remove('text-zinc-400', 'text-slate-400');
            } else {
              btn.classList.remove('bg-white/10', 'text-white', 'font-semibold');
              btn.classList.add('text-zinc-400', 'text-slate-400');
            }
          }
        }
      };

      window.toggleCartDrawer = function() {
        var drawer = document.getElementById('cart-drawer') || 
                     document.querySelector('[data-drawer="cart"]') || 
                     document.querySelector('.cart-drawer') ||
                     document.getElementById('screen-menu');
        if (drawer) {
          if (drawer.classList.contains('hidden') || drawer.style.display === 'none') {
            drawer.classList.remove('hidden');
            drawer.style.display = 'block';
          } else {
            drawer.classList.add('hidden');
            drawer.style.display = 'none';
          }
        }
      };

      window.filterCategory = function(cat) {
        console.log('[Prototype] Category filter:', cat);
      };

      window.addToCart = function(item) {
        var badge = document.querySelector('[data-cart-count], .cart-badge');
        if (badge) {
          var count = parseInt(badge.textContent || '0', 10) + 1;
          badge.textContent = String(count);
        }
      };

      // Ensure default screen is displayed on initialization
      setTimeout(function() {
        var visibleScreen = document.querySelector('[id^="screen-"]:not(.hidden), [data-screen]:not(.hidden)');
        if (!visibleScreen) {
          var firstScreen = document.getElementById('screen-discovery') ||
                            document.getElementById('screen-auth') ||
                            document.querySelector('[id^="screen-"]');
          if (firstScreen) {
            firstScreen.style.display = 'block';
            firstScreen.classList.remove('hidden');
          }
        }
      }, 50);

      // ── 2. Click-to-Code Visual Inspector ──────────────────────────────────
      var isInspectActive = ${isInspecting ? 'true' : 'false'};
      var hoveredEl = null;

      window.addEventListener('message', function(e) {
        if (e.data && (e.data.type === 'BUILDX_SET_INSPECT_MODE' || e.data.type === 'BUILDX_SET_INSPECTING')) {
          isInspectActive = Boolean(e.data.active ?? e.data.isInspecting);
          if (!isInspectActive && hoveredEl) {
            hoveredEl.style.outline = '';
            hoveredEl.style.outlineOffset = '';
            hoveredEl.style.backgroundColor = '';
            hoveredEl.style.cursor = '';
            hoveredEl = null;
          }
        }
      });

      document.addEventListener('mouseover', function(e) {
        if (!isInspectActive) return;
        var target = e.target;
        if (!target || target === document.body || target === document.documentElement) return;
        if (hoveredEl && hoveredEl !== target) {
          hoveredEl.style.outline = '';
          hoveredEl.style.outlineOffset = '';
          hoveredEl.style.backgroundColor = '';
          hoveredEl.style.cursor = '';
        }
        hoveredEl = target;
        hoveredEl.style.outline = '2px solid #38BDF8';
        hoveredEl.style.outlineOffset = '2px';
        hoveredEl.style.backgroundColor = 'rgba(56, 189, 248, 0.12)';
        hoveredEl.style.cursor = 'crosshair';
      }, true);

      document.addEventListener('mouseout', function(e) {
        if (!isInspectActive) return;
        var target = e.target;
        if (target && target.style) {
          target.style.outline = '';
          target.style.outlineOffset = '';
          target.style.backgroundColor = '';
          target.style.cursor = '';
        }
      }, true);

      document.addEventListener('click', function(e) {
        if (!isInspectActive) return;
        e.preventDefault();
        e.stopPropagation();
        var target = e.target;
        if (!target) return;

        if (target.style) {
          target.style.outline = '';
          target.style.outlineOffset = '';
          target.style.backgroundColor = '';
          target.style.cursor = '';
        }

        window.parent.postMessage({
          type: 'BUILDX_PREVIEW_ELEMENT_CLICK',
          element: {
            tagName: target.tagName ? target.tagName.toLowerCase() : '',
            textContent: (target.textContent || '').trim().slice(0, 80),
            id: target.id || '',
            className: typeof target.className === 'string' ? target.className : '',
            placeholder: target.getAttribute ? target.getAttribute('placeholder') || '' : '',
            title: target.getAttribute ? target.getAttribute('title') || '' : ''
          }
        }, '*');
      }, true);

      window.parent.postMessage({ type: 'BUILDX_PREVIEW_MOUNTED' }, '*');
    })();
  </script>
  `;

  // Extract all frontend source files into a clean map
  const normalizedFiles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [rawPath, content] of Object.entries(files || {})) {
      if (
        rawPath === 'preview.html' ||
        rawPath.endsWith('.sql') ||
        rawPath.endsWith('.prisma') ||
        rawPath.endsWith('.md') ||
        rawPath.startsWith('backend/')
      ) {
        continue;
      }
      const cleanPath = rawPath.startsWith('frontend/')
        ? rawPath.replace('frontend/', '')
        : rawPath.startsWith('/')
          ? rawPath.slice(1)
          : rawPath;
      map[cleanPath] = content;
      if (cleanPath.startsWith('src/')) {
        map[cleanPath.replace('src/', '')] = content;
      }
    }
    return map;
  }, [files]);

  // Construct isolated HTML with embedded in-memory transpiler and module loader
  const srcDoc = useMemo(() => {
    // If preview.html exists in files, inject prototype script & inspector
    if (files['preview.html']) {
      const rawHtml = files['preview.html'];
      if (rawHtml.includes('</body>')) {
        return rawHtml.replace('</body>', `${inspectorScript}</body>`);
      }
      return `${rawHtml}\n${inspectorScript}`;
    }

    // Safe Base64 encoding to prevent <script> injection / premature tag termination
    let encodedFiles = '';
    try {
      encodedFiles = btoa(unescape(encodeURIComponent(JSON.stringify(normalizedFiles))));
    } catch {
      encodedFiles = '';
    }

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appName}</title>
  
  <!-- Storage shim: the sandbox has no allow-same-origin, so this document runs in
       an opaque origin where touching window.localStorage throws a SecurityError.
       AI-generated components commonly use it, so install an in-memory stand-in
       before any other script runs. -->
  <script>
    (function () {
      function memoryStorage() {
        var data = {};
        return {
          getItem: function (k) { var s = String(k); return Object.prototype.hasOwnProperty.call(data, s) ? data[s] : null; },
          setItem: function (k, v) { data[String(k)] = String(v); },
          removeItem: function (k) { delete data[String(k)]; },
          clear: function () { data = {}; },
          key: function (i) { var ks = Object.keys(data); return i < ks.length ? ks[i] : null; },
          get length() { return Object.keys(data).length; }
        };
      }
      ['localStorage', 'sessionStorage'].forEach(function (name) {
        var usable = false;
        try {
          var s = window[name];
          if (s) { s.setItem('__buildx_probe__', '1'); s.removeItem('__buildx_probe__'); usable = true; }
        } catch (e) { usable = false; }
        if (!usable) {
          try {
            Object.defineProperty(window, name, { value: memoryStorage(), configurable: true });
          } catch (e) { /* nothing further we can do */ }
        }
      });
    })();
  </script>

  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: { 500: '#6366f1', 600: '#4f46e5' }
          }
        }
      }
    };
  </script>

  <!-- React 18 & Babel Standalone CDN -->
  <script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.24.4/babel.min.js"></script>

  <style>
    body {
      background-color: #090a0f;
      color: #f8fafc;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 0;
      min-height: 100vh;
      overflow-x: hidden;
    }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
  </style>
</head>
<body class="bg-[#090a0f] text-slate-100 min-h-screen">
  <div id="root"></div>

  <!-- Runtime & In-Memory Transpiler Script -->
  <script>
    (function() {
      var rawB64 = "${encodedFiles}";
      var files = {};
      try {
        files = JSON.parse(decodeURIComponent(escape(atob(rawB64))));
      } catch (e) {
        console.error('[VFS] Failed to decode files payload:', e);
      }

      var moduleCache = {};
      var isInspectActive = ${isInspecting ? 'true' : 'false'};

      // ── 1. Error Broadcasting Bridge ──────────────────────────────────────
      function reportError(title, message, path, line, column) {
        window.parent.postMessage({
          type: 'BUILDX_SANDBOX_ERROR',
          error: {
            title: title || 'Runtime Error',
            message: message || 'An unexpected error occurred during execution',
            path: path || 'App.tsx',
            line: line || 1,
            column: column || 1
          }
        }, '*');
      }

      window.onerror = function(msg, url, lineNo, columnNo, error) {
        var errorMsg = error && error.message ? error.message : String(msg);
        reportError('Execution Error', errorMsg, url, lineNo, columnNo);
        return false;
      };

      window.addEventListener('unhandledrejection', function(event) {
        reportError('Unhandled Promise Rejection', event.reason ? event.reason.message || String(event.reason) : 'Promise rejected');
      });

      // ── 2. Click-to-Code Inspector ────────────────────────────────────────
      var hoveredEl = null;

      window.addEventListener('message', function(e) {
        if (e.data && (e.data.type === 'BUILDX_SET_INSPECT_MODE' || e.data.type === 'BUILDX_SET_INSPECTING')) {
          isInspectActive = Boolean(e.data.active ?? e.data.isInspecting);
          if (!isInspectActive && hoveredEl) {
            hoveredEl.style.outline = '';
            hoveredEl.style.outlineOffset = '';
            hoveredEl.style.backgroundColor = '';
            hoveredEl.style.cursor = '';
            hoveredEl = null;
          }
        }
      });

      document.addEventListener('mouseover', function(e) {
        if (!isInspectActive) return;
        var target = e.target;
        if (!target || target === document.body || target === document.documentElement) return;
        if (hoveredEl && hoveredEl !== target) {
          hoveredEl.style.outline = '';
          hoveredEl.style.outlineOffset = '';
          hoveredEl.style.backgroundColor = '';
          hoveredEl.style.cursor = '';
        }
        hoveredEl = target;
        hoveredEl.style.outline = '2px solid #38BDF8';
        hoveredEl.style.outlineOffset = '2px';
        hoveredEl.style.backgroundColor = 'rgba(56, 189, 248, 0.12)';
        hoveredEl.style.cursor = 'crosshair';
      }, true);

      document.addEventListener('mouseout', function(e) {
        if (!isInspectActive) return;
        var target = e.target;
        if (target && target.style) {
          target.style.outline = '';
          target.style.outlineOffset = '';
          target.style.backgroundColor = '';
          target.style.cursor = '';
        }
      }, true);

      document.addEventListener('click', function(e) {
        if (!isInspectActive) return;
        e.preventDefault();
        e.stopPropagation();
        var target = e.target;
        if (!target) return;

        if (target.style) {
          target.style.outline = '';
          target.style.outlineOffset = '';
          target.style.backgroundColor = '';
          target.style.cursor = '';
        }

        window.parent.postMessage({
          type: 'BUILDX_PREVIEW_ELEMENT_CLICK',
          element: {
            tagName: target.tagName ? target.tagName.toLowerCase() : '',
            textContent: (target.textContent || '').trim().slice(0, 80),
            id: target.id || '',
            className: typeof target.className === 'string' ? target.className : '',
            placeholder: target.getAttribute ? target.getAttribute('placeholder') || '' : '',
            title: target.getAttribute ? target.getAttribute('title') || '' : ''
          }
        }, '*');
      }, true);

      // ── 3. Universal Mock Ecosystem & Icon Synthesizer ─────────────────────
      var LucideIconProxy = new Proxy({}, {
        get: function(target, prop) {
          if (typeof prop !== 'string' || prop === '__esModule' || prop === 'default') {
            return target[prop];
          }
          return function LucideIcon(props) {
            props = props || {};
            var size = props.size || 18;
            var color = props.color || 'currentColor';
            var className = props.className || '';
            var strokeWidth = props.strokeWidth || 2;
            
            return React.createElement('svg', {
              xmlns: 'http://www.w3.org/2000/svg',
              width: size,
              height: size,
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: color,
              strokeWidth: strokeWidth,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              className: 'lucide lucide-' + String(prop).toLowerCase() + ' ' + className,
              style: props.style
            }, React.createElement('circle', { cx: '12', cy: '12', r: '8', strokeDasharray: '3 3' }));
          };
        }
      });

      var MotionProxy = {
        div: function(props) { return React.createElement('div', props, props.children); },
        button: function(props) { return React.createElement('button', props, props.children); },
        span: function(props) { return React.createElement('span', props, props.children); },
        section: function(props) { return React.createElement('section', props, props.children); },
        header: function(props) { return React.createElement('header', props, props.children); },
        main: function(props) { return React.createElement('main', props, props.children); },
        nav: function(props) { return React.createElement('nav', props, props.children); }
      };

      var BuiltInModules = {
        'react': window.React,
        'react-dom': window.ReactDOM,
        'react-dom/client': window.ReactDOM,
        'lucide-react': LucideIconProxy,
        'framer-motion': {
          motion: MotionProxy,
          AnimatePresence: function(props) { return props.children; }
        },
        'clsx': function() {
          var args = Array.prototype.slice.call(arguments);
          return args.filter(Boolean).join(' ');
        },
        'tailwind-merge': {
          twMerge: function() {
            var args = Array.prototype.slice.call(arguments);
            return args.filter(Boolean).join(' ');
          }
        },
        'axios': {
          get: function() { return Promise.resolve({ data: {} }); },
          post: function() { return Promise.resolve({ data: {} }); },
          put: function() { return Promise.resolve({ data: {} }); },
          delete: function() { return Promise.resolve({ data: {} }); },
          create: function() { return BuiltInModules.axios; }
        }
      };

      // ── 4. Virtual Module Resolver ─────────────────────────────────────────
      function resolveFilePath(importPath, currentFile) {
        if (!importPath.startsWith('.')) return importPath;

        var currentDir = currentFile ? currentFile.substring(0, currentFile.lastIndexOf('/')) : '';
        var parts = (currentDir ? currentDir + '/' + importPath : importPath).split('/');
        var resolvedParts = [];

        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          if (p === '.' || p === '') continue;
          if (p === '..') {
            resolvedParts.pop();
          } else {
            resolvedParts.push(p);
          }
        }

        var normalized = resolvedParts.join('/');
        var candidates = [
          normalized,
          normalized + '.tsx',
          normalized + '.ts',
          normalized + '.jsx',
          normalized + '.js',
          normalized + '/index.tsx',
          normalized + '/index.ts',
          'src/' + normalized,
          'src/' + normalized + '.tsx',
          'src/' + normalized + '.ts'
        ];

        for (var c = 0; c < candidates.length; c++) {
          if (files[candidates[c]] !== undefined) {
            return candidates[c];
          }
        }

        return normalized;
      }

      function customRequire(moduleName, currentFile) {
        if (BuiltInModules[moduleName]) {
          return BuiltInModules[moduleName];
        }

        var resolvedKey = resolveFilePath(moduleName, currentFile);
        if (moduleCache[resolvedKey]) {
          return moduleCache[resolvedKey].exports;
        }

        var code = files[resolvedKey];
        if (!code) {
          var match = Object.keys(files).find(function(k) {
            return k.endsWith(moduleName) || k.endsWith(moduleName + '.tsx') || k.endsWith(moduleName + '.ts');
          });
          if (match) {
            resolvedKey = match;
            code = files[match];
          }
        }

        if (!code) {
          console.warn('[VFS Module] Stubbing unresolvable module:', moduleName);
          return function StubComponent(props) {
            return React.createElement('div', { className: 'p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 text-purple-300 text-xs font-mono' },
              'Module ' + moduleName + ' loaded'
            );
          };
        }

        var module = { exports: {} };
        moduleCache[resolvedKey] = module;

        try {
          // Use Babel with CommonJS module transformation to convert import/export statements
          var transpiled = Babel.transform(code, {
            presets: [
              ['env', { modules: 'commonjs' }],
              'react',
              'typescript'
            ],
            filename: resolvedKey
          }).code;

          var moduleFn = new Function('exports', 'require', 'module', 'React', 'ReactDOM', transpiled);
          var localRequire = function(path) {
            return customRequire(path, resolvedKey);
          };
          moduleFn(module.exports, localRequire, module, window.React, window.ReactDOM);
        } catch (err) {
          console.error('[VFS Transpile Error] in ' + resolvedKey + ':', err);
          reportError('Transpilation Error', err.message, resolvedKey, err.loc ? err.loc.line : 1, err.loc ? err.loc.column : 1);
          throw err;
        }

        return module.exports;
      }

      // ── 5. Main Component Mount ────────────────────────────────────────────
      try {
        var appKey = files['src/App.tsx'] ? 'src/App.tsx' : files['App.tsx'] ? 'App.tsx' : Object.keys(files).find(function(k) { return k.endsWith('App.tsx'); });
        if (!appKey) {
          appKey = Object.keys(files).find(function(k) { return k.endsWith('.tsx') && !k.includes('index'); });
        }

        if (!appKey) {
          document.getElementById('root').innerHTML = '<div class="p-8 text-center text-zinc-400 font-mono text-xs">No primary React component found to render.</div>';
          return;
        }

        var appModule = customRequire(appKey);
        var RootComponent = appModule.default || appModule.App || appModule;

        if (typeof RootComponent === 'function' || (typeof RootComponent === 'object' && RootComponent !== null)) {
          var root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(RootComponent));
          
          window.parent.postMessage({ type: 'BUILDX_PREVIEW_MOUNTED' }, '*');
        } else {
          throw new Error('Component at ' + appKey + ' did not export a valid React component.');
        }
      } catch (err) {
        reportError('Mount Error', err.message, appKey || 'App.tsx');
        document.getElementById('root').innerHTML = '<div class="p-6 m-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 font-mono text-xs"><strong class="text-red-200">Runtime Exception:</strong> ' + err.message + '</div>';
      }
    })();
  </script>
</body>
</html>`;
  }, [normalizedFiles, files, appName, isInspecting, inspectorScript]);

  // Handle messages from iframe (e.g. errors and click-to-code)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BUILDX_SANDBOX_ERROR' && event.data.error) {
        onErrorStateChange?.(event.data.error);
      } else if (event.data?.type === 'BUILDX_PREVIEW_MOUNTED') {
        setIsCompiling(false);
        onErrorStateChange?.(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onErrorStateChange]);

  return (
    <div className="relative w-full h-full min-h-0 bg-[#090a0f] flex flex-col overflow-hidden">
      {/* Isolated In-Memory Render Iframe.
          No allow-same-origin: combined with allow-scripts it lets framed content
          remove its own sandbox, and this frame runs AI-generated code while the
          JWT sits in localStorage. The parent/frame channel is postMessage only,
          so an opaque origin costs us nothing. */}
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        title={appName}
        sandbox="allow-scripts allow-forms allow-popups allow-modals"
        className="w-full h-full flex-1 border-0 bg-[#090a0f]"
        onLoad={() => setIsCompiling(false)}
      />

      {/* Loading Overlay */}
      {isCompiling && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 bg-[#090a0f]/80 backdrop-blur-sm text-xs font-mono text-indigo-300">
          <Loader2 size={20} className="animate-spin text-indigo-400" />
          <span className="animate-pulse">Synthesizing Instant Preview...</span>
        </div>
      )}
    </div>
  );
}
