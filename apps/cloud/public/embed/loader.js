(function () {
  if (typeof window === 'undefined') return;
  if (window.__aivoyLoaded) return;
  window.__aivoyLoaded = true;

  // Find our own script tag — document.currentScript is null after async load,
  // so we fall back to looking for any aivoy loader by src.
  var scripts = document.getElementsByTagName('script');
  var self = null;
  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i];
    if (s.src && /\/embed\/loader\.js(\?|$)/.test(s.src)) {
      self = s;
      break;
    }
  }
  if (!self) {
    console.error('[aivoy] loader: could not find own script tag');
    return;
  }

  var token = self.getAttribute('data-token');
  if (!token) {
    console.error('[aivoy] loader: data-token attribute is required');
    return;
  }

  var host;
  try {
    host = new URL(self.src).origin;
  } catch (e) {
    console.error('[aivoy] loader: could not derive host from src');
    return;
  }
  var explicitHost = self.getAttribute('data-host');
  if (explicitHost) host = explicitHost;

  var target = self.getAttribute('data-target') || undefined;

  var bundle = document.createElement('script');
  bundle.src = host + '/embed/standalone.js';
  bundle.async = true;
  bundle.onload = function () {
    if (!window.Aivoy || typeof window.Aivoy.mount !== 'function') {
      console.error('[aivoy] loader: bundle loaded but window.Aivoy.mount is missing');
      return;
    }
    window.Aivoy.mount({ token: token, host: host, target: target }).catch(function (err) {
      console.error('[aivoy] mount failed:', err);
    });
  };
  bundle.onerror = function () {
    console.error('[aivoy] loader: failed to load standalone bundle from', bundle.src);
  };
  document.head.appendChild(bundle);
})();
