/* Mis direcciones IP: aplicación estática. No recopila datos en un servidor propio. */
(() => {
  'use strict';

  const STORAGE_HISTORY = 'misip_history_v1';
  const STORAGE_PREF = 'misip_save_history_v1';
  const MAX_HISTORY = 12;
  const TIMEOUT_MS = 9500;
  const $ = (id) => document.getElementById(id);
  const state = { ipv4: null, ipv6: null, busy: false, toastTimer: null };

  const isIpv4 = (value) => {
    if (typeof value !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false;
    return value.split('.').every((part) => Number(part) <= 255);
  };
  const isIpv6 = (value) => typeof value === 'string' && value.includes(':') && /^[0-9a-f:.]+$/i.test(value);
  const safeText = (value, fallback = 'No disponible') => value == null || String(value).trim() === '' ? fallback : String(value).trim();

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function getIp(url, validator) {
    const data = await fetchJson(url);
    if (!validator(data?.ip)) throw new Error('No se obtuvo una dirección válida');
    return data.ip;
  }

  function detectBrowser() {
    const ua = navigator.userAgent || '';
    if (/Edg\//.test(ua)) return 'Microsoft Edge';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/Firefox\//.test(ua)) return 'Mozilla Firefox';
    if (/Chrome\//.test(ua)) return 'Google Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Navegador no identificado';
  }

  function detectOS() {
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS / iPadOS';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'No identificado';
  }

  function setNetworkStatus() {
    const online = navigator.onLine;
    $('online-text').textContent = online ? 'En línea' : 'Sin conexión';
    $('connection-value').textContent = online ? 'En línea' : 'Sin conexión';
    $('header-state').classList.toggle('offline', !online);
  }

  function fillDevice() {
    $('browser-value').textContent = detectBrowser();
    $('os-value').textContent = detectOS();
    $('language-value').textContent = navigator.language || 'No disponible';
    $('device-timezone-value').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'No disponible';
    setNetworkStatus();
  }

  function setIp(version, ip) {
    const known = Boolean(ip);
    $(`${version}-value`).textContent = known ? ip : 'No disponible';
    $(`${version}-status`).textContent = known
      ? 'Dirección detectada correctamente'
      : version === 'ipv6' ? 'Tu conexión puede no admitir IPv6' : 'No se pudo consultar esta dirección';
    $(`copy-${version}`).disabled = !known;
  }

  async function loadGeo(ip) {
    const ids = ['isp-value', 'asn-value', 'country-value', 'region-value', 'timezone-value'];
    ids.forEach((id) => $(id).textContent = 'Consultando...');
    try {
      // Proveedor externo: datos de ubicación aproximada derivados de la IP pública.
      const data = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`);
      if (data?.success === false) throw new Error('Servicio de geolocalización no disponible');
      const conn = data?.connection || {};
      $('isp-value').textContent = safeText(conn.isp);
      $('asn-value').textContent = [conn.org, conn.asn ? `AS${String(conn.asn).replace(/^AS/i, '')}` : null].filter(Boolean).join(' · ') || 'No disponible';
      $('country-value').textContent = safeText(data.country);
      $('region-value').textContent = [data.city, data.region].filter(Boolean).join(', ') || 'No disponible';
      $('timezone-value').textContent = safeText(data.timezone?.id);
    } catch (_) {
      ids.forEach((id) => $(id).textContent = 'No disponible');
    }
  }

  function readHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
      return Array.isArray(history) ? history.filter((x) => x && typeof x.date === 'number').slice(0, MAX_HISTORY) : [];
    } catch (_) { return []; }
  }

  function historyEnabled() {
    try { return localStorage.getItem(STORAGE_PREF) !== 'false'; }
    catch (_) { return false; }
  }

  function writeHistory(history) {
    try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history)); return true; }
    catch (_) { return false; }
  }

  function dateLabel(timestamp) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
  }

  function renderHistory() {
    const container = $('history-body');
    container.replaceChildren();
    const history = readHistory();
    if (!history.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'empty-state';
      td.textContent = 'No hay consultas registradas todavía.';
      tr.appendChild(td);container.appendChild(tr);
      return;
    }
    history.forEach((item) => {
      const tr = document.createElement('tr');
      [dateLabel(item.date), safeText(item.ipv4, '—'), safeText(item.ipv6, '—')].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
      container.appendChild(tr);
    });
  }

  function saveSnapshot() {
    if (!historyEnabled() || (!state.ipv4 && !state.ipv6)) return;
    const history = readHistory();
    // Evita entradas consecutivas duplicadas en consultas muy próximas.
    if (history[0]?.ipv4 === state.ipv4 && history[0]?.ipv6 === state.ipv6 && Date.now() - history[0].date < 60000) return;
    history.unshift({ date: Date.now(), ipv4: state.ipv4, ipv6: state.ipv6 });
    if (!writeHistory(history.slice(0, MAX_HISTORY))) notify('El navegador no permitió guardar el historial');
    renderHistory();
  }

  function notify(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  async function copyIp(ip) {
    if (!ip) return;
    try {
      await navigator.clipboard.writeText(ip);
      notify('Dirección IP copiada');
    } catch (_) {
      // Clipboard API puede no estar disponible en http:// o file://.
      const input = document.createElement('textarea');
      input.value = ip;
      input.style.position = 'fixed';input.style.opacity = '0';
      document.body.appendChild(input);input.select();
      const copied = document.execCommand('copy');
      input.remove();
      notify(copied ? 'Dirección IP copiada' : 'No se pudo copiar automáticamente');
    }
  }

  async function refresh() {
    if (state.busy) return;
    state.busy = true;
    state.ipv4 = null;state.ipv6 = null;
    $('refresh-button').disabled = true;
    $('refresh-button').classList.add('loading');
    $('refresh-label').textContent = 'Consultando...';
    $('last-check').textContent = 'Comprobando la conexión';
    $('ipv4-value').textContent = 'Consultando...';
    $('ipv6-value').textContent = 'Consultando...';
    $('ipv4-status').textContent = 'Detectando tu dirección';
    $('ipv6-status').textContent = 'Comprobando compatibilidad';
    $('copy-ipv4').disabled = true;$('copy-ipv6').disabled = true;
    setNetworkStatus();

    const [v4, v6] = await Promise.allSettled([
      getIp('https://api.ipify.org?format=json', isIpv4),
      getIp('https://api6.ipify.org?format=json', isIpv6)
    ]);
    state.ipv4 = v4.status === 'fulfilled' ? v4.value : null;
    state.ipv6 = v6.status === 'fulfilled' ? v6.value : null;
    setIp('ipv4', state.ipv4);
    setIp('ipv6', state.ipv6);
    if (state.ipv4 || state.ipv6) {
      $('lookup-notice').textContent = 'La IP pública puede cambiar si te conectas a otra red, utilizas datos móviles o activas una VPN.';
      await loadGeo(state.ipv4 || state.ipv6);
      saveSnapshot();
    } else {
      $('lookup-notice').textContent = 'No pudimos consultar las direcciones. Comprueba tu acceso a internet o si un bloqueador impide conectarse a los servicios externos y vuelve a intentarlo.';
      ['isp-value', 'asn-value', 'country-value', 'region-value', 'timezone-value'].forEach((id) => $(id).textContent = 'No disponible');
    }
    $('last-check').textContent = `Última consulta: ${new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
    $('refresh-button').disabled = false;
    $('refresh-button').classList.remove('loading');
    $('refresh-label').textContent = 'Actualizar información';
    state.busy = false;
  }

  function init() {
    $('copyright-year').textContent = String(new Date().getFullYear());
    $('save-history').checked = historyEnabled();
    $('save-history').addEventListener('change', (event) => {
      try { localStorage.setItem(STORAGE_PREF, String(event.target.checked)); }
      catch (_) { notify('No se pudo guardar esta preferencia'); }
      notify(event.target.checked ? 'Historial activado' : 'Historial desactivado');
    });
    $('clear-history').addEventListener('click', () => {
      if (!readHistory().length) { notify('El historial ya está vacío'); return; }
      if (!window.confirm('¿Borrar las consultas guardadas en este navegador?')) return;
      try { localStorage.removeItem(STORAGE_HISTORY); }
      catch (_) { notify('No se pudo borrar el historial'); return; }
      renderHistory();notify('Historial borrado');
    });
    $('copy-ipv4').addEventListener('click', () => copyIp(state.ipv4));
    $('copy-ipv6').addEventListener('click', () => copyIp(state.ipv6));
    $('refresh-button').addEventListener('click', refresh);
    window.addEventListener('online', setNetworkStatus);
    window.addEventListener('offline', setNetworkStatus);
    fillDevice();renderHistory();refresh();
  }
  init();
})();
