// ==UserScript==
// @name         GlassPad for GeForce NOW
// @namespace    gfn-touch-controls
// @version      1.7.1
// @description  Fully customizable on-screen controls for GeForce NOW in Safari: remappable controller, touch and keyboard controls.
// @match        https://play.geforcenow.com/*
// @run-at       document-start
// @inject-into  page
// @noframes
// @grant        none
// @updateURL    https://gist.githubusercontent.com/killshotttttt/d4bd9b1bc9ee3115c96c240e08b7fc82/raw/gfn-touch-controls.meta.js
// @downloadURL  https://gist.githubusercontent.com/killshotttttt/d4bd9b1bc9ee3115c96c240e08b7fc82/raw/gfn-touch-controls.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (window.__gfnTouchControls) return;
  window.__gfnTouchControls = true;

  /* ------------------------------------------------------------------ *
   * Constants
   * ------------------------------------------------------------------ */
  const VERSION = '1.7.1'; // kept in step with @version by release.sh
  const STORE_KEY = 'gfn-touch-controls:v1';
  const PAD_ID = 'Xbox 360 Controller (XInput STANDARD GAMEPAD)';
  // Standard Gamepad mapping (https://w3c.github.io/gamepad/#remapping)
  const BTN_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu',
    'L3', 'R3', 'Up', 'Down', 'Left', 'Right', 'Xbox'];
  const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const IS_IPHONE = /iPhone|iPod/.test(navigator.userAgent);
  const CAN_VIBRATE = typeof navigator.vibrate === 'function';
  const WASD = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

  /* ------------------------------------------------------------------ *
   * Keyboard tables. Controls store KeyboardEvent.code values (what GFN
   * reads); people type friendly names like "Shift + W".
   * ------------------------------------------------------------------ */
  const KEY_INFO = {};
  (() => {
    const add = (code, key, keyCode, name, loc) => { KEY_INFO[code] = { key, keyCode, name: name || key, loc: loc || 0 }; };
    for (let i = 0; i < 26; i++) { const ch = String.fromCharCode(65 + i); add(`Key${ch}`, ch.toLowerCase(), 65 + i, ch); }
    for (let i = 0; i < 10; i++) add(`Digit${i}`, String(i), 48 + i, String(i));
    for (let i = 1; i <= 12; i++) add(`F${i}`, `F${i}`, 111 + i);
    [['Space', ' ', 32, 'Space'], ['Enter', 'Enter', 13], ['Escape', 'Escape', 27, 'Esc'], ['Tab', 'Tab', 9],
      ['Backspace', 'Backspace', 8], ['CapsLock', 'CapsLock', 20, 'Caps'],
      ['ShiftLeft', 'Shift', 16, 'Shift', 1], ['ShiftRight', 'Shift', 16, 'RShift', 2],
      ['ControlLeft', 'Control', 17, 'Ctrl', 1], ['ControlRight', 'Control', 17, 'RCtrl', 2],
      ['AltLeft', 'Alt', 18, 'Alt', 1], ['AltRight', 'Alt', 18, 'RAlt', 2], ['MetaLeft', 'Meta', 91, 'Win', 1],
      ['ArrowUp', 'ArrowUp', 38, 'Up'], ['ArrowDown', 'ArrowDown', 40, 'Down'],
      ['ArrowLeft', 'ArrowLeft', 37, 'Left'], ['ArrowRight', 'ArrowRight', 39, 'Right'],
      ['Insert', 'Insert', 45], ['Delete', 'Delete', 46, 'Del'], ['Home', 'Home', 36], ['End', 'End', 35],
      ['PageUp', 'PageUp', 33, 'PgUp'], ['PageDown', 'PageDown', 34, 'PgDn'],
      ['Backquote', '`', 192], ['Minus', '-', 189], ['Equal', '=', 187], ['BracketLeft', '[', 219],
      ['BracketRight', ']', 221], ['Backslash', '\\', 220], ['Semicolon', ';', 186], ['Quote', "'", 222],
      ['Comma', ',', 188], ['Period', '.', 190], ['Slash', '/', 191]].forEach((a) => add(...a));
    for (let i = 0; i < 10; i++) add(`Numpad${i}`, String(i), 96 + i, `Num${i}`, 3);
  })();
  // Not real keys: handled by the mouse engine below.
  const PSEUDO_KEYS = { MouseLeft: 'LMB', MouseRight: 'RMB', WheelUp: 'WheelUp', WheelDown: 'WheelDown', MouseMode: 'MouseMode', Gyro: 'Gyro' };
  const KEY_ALIASES = {
    control: 'ControlLeft', escape: 'Escape', return: 'Enter', spacebar: 'Space', lshift: 'ShiftLeft', cmd: 'MetaLeft',
    leftclick: 'MouseLeft', click: 'MouseLeft', mouse1: 'MouseLeft', fire: 'MouseLeft',
    rightclick: 'MouseRight', mouse2: 'MouseRight', scrollup: 'WheelUp', scrolldown: 'WheelDown',
  };
  const KEY_CHOICES = ['MouseLeft', 'MouseRight', 'WheelUp', 'WheelDown', 'MouseMode', 'Gyro', 'Space', 'ShiftLeft',
    'ControlLeft', 'AltLeft', 'Tab', 'Escape', 'Enter', 'Backspace',
    ...Object.keys(KEY_INFO).filter((k) => /^(Key|Digit)/.test(k)),
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ...Object.keys(KEY_INFO).filter((k) => /^F\d/.test(k))];

  const keyName = (code) => PSEUDO_KEYS[code] || (KEY_INFO[code] ? KEY_INFO[code].name : code);
  const formatKeys = (codes) => (codes || []).map(keyName).join(' + ');
  function parseKey(token) {
    const t = token.trim();
    if (!t) return null;
    if (KEY_INFO[t] || PSEUDO_KEYS[t]) return t;
    const l = t.toLowerCase().replace(/\s+/g, '');
    if (KEY_ALIASES[l]) return KEY_ALIASES[l];
    for (const code in PSEUDO_KEYS) if (PSEUDO_KEYS[code].toLowerCase() === l) return code;
    for (const code in KEY_INFO) if (KEY_INFO[code].name.toLowerCase() === l) return code;
    return undefined;
  }
  function parseKeys(str, sep) {
    const codes = [];
    const bad = [];
    for (const tok of String(str).split(sep)) {
      const code = parseKey(tok);
      if (code) { if (!codes.includes(code)) codes.push(code); } else if (code === undefined) bad.push(tok.trim());
    }
    return { codes, bad };
  }

  /* ------------------------------------------------------------------ *
   * Settings / layouts (x, y = centre in % of viewport; size = % of the
   * viewport's short side, so layouts survive rotation and device changes)
   * ------------------------------------------------------------------ */
  const btn = (id, label, buttons, x, y, size, extra) =>
    Object.assign({ id, type: 'button', label, buttons, keys: [], x, y, size, shape: 'circle', toggle: false }, extra);
  const key = (id, label, keys, x, y, size, extra) => btn(id, label, [], x, y, size, Object.assign({ keys }, extra));

  function defaultControls() {
    return [
      { id: 'ls', type: 'stick', output: 'pad', axes: 'left', x: 14, y: 66, size: 30, zone: 1.5, mode: 'floating', sens: 1, deadzone: 0.1, invertY: false },
      { id: 'rs', type: 'stick', output: 'pad', axes: 'right', x: 68, y: 74, size: 26, zone: 1.3, mode: 'fixed', sens: 1, deadzone: 0.1, invertY: false },
      { id: 'dpad', type: 'dpad', x: 31, y: 84, size: 24 },
      btn('a', 'A', [0], 88, 78, 13, { color: '#7ee2a0' }),
      btn('b', 'B', [1], 95, 63, 13, { color: '#ff8f87' }),
      btn('x', 'X', [2], 81, 63, 13, { color: '#8cc4ff' }),
      btn('y', 'Y', [3], 88, 48, 13, { color: '#ffe08a' }),
      btn('lb', 'LB', [4], 8, 30, 12, { shape: 'pill' }),
      btn('rb', 'RB', [5], 92, 30, 12, { shape: 'pill' }),
      btn('lt', 'LT', [6], 8, 12, 12, { shape: 'pill' }),
      btn('rt', 'RT', [7], 92, 12, 12, { shape: 'pill' }),
      btn('view', '⧉', [8], 40, 10, 9),
      btn('menu', '☰', [9], 60, 10, 9),
      btn('l3', 'L3', [10], 28, 40, 9),
      btn('r3', 'R3', [11], 58, 52, 9),
    ];
  }

  // The controller layout with a swipe area for the camera in place of the right stick.
  function defaultTouchControls() {
    return [
      { id: 'look', type: 'touch', output: 'stick', x: 70, y: 58, w: 56, h: 80, sens: 1, invertY: false },
      ...defaultControls().filter((c) => c.id !== 'rs'),
    ];
  }

  // Shooter-style layout: WASD stick on the left, swipe-to-aim on the right.
  function defaultKbmControls() {
    return [
      { id: 'aim', type: 'touch', output: 'mouse', x: 72, y: 56, w: 54, h: 86, sens: 1.5, invertY: false, tapClick: true },
      { id: 'move', type: 'stick', output: 'keys', keys4: WASD.slice(), edgeKey: '', axes: 'left', x: 14, y: 66, size: 30, zone: 1.5, mode: 'floating', sens: 1, deadzone: 0.15, invertY: false },
      key('fire', 'Fire', ['MouseLeft'], 88, 74, 16, { color: '#ff8f87' }),
      key('ads', 'Aim', ['MouseRight'], 75, 84, 12),
      key('jump', 'Jump', ['Space'], 94, 52, 12),
      key('reload', 'R', ['KeyR'], 83, 52, 10),
      key('crouch', 'Ctrl', ['ControlLeft'], 63, 88, 10),
      key('use', 'E', ['KeyE'], 31, 42, 10),
      key('q', 'Q', ['KeyQ'], 21, 33, 9),
      key('sprint', '⇧', ['ShiftLeft'], 7, 36, 11),
      key('esc', 'Esc', ['Escape'], 6, 10, 8),
      key('k1', '1', ['Digit1'], 14, 10, 8),
      key('k2', '2', ['Digit2'], 21, 10, 8),
      key('k3', '3', ['Digit3'], 28, 10, 8),
      key('tab', 'Tab', ['Tab'], 60, 9, 8),
      key('mm', '🖱', ['MouseMode'], 50, 18, 8),
    ];
  }

  const CONTROLLER = 'Controller', TOUCH = 'Touch', KEYBOARD = 'Keyboard';
  const DEFAULT_LAYOUTS = { [CONTROLLER]: defaultControls, [TOUCH]: defaultTouchControls, [KEYBOARD]: defaultKbmControls };
  const defaultProfiles = () => {
    const p = {};
    for (const n in DEFAULT_LAYOUTS) p[n] = DEFAULT_LAYOUTS[n]();
    return p;
  };
  // 1.7 calls swipe areas "touch areas"; layouts saved or shared before then say "mouse".
  const upgradeControls = (list) => { for (const c of list) if (c.type === 'mouse') c.type = 'touch'; return list; };

  function defaultSettings() {
    return {
      show: true,
      opacity: 0.85,
      scale: 1,
      blur: true,
      hidden: false, // controls tucked away (eye button); the virtual pad stays connected
      gyroMode: 'off', // 'off' | 'always' | 'hold' (while aiming)
      gyroSens: 1,
      gyroInvX: false,
      gyroInvY: false,
      autoHide: true,
      haptics: true,
      spoofStandalone: IS_IOS,
      keepFs: true, // go back into fullscreen after Safari's swipe-down closes it
      gear: { x: 50, y: 5 },
      active: CONTROLLER,
      profiles: defaultProfiles(),
      layouts: 2, // version of the built-in profile set
    };
  }

  function loadSettings() {
    const def = defaultSettings();
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return def;
      const s = Object.assign(def, raw);
      if (!s.profiles || !Object.keys(s.profiles).length) s.profiles = defaultProfiles();
      // Before 1.7 the built-in profiles were "Default" and "Keyboard + Mouse"
      // (1.0 only had "Default"). Rename them and add the touch profile.
      if (!(raw.layouts >= 2)) {
        const renames = { Default: CONTROLLER, 'Keyboard + Mouse': KEYBOARD };
        const next = {};
        for (const [n, list] of Object.entries(s.profiles)) {
          const to = renames[n] && !s.profiles[renames[n]] ? renames[n] : n;
          next[to] = list;
          if (s.active === n) s.active = to;
          if (to === CONTROLLER && !s.profiles[TOUCH]) next[TOUCH] = defaultTouchControls();
        }
        if (!next[TOUCH]) next[TOUCH] = defaultTouchControls();
        if (!raw.kbmAdded && !next[KEYBOARD]) next[KEYBOARD] = defaultKbmControls();
        s.profiles = next;
        delete s.kbmAdded;
        s.layouts = 2;
      }
      if (!s.profiles[s.active]) s.active = Object.keys(s.profiles)[0];
      // 1.2 uses lighter label colours that read better on frosted glass.
      const softer = { '#3cb043': '#7ee2a0', '#e23b3b': '#ff8f87', '#2f7de1': '#8cc4ff', '#f2c12e': '#ffe08a' };
      for (const list of Object.values(s.profiles)) for (const c of upgradeControls(list)) if (softer[c.color]) c.color = softer[c.color];
      return s;
    } catch (_) {
      return def;
    }
  }

  let settings = loadSettings();
  let saveTimer = 0;
  function save(now) {
    clearTimeout(saveTimer);
    const write = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (_) { /* quota / private mode */ } };
    if (now) write(); else saveTimer = setTimeout(write, 250);
  }
  const controls = () => settings.profiles[settings.active];
  const findCtrl = (id) => controls().find((c) => c.id === id);
  const profileUsesMouse = () => controls().some((c) => (c.type === 'touch' && c.output !== 'stick') ||
    (c.type === 'stick' && c.output === 'mouse') ||
    (c.keys || []).some((k) => k === 'MouseLeft' || k === 'MouseRight'));

  /* ------------------------------------------------------------------ *
   * iOS: optionally pretend to be the Home Screen web app, in case GFN
   * refuses to stream from a normal Safari tab (extensions can't run in
   * Home Screen apps, so this is the only way to combine the two).
   * ------------------------------------------------------------------ */
  if (settings.spoofStandalone && IS_IOS) {
    try { Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true }); } catch (_) { /* ignore */ }
    const origMatchMedia = window.matchMedia;
    window.matchMedia = function matchMedia(query) {
      const q = String(query);
      const fake = /display-mode\s*:\s*standalone/.test(q) ? true : /display-mode\s*:\s*browser/.test(q) ? false : null;
      if (fake === null) return origMatchMedia.call(this, query);
      return {
        matches: fake, media: q, onchange: null,
        addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
        dispatchEvent() { return false; },
      };
    };
  }

  /* ------------------------------------------------------------------ *
   * Virtual gamepad
   * ------------------------------------------------------------------ */
  const pad = {
    pressCount: new Array(17).fill(0),
    axes: [0, 0, 0, 0],
    timestamp: performance.now(),
    slot: -1,
    connected: false,
    snap: null,
    polls: 0,
    lastPoll: 0,
    lastAnnounce: 0,
    gyro: [0, 0], // gyro's share of the right stick (gamepad layouts)
  };

  const GamepadProto = window.Gamepad ? window.Gamepad.prototype : Object.prototype;
  const ButtonProto = window.GamepadButton ? window.GamepadButton.prototype : Object.prototype;
  const actuator = {
    type: 'dual-rumble',
    effects: ['dual-rumble', 'trigger-rumble'],
    canPlayEffectType: (t) => t === 'dual-rumble',
    playEffect: () => Promise.resolve('complete'),
    reset: () => Promise.resolve('complete'),
  };
  const define = (obj, props) => {
    for (const k in props) Object.defineProperty(obj, k, { value: props[k], enumerable: true });
    return obj;
  };

  const btnValue = (i) => (pad.pressCount[i] > 0 ? 1 : 0);
  function touchPad() { pad.timestamp = performance.now(); pad.snap = null; }

  // Fresh snapshot per state change (Chrome-style), so pages that diff
  // the previous poll against the current one see changes.
  function snapshot() {
    if (pad.snap) return pad.snap;
    const buttons = [];
    for (let i = 0; i < 17; i++) {
      const v = btnValue(i);
      buttons.push(define(Object.create(ButtonProto), { pressed: v > 0, touched: v > 0, value: v }));
    }
    pad.snap = define(Object.create(GamepadProto), {
      id: PAD_ID,
      index: pad.slot,
      connected: pad.connected,
      mapping: 'standard',
      timestamp: pad.timestamp,
      axes: Object.freeze([pad.axes[0], pad.axes[1],
        Math.max(-1, Math.min(1, pad.axes[2] + pad.gyro[0])), Math.max(-1, Math.min(1, pad.axes[3] + pad.gyro[1]))]),
      buttons: Object.freeze(buttons),
      vibrationActuator: actuator,
      hapticActuators: [],
    });
    return pad.snap;
  }

  function pressButton(i, down) {
    pad.pressCount[i] = Math.max(0, pad.pressCount[i] + (down ? 1 : -1));
    touchPad();
  }
  function setAxes(which, x, y) {
    const o = which === 'right' ? 2 : 0;
    if (pad.axes[o] === x && pad.axes[o + 1] === y) return;
    pad.axes[o] = x;
    pad.axes[o + 1] = y;
    touchPad();
  }

  const origGetGamepads = Navigator.prototype.getGamepads;
  function realPads() {
    if (!origGetGamepads) return [];
    try { return Array.from(origGetGamepads.call(navigator) || []); } catch (_) { return []; }
  }

  function pickSlot(list) {
    if (pad.slot >= 0 && !list[pad.slot]) return;
    let slot = 0;
    while (list[slot]) slot++;
    if (slot !== pad.slot) { pad.slot = slot; pad.snap = null; }
  }

  Object.defineProperty(Navigator.prototype, 'getGamepads', {
    configurable: true, enumerable: true, writable: true,
    value: function getGamepads() {
      const list = realPads();
      const now = performance.now();
      // A long gap in polling means the stream (and GFN's mouse mode) restarted.
      if (pad.lastPoll && now - pad.lastPoll > 5000 && !mm.pulsing) mm.on = false;
      pad.polls++;
      pad.lastPoll = now;
      if (!pad.connected) return list;
      mouseTick(now);
      pickSlot(list);
      while (list.length < Math.max(4, pad.slot + 1)) list.push(null);
      list[pad.slot] = snapshot();
      return list;
    },
  });

  function fireGamepadEvent(type) {
    const ev = new Event(type);
    Object.defineProperty(ev, 'gamepad', { value: snapshot() });
    window.dispatchEvent(ev);
  }

  let realPresent = false;
  function scanRealPads() {
    realPresent = realPads().some((p) => p && p.connected !== false && p.id !== PAD_ID);
  }
  const wantConnected = () => settings.show && !(settings.autoHide && realPresent);

  function syncConnection(force) {
    const want = wantConnected();
    if (want === pad.connected && !force) return;
    if (pad.connected) {
      releaseEverything();
      pad.connected = false;
      pad.snap = null;
      mm.on = false;
      fireGamepadEvent('gamepaddisconnected');
    }
    if (want) {
      pickSlot(realPads());
      pad.connected = true;
      pad.snap = null;
      pad.lastAnnounce = performance.now();
      fireGamepadEvent('gamepadconnected');
    }
    updateVisibility();
  }

  // If the page loaded its gamepad code after we announced the pad and
  // isn't polling, re-announce on the first press.
  function maybeReannounce() {
    const now = performance.now();
    if (pad.connected && now - pad.lastPoll > 2000 && now - pad.lastAnnounce > 5000) {
      pad.lastAnnounce = now;
      fireGamepadEvent('gamepadconnected');
    }
  }

  window.addEventListener('gamepadconnected', (e) => { if (e.isTrusted) { scanRealPads(); syncConnection(); } });
  window.addEventListener('gamepaddisconnected', (e) => { if (e.isTrusted) { scanRealPads(); syncConnection(); } });

  /* ------------------------------------------------------------------ *
   * Keyboard. GFN's streamer listens for keydown/keyup on document and
   * reads event.code, so synthetic events are forwarded like real keys.
   * ------------------------------------------------------------------ */
  const keyCount = new Map();
  const isHeld = (code) => (keyCount.get(code) || 0) > 0;

  function sendKey(code, down) {
    const info = KEY_INFO[code];
    if (!info) return;
    const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', {
      key: info.key, code, keyCode: info.keyCode, which: info.keyCode, location: info.loc,
      bubbles: true, cancelable: true, composed: true, view: window,
      shiftKey: isHeld('ShiftLeft') || isHeld('ShiftRight'),
      ctrlKey: isHeld('ControlLeft') || isHeld('ControlRight'),
      altKey: isHeld('AltLeft') || isHeld('AltRight'),
      metaKey: isHeld('MetaLeft'),
    });
    for (const p of ['keyCode', 'which']) {
      if (ev[p] !== info.keyCode) { try { Object.defineProperty(ev, p, { get: () => info.keyCode }); } catch (_) { /* ignore */ } }
    }
    const ae = document.activeElement;
    const target = ae && ae !== ui.host && ae !== document.documentElement ? ae : (document.body || document);
    target.dispatchEvent(ev);
  }

  function sendWheel(dir) {
    const target = document.querySelector('video') || document.body;
    target.dispatchEvent(new WheelEvent('wheel', {
      deltaY: dir * 100, deltaMode: 0, bubbles: true, cancelable: true, composed: true,
      clientX: innerWidth / 2, clientY: innerHeight / 2,
    }));
  }

  /* ------------------------------------------------------------------ *
   * Mouse. On iOS GFN ignores DOM mouse clicks and only accepts relative
   * mouse movement under pointer lock, which Safari on iPhone doesn't
   * have. GFN's built-in controller-as-mouse mode (toggled by double-
   * pressing R3) works everywhere though: right stick moves the cursor,
   * A = left click, LT = right click. We drive that mode with the
   * virtual pad.
   * ------------------------------------------------------------------ */
  const mm = { on: false, pulsing: false };
  const mouseBtns = { MouseLeft: { btn: 0, n: 0, applied: false }, MouseRight: { btn: 6, n: 0, applied: false } };

  function syncMouseButtons() {
    for (const m of Object.values(mouseBtns)) {
      const want = m.n > 0 && !mm.pulsing;
      if (want !== m.applied) { m.applied = want; pressButton(m.btn, want); }
    }
  }

  function waitPolls(n, minMs) {
    const p0 = pad.polls;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const check = () => {
        const dt = performance.now() - t0;
        if ((pad.polls - p0 >= n && dt >= minMs) || dt > 250) resolve(); else setTimeout(check, 5);
      };
      check();
    });
  }

  // GFN toggles mouse mode when R3 alone is pressed twice within 500 ms.
  async function toggleMouseMode() {
    if (mm.pulsing || !pad.connected) return;
    mm.pulsing = true;
    syncMouseButtons();
    const t0 = performance.now();
    while (pad.pressCount.some((v) => v > 0) && performance.now() - t0 < 600) await waitPolls(1, 16);
    for (const down of [true, false, true, false]) {
      pressButton(11, down);
      await waitPolls(2, 40);
    }
    mm.on = !mm.on;
    runTickClock(mm.on); // keep it warm while mouse mode is on
    mm.pulsing = false;
    syncMouseButtons();
    refreshMouseModeUi();
  }
  function ensureMouseMode(want) { if (mm.on !== want) toggleMouseMode(); }

  // Swipe -> cursor. Finger movement is collected in px (the backlog) and
  // fed to GFN's mouse mode through the right stick. How GFN's mouse mode
  // behaves, every 8 ms tick:
  //   - speed = a*12/(4-3|a|) px, and it ignores |a| < 0.1 (so ~0.32 px/tick minimum)
  //   - it moves whole pixels and carries the remainder, but throws the
  //     remainder away whenever the stick centres or changes direction.
  // We keep a model of that so we know what actually reached the cursor.
  const HO_DZ = 0.1;
  const PULSE = 0.11; // just above the dead zone: ~0.36 px per tick
  const dzA = (a) => (Math.abs(a) < HO_DZ ? 0 : a);
  const hoSpeed = (a, mag) => (a * 12) / (4 - 3 * Math.min(1, mag));
  const mouse = { rx: 0, ry: 0, ux: 0, uy: 0, ax: 0, ay: 0, last: 0, pollDt: 16, touching: 0, writing: false, smooth: 0.35 };
  function mouseAdd(dx, dy) { mouse.rx += dx; mouse.ry += dy; }

  // GFN steps its mouse mode with setInterval(8 ms). On a busy page that
  // timer fires late (and late ticks are skipped, not caught up), so the
  // cursor would fall short. Measure the real period with an identical timer.
  const tickClock = { ms: 8, last: 0, id: 0 };
  function runTickClock(on) {
    if (on && !tickClock.id) {
      tickClock.last = 0;
      tickClock.id = setInterval(() => {
        const now = performance.now();
        if (tickClock.last) tickClock.ms = Math.min(40, Math.max(8, tickClock.ms * 0.9 + (now - tickClock.last) * 0.1));
        tickClock.last = now;
      }, 8);
    } else if (!on && tickClock.id) {
      clearInterval(tickClock.id);
      tickClock.id = 0;
    }
  }

  // Advance the model of GFN's accumulator by `ticks` with the current tilt.
  function advanceMouseModel(ticks) {
    const ax = dzA(mouse.ax), ay = dzA(mouse.ay);
    const mag = Math.hypot(ax, ay);
    mouse.ux += hoSpeed(ax, mag) * ticks;
    mouse.uy += hoSpeed(ay, mag) * ticks;
    const ix = Math.trunc(mouse.ux), iy = Math.trunc(mouse.uy);
    mouse.ux -= ix; mouse.uy -= iy;
    mouse.rx -= ix; mouse.ry -= iy;
  }

  function mouseTick(now) {
    const dt = now - mouse.last;
    if (dt < 2) return;
    mouse.last = now;
    if (dt < 250) {
      advanceMouseModel(dt / tickClock.ms);
      mouse.pollDt = mouse.pollDt * 0.8 + dt * 0.2;
    }
    const busy = mouse.touching > 0 || gyro.mouseActive || Math.abs(mouse.rx) >= 0.5 || Math.abs(mouse.ry) >= 0.5;
    if (!busy) {
      if (mouse.writing) {
        mouse.writing = false;
        mouse.rx = mouse.ry = mouse.ux = mouse.uy = mouse.ax = mouse.ay = 0;
        setAxes('right', 0, 0);
      }
      return;
    }
    mouse.writing = true;
    // Drain the backlog over a short window rather than by the next poll, so
    // cursor speed follows the finger smoothly instead of in bursts.
    runTickClock(true);
    const ticks = Math.max(mouse.pollDt * 1.5, 16 + mouse.smooth * 80) / tickClock.ms;
    // The part already sitting in GFN's remainder is on its way, so leave it
    // out; otherwise every whole-pixel step would make the speed wobble.
    const sx = (mouse.rx - mouse.ux) / ticks;
    const sy = (mouse.ry - mouse.uy) / ticks;
    const S = Math.hypot(sx, sy);
    const m = S ? Math.min(1, (4 * S) / (12 + 3 * S)) : 0;
    let ax = S ? (m * sx) / S : 0;
    let ay = S ? (m * sy) / S : 0;
    // Too slow for GFN to register: send short pulses that each land one
    // whole pixel, whenever at least half a pixel is waiting.
    const slow = (a, r) => (Math.abs(a) >= HO_DZ ? a : Math.abs(r) >= 0.5 ? PULSE * Math.sign(r) : 0);
    ax = slow(ax, mouse.rx);
    ay = slow(ay, mouse.ry);
    // GFN drops the remainder when an axis stops or reverses; mirror that.
    const mag = Math.hypot(dzA(ax), dzA(ay));
    if (Math.sign(mouse.ux) !== Math.sign(hoSpeed(dzA(ax), mag))) mouse.ux = 0;
    if (Math.sign(mouse.uy) !== Math.sign(hoSpeed(dzA(ay), mag))) mouse.uy = 0;
    mouse.ax = ax;
    mouse.ay = ay;
    setAxes('right', ax, ay);
  }

  /* ------------------------------------------------------------------ *
   * Keys + mouse buttons share one entry point
   * ------------------------------------------------------------------ */
  function holdKey(code, down) {
    if (!code || code === 'Gyro') return; // Gyro is counted in holdButton()
    if (code === 'MouseMode') { if (down) toggleMouseMode(); return; }
    if (code === 'WheelUp' || code === 'WheelDown') { if (down) sendWheel(code === 'WheelUp' ? -1 : 1); return; }
    const mb = mouseBtns[code];
    if (mb) {
      if (down) ensureMouseMode(true);
      mb.n = Math.max(0, mb.n + (down ? 1 : -1));
      syncMouseButtons();
      return;
    }
    const n = keyCount.get(code) || 0;
    const next = Math.max(0, n + (down ? 1 : -1));
    keyCount.set(code, next);
    if (n === 0 && next > 0) sendKey(code, true);
    else if (n > 0 && next === 0) sendKey(code, false);
  }

  function releaseAllKeys() {
    for (const [code, n] of keyCount) if (n > 0) sendKey(code, false);
    keyCount.clear();
    for (const m of Object.values(mouseBtns)) m.n = 0;
    syncMouseButtons();
  }

  /* ------------------------------------------------------------------ *
   * Gyro aim. devicemotion gives the rotation rate (deg/s) around the
   * device's own axes; we turn that into screen-space yaw/pitch:
   *   - yaw is measured around real-world "up" (from gravity), so turning
   *     your body works however far the phone is tilted back;
   *   - pitch is measured around the screen's horizontal axis.
   * Layouts that move the cursor feed it to the mouse engine (true gyro
   * aim); controller layouts add it to the right stick.
   * ------------------------------------------------------------------ */
  const NEEDS_MOTION_PERMISSION = !!(window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission === 'function');
  const gyro = {
    listening: false, granted: !NEEDS_MOTION_PERMISSION, asking: false, seen: false,
    hold: 0, last: 0, up: null, mouseActive: false,
    // Which rotationRate field is which device axis differs between browsers
    // (Safari on iPhone doesn't follow the spec), so it's detected live.
    map: IS_IOS ? 'safari' : 'spec', score: { spec: 0, safari: 0 }, samples: 0, prevG: null,
  };
  const AXIS_MAPS = { // -> rotation rate around device [x, y, z], deg/s
    spec: (r) => [r.beta || 0, r.gamma || 0, r.alpha || 0],
    safari: (r) => [r.alpha || 0, r.beta || 0, r.gamma || 0],
  };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  // Gravity is fixed in the world, so as the phone turns at rate w (device
  // frame) the gravity direction it reports must change by -w x g. Whichever
  // axis layout predicts the observed change best is the right one.
  function learnAxisLayout(r, gn, accel, dt) {
    if (gyro.prevG && dt > 0 && Math.abs(accel - 9.81) < 1.5) {
      const dg = gn.map((c, i) => (c - gyro.prevG[i]) / dt);
      if (Math.hypot(...dg) > 0.35) { // only while clearly rotating
        for (const k in AXIS_MAPS) {
          const w = AXIS_MAPS[k](r).map((d) => (d * Math.PI) / 180);
          const pred = cross(w, gn);
          gyro.score[k] += dg.reduce((s, c, i) => s + (c + pred[i]) ** 2, 0);
        }
        gyro.samples++;
        const other = gyro.map === 'spec' ? 'safari' : 'spec';
        if (gyro.samples >= 12 && gyro.score[other] < gyro.score[gyro.map] * 0.5) gyro.map = other;
        if (gyro.samples > 300) { gyro.samples = 150; gyro.score.spec /= 2; gyro.score.safari /= 2; }
      }
    }
    gyro.prevG = gn;
  }
  const GYRO_PX_PER_DEG = 10; // cursor px per degree at sensitivity 1
  const GYRO_STICK_FULL = 180; // deg/s for a full stick tilt at sensitivity 1
  const GYRO_STICK_MIN = 0.1; // jump past the game's stick dead zone

  function screenAngle() {
    if (typeof window.orientation === 'number') return (window.orientation + 360) % 360; // iOS
    return (screen.orientation && screen.orientation.angle) || 0;
  }
  // Screen "up" and "right" expressed in device axes (x, y, z) for each rotation.
  const SCREEN_AXES = {
    0: { up: [0, 1, 0], right: [1, 0, 0] },
    90: { up: [1, 0, 0], right: [0, -1, 0] },
    180: { up: [0, -1, 0], right: [-1, 0, 0] },
    270: { up: [-1, 0, 0], right: [0, 1, 0] },
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  const gyroWanted = () => settings.gyroMode === 'always' || (settings.gyroMode === 'hold' && gyro.hold > 0);
  const holdsGyro = (c) => (c.keys || []).some((k) => k === 'Gyro' || k === 'MouseRight') || (c.buttons || []).includes(6);

  function setGyroStick(x, y) {
    if (pad.gyro[0] === x && pad.gyro[1] === y) return;
    pad.gyro = [x, y];
    touchPad();
  }

  function onMotion(e) {
    const r = e.rotationRate;
    if (!r || r.alpha == null) return;
    gyro.seen = true;
    const now = performance.now();
    const dt = gyro.last ? Math.min(0.05, (now - gyro.last) / 1000) : 0;
    gyro.last = now;
    const axes = SCREEN_AXES[screenAngle()] || SCREEN_AXES[0];

    // Track gravity to know which way is really up. Platforms disagree on
    // the sign, so flip it to point the same way as the screen's top.
    const g = e.accelerationIncludingGravity;
    if (g && g.x != null) {
      let v = [g.x, g.y, g.z];
      const n = Math.hypot(...v);
      if (n > 1) {
        v = v.map((c) => c / n);
        learnAxisLayout(r, v, n, dt);
        if (dot(v, axes.up) < 0) v = v.map((c) => -c);
        gyro.up = gyro.up ? gyro.up.map((c, i) => c * 0.9 + v[i] * 0.1) : v;
      }
    }

    const active = pad.connected && !settings.hidden && !ui.edit && !ui.panelOpen && gyroWanted() && dt > 0;
    const toMouse = profileUsesMouse();
    gyro.mouseActive = active && toMouse;
    if (!active || toMouse) setGyroStick(0, 0);
    if (!active) return;

    const w = AXIS_MAPS[gyro.map](r); // rotation rate around device x, y, z
    const up = gyro.up ? (() => { const n = Math.hypot(...gyro.up); return gyro.up.map((c) => c / n); })() : axes.up;
    let yaw = dot(w, up); // + = turned left
    let pitch = dot(w, axes.right); // + = top tilted towards you (look up)
    // Soft dead zone: hand tremor (< ~2 deg/s) fades out instead of wobbling the aim.
    const soft = (v) => { const a = Math.abs(v); return a < 2 ? v * (a / 2) : v; };
    yaw = soft(yaw);
    pitch = soft(pitch);
    let dx = -yaw * (settings.gyroInvX ? -1 : 1);
    let dy = -pitch * (settings.gyroInvY ? -1 : 1);
    const sens = settings.gyroSens || 1;

    if (toMouse) {
      ensureMouseMode(true);
      mouseAdd(dx * dt * GYRO_PX_PER_DEG * sens, dy * dt * GYRO_PX_PER_DEG * sens);
    } else {
      dx = (dx / GYRO_STICK_FULL) * sens;
      dy = (dy / GYRO_STICK_FULL) * sens;
      const m = Math.hypot(dx, dy);
      if (m < 0.005) return setGyroStick(0, 0);
      const out = Math.min(1, GYRO_STICK_MIN + (1 - GYRO_STICK_MIN) * m) / m;
      setGyroStick(dx * out, dy * out);
    }
  }

  function startGyro() {
    if (gyro.listening) return;
    window.addEventListener('devicemotion', onMotion);
    gyro.listening = true;
  }
  function stopGyro() {
    window.removeEventListener('devicemotion', onMotion);
    gyro.listening = false;
    gyro.mouseActive = false;
    setGyroStick(0, 0);
  }

  // iOS only grants motion access from inside a tap.
  function requestGyro(fromUser) {
    if (settings.gyroMode === 'off') return stopGyro();
    if (gyro.granted) return startGyro();
    if (gyro.asking || !fromUser) return;
    gyro.asking = true;
    window.DeviceMotionEvent.requestPermission().then((res) => {
      gyro.granted = res === 'granted';
      if (gyro.granted) startGyro();
      else toast('Motion access was denied. Reload the page and tap Allow to use gyro aim.');
    }).catch(() => {}).finally(() => { gyro.asking = false; refreshGyroUi(); });
  }

  function gyroStatus() {
    if (settings.gyroMode === 'off') return 'Off';
    if (!window.DeviceMotionEvent) return 'No motion sensor on this device';
    if (!gyro.granted) return 'Needs motion access: tap Allow';
    if (!gyro.seen) return 'Waiting for motion data…';
    const layout = gyro.samples < 12 ? 'checking axes…' : `${gyro.map === 'safari' ? 'Safari' : 'standard'} axes`;
    return `On · ${profileUsesMouse() ? 'moves the cursor' : 'moves the right stick'} · ${layout}`;
  }
  function refreshGyroUi() {
    const s = ui.panel && ui.panel.querySelector('[data-gyro]');
    if (s) s.textContent = gyroStatus();
    const b = ui.panel && ui.panel.querySelector('[data-action="gyro-allow"]');
    if (b) b.style.display = settings.gyroMode !== 'off' && !gyro.granted ? '' : 'none';
  }

  /* ------------------------------------------------------------------ *
   * Input routing. Registered at document-start on window/capture, so it
   * runs before any GFN listener: touches on our overlay never reach the
   * stream, everything else passes through untouched.
   * ------------------------------------------------------------------ */
  const active = new Map(); // pointerId -> { move(ev), end(ev) }
  const ui = { host: null, root: null, layer: null, gear: null, panel: null, editBar: null, inspector: null,
    panelOpen: false, advOpen: false, profOpen: false, edit: false, selected: null };
  const els = new Map(); // control id -> element
  // want: the user turned fullscreen on with our button. lost: Safari closed it
  // anyway (on iPad a quick one-finger swipe down anywhere exits fullscreen, and
  // pages can't block that), so the next tap puts it back.
  const fs = { want: false, lost: false };

  const ROUTED_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel',
    'touchstart', 'touchmove', 'touchend', 'touchcancel',
    'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel',
    'gesturestart', 'gesturechange', 'gestureend', 'keydown', 'keyup', 'keypress'];

  function block(e, prevent) {
    e.stopImmediatePropagation();
    if (prevent && e.cancelable) e.preventDefault();
  }

  function route(e) {
    const fromOverlay = ui.host && e.target === ui.host;
    const onFsButton = () => { const t = e.composedPath()[0]; return !!(t && t.closest && t.closest('[data-gear="fs"]')); };
    // Safari only allows fullscreen from inside a touchend/click handler. After Safari
    // closed it on us, the first tap anywhere puts it back.
    if (e.type === 'touchend' && fs.lost && !fsElement() && !(fromOverlay && onFsButton())) {
      fs.lost = false;
      toggleFullscreen();
    }
    if (e.type === 'touchend' && fromOverlay && !ui.edit) {
      if (onFsButton()) toggleFullscreen();
      // After a reload iOS needs a fresh tap to grant motion access again.
      if (settings.gyroMode !== 'off' && !gyro.granted) requestGyro(true);
    }
    if (e.type.startsWith('pointer')) {
      const h = active.get(e.pointerId);
      if (h) {
        block(e, true);
        if (e.type === 'pointermove') h.move(e);
        else if (e.type === 'pointerup' || e.type === 'pointercancel') { active.delete(e.pointerId); h.end(e); }
        return;
      }
      if (!fromOverlay) return;
      const el = e.composedPath()[0];
      const ctrlEl = el && el.closest ? el.closest('[data-ctrl]') : null;
      if (e.type === 'pointerdown' && ctrlEl) {
        block(e, true);
        startControl(e, ctrlEl);
        return;
      }
      block(e, !!ctrlEl);
      return;
    }
    if (!fromOverlay) return;
    const el = e.composedPath()[0];
    const onCtrl = !!(el && el.closest && el.closest('[data-ctrl]'));
    if (e.type === 'click' && !onCtrl && el && el.closest) {
      const a = el.closest('[data-action]');
      if (a) doAction(a.dataset.action, a);
    }
    // Controls: swallow everything. Menus: stop GFN seeing it but keep the
    // browser's default behaviour (focus, sliders, scrolling, checkboxes).
    block(e, onCtrl);
  }
  for (const t of ROUTED_EVENTS) window.addEventListener(t, route, { capture: true, passive: false });

  function resetInput() {
    for (const h of active.values()) { try { h.end(); } catch (_) { /* ignore */ } }
    active.clear();
    for (let i = 0; i < 17; i++) if (!heldByLatch(i)) pad.pressCount[i] = 0;
    pad.axes.fill(0);
    mouse.touching = 0;
    mouse.rx = mouse.ry = 0;
    touchPad();
    for (const [id, el] of els) el.classList.toggle('down', latched.has(id));
  }

  /* ------------------------------------------------------------------ *
   * Control behaviour
   * ------------------------------------------------------------------ */
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const unit = () => (Math.min(innerWidth, innerHeight) / 100) * settings.scale;

  function haptic() {
    if (settings.haptics && CAN_VIBRATE) { try { navigator.vibrate(8); } catch (_) { /* ignore */ } }
  }

  function startControl(e, el) {
    const id = el.dataset.ctrl;
    if (id === '__gear') return startGear(e, el);
    const c = findCtrl(id);
    if (!c) return;
    if (ui.edit) return startDrag(e, c, el);
    maybeReannounce();
    if (c.type === 'button') startButton(e, c, el);
    else if (c.type === 'stick') startStick(e, c, el);
    else if (c.type === 'dpad') startDpad(e, c, el);
    else if (c.type === 'touch') startTouchArea(e, c, el);
  }

  const downCount = new Map();
  const latched = new Set(); // ids of toggle-mode buttons that are currently on
  const heldByLatch = (b) => [...latched].some((id) => { const c = findCtrl(id); return c && c.buttons.includes(b); });

  function holdButton(c, down) {
    if (holdsGyro(c)) gyro.hold = Math.max(0, gyro.hold + (down ? 1 : -1));
    for (const b of c.buttons) pressButton(b, down);
    for (const k of c.keys || []) holdKey(k, down);
    const n = Math.max(0, (downCount.get(c.id) || 0) + (down ? 1 : -1));
    downCount.set(c.id, n);
    const el = els.get(c.id);
    if (el) el.classList.toggle('down', n > 0);
    if (down) haptic();
  }

  function releaseLatched() {
    for (const id of latched) {
      const c = findCtrl(id);
      if (c) holdButton(c, false);
    }
    latched.clear();
  }

  function releaseEverything() {
    resetInput();
    releaseLatched();
    releaseAllKeys();
    gyro.hold = 0;
    setGyroStick(0, 0);
    pad.pressCount.fill(0);
    touchPad();
  }

  function controlAt(x, y) {
    const hit = ui.root.elementFromPoint(x, y);
    const el = hit && hit.closest ? hit.closest('[data-ctrl]') : null;
    return el ? findCtrl(el.dataset.ctrl) : null;
  }

  function startButton(e, c, el) {
    if (c.toggle) {
      const on = !latched.has(c.id);
      if (on) latched.add(c.id); else latched.delete(c.id);
      holdButton(c, on);
      el.classList.toggle('on', on);
      active.set(e.pointerId, { move() {}, end() {} });
      return;
    }
    let cur = c;
    holdButton(cur, true);
    active.set(e.pointerId, {
      // Slide your thumb from one button to another (e.g. A -> B) without lifting.
      move(ev) {
        const hit = controlAt(ev.clientX, ev.clientY);
        if (hit && hit !== cur && hit.type === 'button' && !hit.toggle) {
          holdButton(cur, false);
          cur = hit;
          holdButton(cur, true);
        }
      },
      end() { holdButton(cur, false); },
    });
  }

  function startStick(e, c, el) {
    const base = el.querySelector('.base');
    const knob = el.querySelector('.knob');
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const B = c.size * unit();
    const travel = B * 0.38;
    const sens = c.sens || 1;
    const dz = c.deadzone == null ? 0.1 : c.deadzone;
    const ySign = c.invertY ? -1 : 1;
    const out = c.output || 'pad';
    const keys4 = c.keys4 && c.keys4.length === 4 ? c.keys4 : WASD;
    let ox = cx;
    let oy = cy;
    if (c.mode === 'floating') { ox = e.clientX; oy = e.clientY; }
    base.style.transform = `translate(${ox - cx}px, ${oy - cy}px)`;
    const knobAt = (dx, dy) => { knob.style.transform = `translate(${ox - cx + dx}px, ${oy - cy + dy}px)`; };
    el.classList.add('down');
    if (out === 'mouse') ensureMouseMode(true);

    // Stick -> keys (e.g. WASD), 8-way, plus an optional key at the rim (sprint).
    const held = new Set();
    const setKeys = (want) => {
      for (const k of held) if (!want.has(k)) { held.delete(k); holdKey(k, false); }
      for (const k of want) if (!held.has(k)) { held.add(k); holdKey(k, true); }
    };
    const emit = (x, y) => {
      if (out !== 'keys') return setAxes(out === 'mouse' ? 'right' : c.axes, x, y);
      const m = Math.hypot(x, y);
      const want = new Set();
      if (m > 0.3) {
        const ux = x / m, uy = y / m, t = 0.38;
        if (uy < -t) want.add(keys4[0]);
        if (ux < -t) want.add(keys4[1]);
        if (uy > t) want.add(keys4[2]);
        if (ux > t) want.add(keys4[3]);
        if (c.edgeKey && m >= 0.95) want.add(c.edgeKey);
      }
      setKeys(want);
    };

    const output = (nx, ny) => {
      const m = Math.hypot(nx, ny);
      if (m <= dz) return emit(0, 0);
      const s = Math.min(1, ((m - dz) / (1 - dz)) * sens) / m;
      emit(clamp(nx * s, -1, 1), clamp(ny * s * ySign, -1, 1));
    };

    let move;
    let look = null;
    if (c.mode === 'touchpad') {
      look = swipeLook(e, sens, (x, y) => { emit(x, y * ySign); knobAt(x * travel, y * travel); });
      move = look.move;
    } else {
      move = (ev) => {
        let dx = ev.clientX - ox;
        let dy = ev.clientY - oy;
        const d = Math.hypot(dx, dy);
        if (d > travel) { dx *= travel / d; dy *= travel / d; }
        knobAt(dx, dy);
        output(dx / travel, dy / travel);
      };
      move(e);
    }

    active.set(e.pointerId, {
      move,
      end() {
        if (look) look.stop();
        emit(0, 0);
        base.style.transform = knob.style.transform = '';
        el.classList.remove('down');
      },
    });
  }

  // Swipe-to-look: finger speed -> stick deflection, springs back when you stop.
  function swipeLook(e, sens, emit) {
    let lx = e.clientX, ly = e.clientY, lt = e.timeStamp, ax = 0, ay = 0, decay = 0;
    return {
      move(ev) {
        const dt = Math.max(4, ev.timeStamp - lt);
        const k = sens * 1.6;
        ax = ax * 0.35 + clamp(((ev.clientX - lx) / dt) * k, -1, 1) * 0.65;
        ay = ay * 0.35 + clamp(((ev.clientY - ly) / dt) * k, -1, 1) * 0.65;
        lx = ev.clientX; ly = ev.clientY; lt = ev.timeStamp;
        emit(ax, ay);
        clearTimeout(decay);
        decay = setTimeout(() => { ax = ay = 0; emit(0, 0); }, 60);
      },
      stop() { clearTimeout(decay); },
    };
  }

  function startDpad(e, c, el) {
    const arms = { 12: el.querySelector('.up'), 13: el.querySelector('.dn'), 14: el.querySelector('.lf'), 15: el.querySelector('.rt') };
    const keys = c.keys4 && c.keys4.length === 4 ? c.keys4 : null;
    const keyFor = { 12: 0, 14: 1, 13: 2, 15: 3 };
    const send = (b, down) => (keys ? holdKey(keys[keyFor[b]], down) : pressButton(b, down));
    const held = new Set();
    const update = (ev) => {
      const r = el.getBoundingClientRect();
      const dx = ev.clientX - (r.left + r.width / 2);
      const dy = ev.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      const want = new Set();
      if (d > r.width * 0.1) {
        const nx = dx / d, ny = dy / d, t = 0.38; // sin(22.5°) => 8 equal sectors
        if (ny < -t) want.add(12);
        if (ny > t) want.add(13);
        if (nx < -t) want.add(14);
        if (nx > t) want.add(15);
      }
      for (const b of held) if (!want.has(b)) { held.delete(b); send(b, false); arms[b].classList.remove('down'); }
      for (const b of want) if (!held.has(b)) { held.add(b); send(b, true); arms[b].classList.add('down'); haptic(); }
    };
    update(e);
    active.set(e.pointerId, {
      move: update,
      end() { for (const b of held) { send(b, false); arms[b].classList.remove('down'); } held.clear(); },
    });
  }

  // Touch area: swipe to move the cursor (output 'mouse') or the right stick ('stick').
  function startTouchArea(e, c, el) {
    if (c.output === 'stick') return startTouchLook(e, c, el);
    ensureMouseMode(true);
    mouse.touching++;
    el.classList.add('down');
    const gain = c.sens || 1.5;
    mouse.smooth = c.smooth == null ? 0.35 : c.smooth;
    const ys = c.invertY ? -1 : 1;
    const t0 = e.timeStamp;
    let lx = e.clientX, ly = e.clientY, moved = 0;
    active.set(e.pointerId, {
      move(ev) {
        const dx = ev.clientX - lx, dy = ev.clientY - ly;
        lx = ev.clientX; ly = ev.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        mouseAdd(dx * gain, dy * gain * ys);
      },
      end(ev) {
        mouse.touching = Math.max(0, mouse.touching - 1);
        if (!mouse.touching) el.classList.remove('down');
        if (c.tapClick && ev && moved < 12 && ev.timeStamp - t0 < 250) {
          holdKey('MouseLeft', true);
          setTimeout(() => holdKey('MouseLeft', false), 70);
        }
      },
    });
  }

  function startTouchLook(e, c, el) {
    el.classList.add('down');
    const ys = c.invertY ? -1 : 1;
    const look = swipeLook(e, c.sens || 1, (x, y) => setAxes('right', x, y * ys));
    active.set(e.pointerId, {
      move: look.move,
      end() { look.stop(); setAxes('right', 0, 0); el.classList.remove('down'); },
    });
  }

  function startDrag(e, target, el, isGear) {
    if (!isGear) select(target.id);
    const sx = e.clientX, sy = e.clientY, x0 = target.x, y0 = target.y;
    let moved = false;
    active.set(e.pointerId, {
      move(ev) {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 6) return;
        moved = true;
        target.x = Math.round(clamp(x0 + (dx / innerWidth) * 100, 0, 100) * 2) / 2;
        target.y = Math.round(clamp(y0 + (dy / innerHeight) * 100, 0, 100) * 2) / 2;
        place(el, target, el.offsetWidth, el.offsetHeight);
      },
      end() {
        if (!moved) return;
        save();
        if (!isGear) positionInspector();
      },
    });
  }

  function startGear(e, el) {
    if (ui.edit) return startDrag(e, settings.gear, el, true);
    const t = e.composedPath()[0];
    const part = t && t.closest && t.closest('[data-gear]') ? t.closest('[data-gear]').dataset.gear : 'menu';
    active.set(e.pointerId, {
      move() {},
      end(ev) {
        if (part === 'menu') togglePanel();
        else if (part === 'vis') setHidden(!settings.hidden);
        else if (ev && ev.pointerType !== 'touch') toggleFullscreen(); // touch is handled on touchend in route()
      },
    });
  }

  /* ---------- fullscreen ---------- */
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;

  function toggleFullscreen() {
    if (fs.lost && !fsElement()) {
      // Tapping the button while we're waiting to go back means "stay out".
      fs.want = fs.lost = false;
      toast('Fullscreen off.');
      return;
    }
    try {
      if (fsElement()) {
        fs.want = false;
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        return;
      }
      fs.want = true;
      const el = document.documentElement;
      const enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
      if (!enabled || !(el.requestFullscreen || el.webkitRequestFullscreen)) {
        toast(IS_IPHONE
          ? 'iPhone Safari can\'t make websites fullscreen. Turn to landscape and tap ᴀA → Hide Toolbar.'
          : 'Fullscreen isn\'t available in this browser.');
        return;
      }
      const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
      if (r && r.catch) r.catch(() => toast('Fullscreen was blocked, tap again.'));
    } catch (_) {
      toast('Fullscreen was blocked, tap again.');
    }
  }

  function onFullscreenChange() {
    if (fsElement()) {
      fs.lost = false;
      if (ui.toast && ui.toast.dataset.kind === 'fs-lost') ui.toast.style.display = 'none';
    } else if (fs.want && settings.keepFs) {
      fs.lost = true;
      toast('Safari closed fullscreen. Tap anywhere to go back, or tap the fullscreen button to stay out.', 'fs-lost');
    } else fs.want = false;
    setTimeout(mount, 50);
    renderGear();
    if (ui.panelOpen) renderPanel();
  }

  let toastTimer = 0;
  function toast(msg, kind = '') {
    if (!ui.toast) return;
    ui.toast.textContent = msg;
    ui.toast.dataset.kind = kind;
    ui.toast.style.display = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { ui.toast.style.display = 'none'; }, 4000);
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent; -webkit-font-smoothing: antialiased;
        font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
    svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    /* ---- controls: frosted glass ---- */
    .layer { position: fixed; inset: 0; pointer-events: none; }
    .ctrl { position: absolute; pointer-events: auto; touch-action: none; display: flex;
            align-items: center; justify-content: center; color: rgba(255,255,255,.92); font-weight: 600; }
    .btn, .stick .base, .stick .knob, .dpad .arm, .gear {
      background: rgba(255,255,255,.10);
      border: 1px solid rgba(255,255,255,.26);
      box-shadow: 0 6px 18px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.18);
      -webkit-backdrop-filter: blur(12px) saturate(160%); backdrop-filter: blur(12px) saturate(160%);
    }
    :host(.noblur) .btn, :host(.noblur) .stick .base, :host(.noblur) .stick .knob,
    :host(.noblur) .dpad .arm, :host(.noblur) .gear {
      -webkit-backdrop-filter: none; backdrop-filter: none; background: rgba(22,22,26,.42);
    }
    .btn { border-radius: 50%; letter-spacing: .02em; text-shadow: 0 1px 3px rgba(0,0,0,.35);
           transition: transform .08s ease, background .08s ease; white-space: nowrap; }
    .btn.pill { border-radius: 999px; }
    .btn.square { border-radius: 26%; }
    .btn.down { background: rgba(255,255,255,.34); border-color: rgba(255,255,255,.6); transform: scale(.93); }
    .btn.on { background: rgba(255,255,255,.26); border-color: rgba(255,255,255,.85);
              box-shadow: 0 0 0 1px rgba(255,255,255,.5), 0 0 18px rgba(255,255,255,.28); }
    .stick .base, .stick .knob { position: absolute; left: 50%; top: 50%; border-radius: 50%; pointer-events: none; }
    .stick .base { background: rgba(255,255,255,.06); }
    .stick .knob { background: rgba(255,255,255,.42); border-color: rgba(255,255,255,.55); }
    .stick.down .knob { background: rgba(255,255,255,.75); }
    .dpad .arm { position: absolute; display: flex; align-items: center; justify-content: center;
                 border-radius: 30%; pointer-events: none; }
    .dpad .arm svg { width: 46%; height: 46%; }
    .dpad .arm.down { background: rgba(255,255,255,.34); border-color: rgba(255,255,255,.6); }
    .touch { border: 1px dashed rgba(255,255,255,.14); border-radius: 24px; color: rgba(255,255,255,.3);
             font-size: 12px; font-weight: 500; letter-spacing: .03em; align-items: flex-end; padding-bottom: 12px; }
    .touch.down { background: rgba(255,255,255,.03); }
    .gear { border-radius: 999px; opacity: .8; padding: 0 4px; }
    .gear span { flex: 1; height: 100%; display: flex; align-items: center; justify-content: center; padding: 8px 0; }
    .gear i { width: 1px; height: 16px; background: rgba(255,255,255,.25); }
    .gear.dimmed { opacity: .5; }
    .gear.dimmed [data-gear="vis"] { color: #fff; }
    .gear.editing-gear { outline: 1.5px dashed rgba(255,255,255,.55); outline-offset: 3px; }
    .editing .ctrl { outline: 1.5px dashed rgba(255,255,255,.55); outline-offset: 3px; }
    .editing .stick { background: rgba(255,255,255,.04); border-radius: 50%; }
    .editing .ctrl.sel { outline: 2px solid #fff; }

    /* ---- panels: glass sheets ---- */
    .ui { position: fixed; pointer-events: auto; touch-action: manipulation; color: rgba(255,255,255,.92);
          font-size: 14px; background: rgba(28,28,34,.58); border: 1px solid rgba(255,255,255,.14); border-radius: 22px;
          box-shadow: 0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08);
          -webkit-backdrop-filter: blur(30px) saturate(180%); backdrop-filter: blur(30px) saturate(180%); }
    :host(.noblur) .ui { -webkit-backdrop-filter: none; backdrop-filter: none; background: rgba(24,24,28,.94); }
    .ui input[type=text], .ui textarea, .ui select { -webkit-user-select: text; user-select: text; }
    .panel { left: 50%; top: 50%; transform: translate(-50%,-50%); width: min(400px, 92vw);
             max-height: 88vh; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 16px; }
    .editbar { left: 50%; top: max(8px, env(safe-area-inset-top)); transform: translateX(-50%); padding: 5px;
               display: flex; gap: 2px; width: max-content; max-width: 96vw; border-radius: 999px; overflow-x: auto; }
    .editbar button { padding: 7px 12px; font-size: 13px; white-space: nowrap; background: transparent; border-color: transparent; }
    .editbar button.primary { background: rgba(255,255,255,.92); }
    .inspector { overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 14px; }
    /* still scrollable, just without a visible scrollbar */
    .panel, .inspector, .editbar { scrollbar-width: none; }
    .panel::-webkit-scrollbar, .inspector::-webkit-scrollbar, .editbar::-webkit-scrollbar { display: none; }
    .toast { left: 50%; top: max(52px, env(safe-area-inset-top)); transform: translateX(-50%); padding: 10px 16px;
             width: max-content; max-width: 90vw; font-size: 13px; text-align: center; border-radius: 16px; }

    .hd { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;
          font-size: 17px; font-weight: 600; }
    .muted { color: rgba(255,255,255,.5); font-size: 12px; font-weight: 400; line-height: 1.45; }
    .status { display: flex; align-items: center; gap: 7px; font-size: 12px; color: rgba(255,255,255,.55); margin: 2px 0 12px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.3); flex: none; }
    .dot.ok { background: #34c759; box-shadow: 0 0 8px rgba(52,199,89,.8); }
    .sec { margin: 16px 6px 6px; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
           color: rgba(255,255,255,.42); }
    .group { background: rgba(255,255,255,.06); border-radius: 14px; padding: 0 12px; }
    .group > .row + .row { border-top: 1px solid rgba(255,255,255,.07); }
    .group > .muted, .group > .chips { padding: 8px 0 10px; }
    .row { display: flex; align-items: center; gap: 10px; justify-content: space-between; min-height: 44px; }
    .row > span { flex: 1; }
    .row output { min-width: 34px; text-align: right; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.55); font-size: 13px; }
    .row output.wide { flex: 1; text-align: left; font-size: 12px; }
    .row select, .row input[type=text] { flex: 1.4; min-width: 0; }
    select, input[type=text], textarea { background-color: rgba(255,255,255,.08); color: inherit; border: 1px solid rgba(255,255,255,.12);
             border-radius: 10px; padding: 7px 10px; font-size: 16px; outline: none; -webkit-appearance: none; appearance: none; }
    select { background-image: linear-gradient(45deg, transparent 50%, rgba(255,255,255,.6) 50%), linear-gradient(135deg, rgba(255,255,255,.6) 50%, transparent 50%);
             background-position: calc(100% - 16px) 50%, calc(100% - 11px) 50%; background-size: 5px 5px; background-repeat: no-repeat; padding-right: 28px; }
    select option { color: #fff; background: #26262c; }
    textarea { width: 100%; height: 64px; font: 12px ui-monospace, Menlo, monospace; margin-top: 10px; }
    input[type=range] { flex: 1.4; -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px;
                        background: rgba(255,255,255,.2); outline: none; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%;
                        background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
    input[type=checkbox] { -webkit-appearance: none; appearance: none; position: relative; flex: none; width: 46px; height: 28px;
                           border-radius: 14px; background: rgba(255,255,255,.18); transition: background .2s; margin: 0; }
    input[type=checkbox]::before { content: ""; position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 50%;
                           background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,.3); transition: transform .2s; }
    input[type=checkbox]:checked { background: #34c759; }
    input[type=checkbox]:checked::before { transform: translateX(18px); }
    input[type=color] { width: 34px; height: 34px; border: none; border-radius: 50%; background: none; padding: 0; overflow: hidden; }
    .btns { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .btns.tight { margin: 0 0 4px; }
    .btns > .grow { flex: 1; }
    button { background: rgba(255,255,255,.1); color: inherit; border: 1px solid rgba(255,255,255,.14); border-radius: 999px;
             padding: 8px 14px; font: 600 13px -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
    button.primary { background: rgba(255,255,255,.92); border-color: transparent; color: #111; }
    button.danger { color: #ff6961; }
    button.x { width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
               font-size: 13px; flex: none; }
    .chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 6px; }
    .chip { padding: 6px 2px; font-size: 12px; }
    .chip.on { background: #fff; border-color: #fff; color: #111; }

    /* ---- compact settings panel ---- */
    .panel { padding: 14px 14px 12px; }
    .panel .hd { margin-bottom: 0; }
    .hd .title { display: flex; align-items: center; gap: 8px; }
    .hd .ver { font-size: 11px; font-weight: 500; color: rgba(255,255,255,.45); padding: 2px 7px; border-radius: 999px;
               background: rgba(255,255,255,.08); font-variant-numeric: tabular-nums; }
    .panel .status { margin: 0 0 10px; }
    .panel .sec { margin: 12px 6px 5px; }
    .panel .row { min-height: 40px; gap: 8px; }
    .panel .group > .muted { padding: 0 0 9px; }
    button.sm { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; font-size: 12px; flex: none; }
    button.sm svg { width: 14px; height: 14px; }
    button.ib svg { width: 15px; height: 15px; }
    button.ib.danger { color: #ff6961; }
    .picks { display: flex; gap: 6px; }
    .pick { padding: 6px 11px; font-size: 12px; font-weight: 600; border-radius: 999px; background: rgba(255,255,255,.1);
            border: 1px solid rgba(255,255,255,.14); }
    .pick.on { background: #fff; border-color: #fff; color: #111; }
    .pick input { display: none; }
    .io { padding: 2px 0 10px; }
    .io textarea { margin: 6px 0 8px; }
    button.more { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; margin: 10px 0 6px;
                  background: transparent; border-color: transparent; color: rgba(255,255,255,.55); font-size: 12px; }
    .chev { width: 14px; height: 14px; display: inline-flex; transition: transform .2s; }
    .chev.up { transform: rotate(180deg); }
    .ui { color-scheme: dark; }
    button.dd { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px;
                padding: 7px 10px 7px 14px; border-radius: 12px; font-size: 15px; background: rgba(255,255,255,.08);
                border-color: rgba(255,255,255,.12); }
    button.dd > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .panel .row.pad { padding: 8px 0; }
    .opts { display: flex; flex-direction: column; gap: 2px; padding: 0 0 8px; }
    .group > .opts + .row { border-top: 1px solid rgba(255,255,255,.07); }
    button.opt { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-radius: 10px;
                 background: transparent; border-color: transparent; font-weight: 500; font-size: 14px; text-align: left; }
    button.opt.on { background: rgba(255,255,255,.12); font-weight: 600; }
    button.opt svg { width: 16px; height: 16px; flex: none; color: #34c759; }
    .seg { flex: 1; display: flex; padding: 3px; gap: 3px; border-radius: 12px; background: rgba(0,0,0,.2); }
    .seg button { flex: 1; padding: 7px 4px; border-radius: 9px; background: transparent; border-color: transparent;
                  font-size: 13px; color: rgba(255,255,255,.7); white-space: nowrap; }
    .seg button.on { background: rgba(255,255,255,.9); color: #111; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
  `;

  function place(el, pos, w, h) {
    el.style.left = `${(pos.x / 100) * innerWidth - w / 2}px`;
    el.style.top = `${(pos.y / 100) * innerHeight - h / 2}px`;
  }

  const touchHint = (c) => (c.output === 'stick' ? 'swipe to look' : 'swipe to aim');

  function buildControl(c) {
    const el = document.createElement('div');
    el.className = `ctrl ${c.type}`;
    el.dataset.ctrl = c.id;
    if (ui.selected === c.id) el.classList.add('sel');
    el.style.opacity = c.opacity || settings.opacity;
    const S = c.size * unit();
    let w = S, h = S;

    if (c.type === 'button') {
      el.classList.add('btn', c.shape || 'circle');
      if (c.shape === 'pill') w = S * 1.6;
      el.textContent = c.label || '';
      el.style.fontSize = `${Math.max(10, S * ((c.label || '').length > 3 ? 0.26 : 0.36))}px`;
      if (c.color) el.style.color = c.color;
      if (latched.has(c.id) || ((c.keys || []).includes('MouseMode') && mm.on)) el.classList.add('on');
    } else if (c.type === 'stick') {
      w = h = S * (c.zone || 1);
      const base = document.createElement('div');
      base.className = 'base';
      Object.assign(base.style, { width: `${S}px`, height: `${S}px`, margin: `${-S / 2}px 0 0 ${-S / 2}px` });
      const k = S * 0.45;
      const knob = document.createElement('div');
      knob.className = 'knob';
      Object.assign(knob.style, { width: `${k}px`, height: `${k}px`, margin: `${-k / 2}px 0 0 ${-k / 2}px` });
      el.append(base, knob);
    } else if (c.type === 'dpad') {
      const t = S / 3;
      const g = 1; // gap between arms
      for (const [cls, rot, x, y] of [['up', 0, t, 0], ['dn', 180, t, 2 * t], ['lf', 270, 0, t], ['rt', 90, 2 * t, t]]) {
        const a = document.createElement('div');
        a.className = `arm ${cls}`;
        a.innerHTML = ICONS.chevron;
        a.firstChild.style.transform = `rotate(${rot}deg)`;
        Object.assign(a.style, { left: `${x + g}px`, top: `${y + g}px`, width: `${t - 2 * g}px`, height: `${t - 2 * g}px` });
        el.appendChild(a);
      }
    } else if (c.type === 'touch') {
      w = (c.w / 100) * innerWidth;
      h = (c.h / 100) * innerHeight;
      el.textContent = c.label || touchHint(c);
    }
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    place(el, c, w, h);
    return el;
  }

  function renderControls() {
    if (!ui.layer) return;
    ui.layer.textContent = '';
    els.clear();
    downCount.clear();
    // Touch areas go underneath, so buttons placed on top of them still work.
    const list = controls().slice().sort((a, b) => (b.type === 'touch') - (a.type === 'touch'));
    for (const c of list) {
      const el = buildControl(c);
      ui.layer.appendChild(el);
      els.set(c.id, el);
    }
    ui.layer.classList.toggle('editing', ui.edit);
    renderGear();
    updateVisibility();
  }

  function refreshMouseModeUi() {
    for (const c of controls()) {
      if ((c.keys || []).includes('MouseMode') && els.get(c.id)) els.get(c.id).classList.toggle('on', mm.on);
    }
    const s = ui.panel && ui.panel.querySelector('[data-mm]');
    if (s) s.textContent = mm.on ? 'on' : 'off';
  }

  const ICONS = {
    fsEnter: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    fsExit: '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24"><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    pencil: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    paste: '<svg viewBox="0 0 24 24"><path d="M9 4h6v3H9zM15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };

  function renderGear() {
    if (!ui.gear) return;
    const w = 112, h = 34;
    ui.gear.innerHTML = `<span data-gear="fs">${fsElement() ? ICONS.fsExit : ICONS.fsEnter}</span><i></i>` +
      `<span data-gear="vis">${settings.hidden ? ICONS.eyeOff : ICONS.eye}</span><i></i>` +
      `<span data-gear="menu">${ICONS.menu}</span>`;
    Object.assign(ui.gear.style, { width: `${w}px`, height: `${h}px` });
    place(ui.gear, settings.gear, w, h);
  }

  // Eye button: tuck the controls away to tap GFN's own UI, without
  // disconnecting the virtual pad (so mouse mode etc. stay as they are).
  function setHidden(hidden) {
    if (hidden === settings.hidden) return;
    settings.hidden = hidden;
    if (hidden) { releaseLatched(); resetInput(); }
    save();
    renderGear();
    updateVisibility();
  }

  function updateVisibility() {
    if (!ui.layer) return;
    ui.layer.style.display = ui.edit || (pad.connected && !settings.hidden) ? '' : 'none';
    ui.gear.classList.toggle('dimmed', settings.hidden && !ui.edit);
    ui.root.host.classList.toggle('noblur', !settings.blur);
    ui.gear.classList.toggle('editing-gear', ui.edit);
  }

  /* ---------- menu panel ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

  function status() {
    const real = realPads().filter((p) => p && p.id !== PAD_ID).length;
    const polling = performance.now() - pad.lastPoll < 3000;
    const text = !pad.connected ? 'Virtual controller off'
      : polling ? 'Connected · GeForce NOW is reading input' : 'Connected · waiting for GeForce NOW';
    return { ok: pad.connected && polling, text: real ? `${text} · ${real} real controller${real > 1 ? 's' : ''}` : text };
  }
  const toggleRow = (label, key, invert) =>
    `<label class="row"><span>${label}</span><input type="checkbox" data-set="${key}"${invert ? ' data-invert="1"' : ''}${!settings[key] === !!invert ? ' checked' : ''}></label>`;
  const sliderRow = (label, key, min, max, step) =>
    `<div class="row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}" data-set="${key}"><output data-out="${key}">${settings[key]}</output></div>`;

  function renderPanel() {
    const profiles = Object.keys(settings.profiles)
      .map((n) => `<button class="opt${n === settings.active ? ' on' : ''}" data-action="profile-pick" data-name="${esc(n)}"><span>${esc(n)}</span>${n === settings.active ? ICONS.check : ''}</button>`).join('');
    const gyroOn = settings.gyroMode !== 'off';
    const chip = (label, key) => `<label class="pick${settings[key] ? ' on' : ''}"><input type="checkbox" data-set="${key}"${settings[key] ? ' checked' : ''}>${label}</label>`;
    const ib = (action, icon, title, cls = '') => `<button class="x ib ${cls}" data-action="${action}" aria-label="${title}" title="${title}">${ICONS[icon]}</button>`;
    ui.panel.innerHTML = `
      <div class="hd"><span class="title">GlassPad <span class="ver">v${VERSION}</span><span class="dot${status().ok ? ' ok' : ''}" data-dot></span></span><button class="x" data-action="close">✕</button></div>
      <div class="status" data-status>${esc(status().text)}</div>
      <div class="btns tight">
        <button class="primary grow" data-action="edit">Edit layout</button>
        <button class="grow" data-action="fullscreen">${fsElement() ? 'Exit fullscreen' : 'Fullscreen'}</button>
      </div>

      <div class="sec">Layout</div>
      <div class="group">
        <div class="row pad"><button class="dd" data-action="profile-list" aria-expanded="${!!ui.profOpen}"><span>${esc(settings.active)}</span><span class="chev${ui.profOpen ? ' up' : ''}">${ICONS.chevronDown}</span></button>
          ${ib('profile-new', 'plus', 'New profile')}${ib('profile-rename', 'pencil', 'Rename profile')}${ib('profile-delete', 'trash', 'Delete profile', 'danger')}</div>
        ${ui.profOpen ? `<div class="opts">${profiles}</div>` : ''}
        <div class="row"><span>Share</span>
          <button class="sm" data-action="export">${ICONS.copy}Copy</button><button class="sm" data-action="import">${ICONS.paste}Paste</button>
          ${ib('export-file', 'save', 'Save as file')}${ib('import-file', 'open', 'Open a file')}</div>
        <div class="io" data-io-wrap style="display:none">
          <div class="muted" data-io-hint></div>
          <textarea data-io></textarea>
          <div class="btns tight"><button class="primary grow" data-action="import-text" data-io-go>Import</button><button class="grow" data-action="io-close">Close</button></div>
        </div>
        <input type="file" accept=".json,application/json,text/plain" data-file hidden>
      </div>

      <div class="sec">Look</div>
      <div class="group">
        ${toggleRow('Show controls', 'hidden', true)}
        ${sliderRow('Opacity', 'opacity', 0.1, 1, 0.05)}
        ${sliderRow('Size', 'scale', 0.5, 1.8, 0.05)}
        ${toggleRow('Frosted glass', 'blur')}
      </div>

      <div class="sec">Gyro aim</div>
      <div class="group">
        <div class="row pad"><div class="seg">${[['off', 'Off'], ['always', 'Always'], ['hold', 'While aiming']]
          .map(([v, n]) => `<button class="${settings.gyroMode === v ? 'on' : ''}" data-action="gyro-mode" data-v="${v}">${n}</button>`).join('')}</div></div>
        ${settings.gyroMode === 'hold' ? '<div class="muted">On while you hold Aim, LT or a button with the <b>Gyro</b> key.</div>' : ''}
        ${gyroOn ? `${sliderRow('Sensitivity', 'gyroSens', 0.2, 4, 0.1)}
        <div class="row"><span>Invert</span><div class="picks">${chip('Left / right', 'gyroInvX')}${chip('Up / down', 'gyroInvY')}</div></div>
        <div class="row"><span class="muted" data-gyro>${esc(gyroStatus())}</span><button class="sm" data-action="gyro-allow" style="${gyro.granted ? 'display:none' : ''}">Allow</button></div>` : ''}
      </div>

      ${profileUsesMouse() || mm.on ? `<div class="sec">Cursor</div>
      <div class="group">
        <div class="row"><span>Mouse mode <span class="muted" data-mm>${mm.on ? 'on' : 'off'}</span></span><button class="sm" data-action="mousemode">Toggle</button></div>
        <div class="muted">Turns on by itself. If swipes stop moving the cursor, tap Toggle once.</div>
      </div>` : ''}

      <button class="more" data-action="adv">More settings <span class="chev${ui.advOpen ? ' up' : ''}">${ICONS.chevronDown}</span></button>
      ${ui.advOpen ? `<div class="group">
        ${toggleRow('Virtual controller', 'show')}
        ${toggleRow('Hide with a real controller', 'autoHide')}
        ${CAN_VIBRATE ? toggleRow('Vibrate on press', 'haptics') : ''}
        ${IS_IOS ? toggleRow('Act as Home Screen app <span class="muted">· reload</span>', 'spoofStandalone') : ''}
        ${IS_IPHONE ? '' : toggleRow('Return to fullscreen <span class="muted">· after Safari closes it</span>', 'keepFs')}
        <div class="row"><span>Controller not working?</span><button class="sm" data-action="reconnect">Reconnect</button></div>
        <div class="row"><span>All settings</span><button class="sm danger" data-action="reset-all">Reset</button></div>
      </div>` : ''}`;
  }

  let statusTimer = 0;
  function togglePanel(open = !ui.panelOpen) {
    ui.panelOpen = open;
    clearInterval(statusTimer);
    if (open) {
      renderPanel();
      statusTimer = setInterval(() => {
        const s = ui.panel.querySelector('[data-status]');
        const d = ui.panel.querySelector('[data-dot]');
        const st = status();
        if (s) s.textContent = st.text;
        if (d) d.classList.toggle('ok', st.ok);
        refreshGyroUi();
      }, 1000);
    }
    ui.panel.style.display = open ? '' : 'none';
  }

  /* ---------- edit mode ---------- */
  function renderEditBar() {
    ui.editBar.innerHTML = `
      <button class="primary" data-action="done">Done</button>
      <button data-action="add-button">+ Button</button>
      <button data-action="add-key">+ Key</button>
      <button data-action="add-stick">+ Stick</button>
      <button data-action="add-dpad">+ D-pad</button>
      <button data-action="add-touch">+ Touch</button>
      <button data-action="reset-layout">Reset</button>`;
  }

  function setEdit(on) {
    releaseLatched();
    resetInput();
    ui.edit = on;
    ui.selected = null;
    ui.editBar.style.display = on ? '' : 'none';
    ui.inspector.style.display = 'none';
    if (on) togglePanel(false);
    else save(true);
    renderControls();
  }

  function select(id) {
    ui.selected = id;
    for (const [cid, el] of els) el.classList.toggle('sel', cid === id);
    renderInspector();
  }

  function positionInspector() {
    const c = ui.selected && findCtrl(ui.selected);
    if (!c) return;
    // Keep the inspector out of the way of the control being edited:
    // opposite side in landscape, opposite half in portrait.
    const s = ui.inspector.style;
    const below = ui.editBar.getBoundingClientRect().bottom + 6;
    if (innerWidth > innerHeight) {
      Object.assign(s, { width: 'min(380px, 46vw)', top: `${below}px`, bottom: '', maxHeight: `${innerHeight - below - 6}px`, transform: '' });
      s.left = c.x > 50 ? '6px' : '';
      s.right = c.x > 50 ? '' : '6px';
    } else {
      Object.assign(s, { width: 'min(520px, 96vw)', left: '50%', right: '', transform: 'translateX(-50%)', maxHeight: '45vh' });
      s.top = c.y > 50 ? `${below}px` : '';
      s.bottom = c.y > 50 ? '' : '8px';
    }
  }

  function range(label, prop, min, max, step, value, shown) {
    return `<div class="row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-prop="${prop}"><output data-out="${prop}">${shown == null ? value : shown}</output></div>`;
  }
  const textField = (label, prop, value, placeholder) =>
    `<div class="row"><span>${label}</span><input type="text" data-prop="${prop}" value="${esc(value)}" placeholder="${esc(placeholder || '')}" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></div>`;
  const keyOptions = () => KEY_CHOICES.map((k) => `<option value="${k}">${esc(keyName(k))}</option>`).join('');

  function renderInspector() {
    const c = ui.selected && findCtrl(ui.selected);
    if (!c) { ui.inspector.style.display = 'none'; return; }
    const kind = { button: 'Button', stick: 'Stick', dpad: 'D-pad', touch: 'Touch area' }[c.type];
    const sec = (title) => `</div><div class="sec">${title}</div><div class="group">`;
    let html = `<div class="hd">${kind} <span class="muted" style="flex:1">${esc(c.label || '')}</span><button class="x" data-action="deselect">✕</button></div><div class="group">`;
    if (c.type !== 'touch') html += range('Size', 'size', 4, 60, 1, c.size);
    html += range('Opacity', 'opacity', 0, 1, 0.05, c.opacity || 0, c.opacity ? c.opacity : 'auto');

    if (c.type === 'button') {
      html += textField('Label', 'label', c.label);
      html += `<div class="row"><span>Shape</span><select data-prop="shape">${['circle', 'pill', 'square']
        .map((s) => `<option${c.shape === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div>`;
      html += `<div class="row"><span>Label colour</span><input type="color" value="${c.color || '#ffffff'}" data-prop="color"><button data-action="clear-color">Reset</button></div>`;
      html += `<label class="row"><span>Toggle (tap on / off)</span><input type="checkbox" data-prop="toggle"${c.toggle ? ' checked' : ''}></label>`;
      html += sec('Keys · join with +');
      html += `<div class="row"><input type="text" data-prop="keys" value="${esc(formatKeys(c.keys))}" placeholder="e.g. Shift + W, LMB, Space" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></div>`;
      html += `<div class="row"><select data-prop="addKey"><option value="">Add key…</option>${keyOptions()}</select><output class="wide" data-out="keys">${esc(formatKeys(c.keys) || 'none')}</output></div>`;
      html += sec('Gamepad buttons');
      html += `<div class="chips">${BTN_NAMES
        .map((n, i) => `<button class="chip${c.buttons.includes(i) ? ' on' : ''}" data-action="map" data-btn="${i}">${n}</button>`).join('')}</div>`;
    } else if (c.type === 'stick') {
      const out = c.output || 'pad';
      html += `<div class="row"><span>Output</span><select data-prop="output">${[['pad', 'Gamepad stick'], ['keys', 'Keys (e.g. WASD)'], ['mouse', 'Cursor']]
        .map(([v, n]) => `<option value="${v}"${out === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>`;
      if (out === 'pad') {
        html += `<div class="row"><span>Acts as</span><select data-prop="axes"><option value="left"${c.axes === 'left' ? ' selected' : ''}>Left stick</option><option value="right"${c.axes === 'right' ? ' selected' : ''}>Right stick</option></select></div>`;
      } else if (out === 'keys') {
        html += textField('Keys ↑, ←, ↓, →', 'keys4', (c.keys4 || WASD).map(keyName).join(', '), 'W, A, S, D');
        html += textField('Key at the rim (e.g. sprint)', 'edgeKey', c.edgeKey ? keyName(c.edgeKey) : '', 'none');
      }
      html += `<div class="row"><span>Mode</span><select data-prop="mode">${[['fixed', 'Fixed'], ['floating', 'Floating (centres on touch)'], ['touchpad', 'Swipe-to-look']]
        .map(([v, n]) => `<option value="${v}"${c.mode === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>`;
      html += range('Sensitivity', 'sens', 0.3, 3, 0.1, c.sens || 1);
      html += range('Deadzone', 'deadzone', 0, 0.5, 0.02, c.deadzone == null ? 0.1 : c.deadzone);
      html += range('Touch area', 'zone', 1, 3, 0.1, c.zone || 1);
      html += `<label class="row"><span>Invert Y</span><input type="checkbox" data-prop="invertY"${c.invertY ? ' checked' : ''}></label>`;
    } else if (c.type === 'dpad') {
      html += textField('Keys ↑, ←, ↓, →', 'keys4', c.keys4 ? c.keys4.map(keyName).join(', ') : '', 'empty = gamepad D-pad');
    } else if (c.type === 'touch') {
      const stick = c.output === 'stick';
      html += `<div class="row"><span>Output</span><select data-prop="output">${[['stick', 'Right stick'], ['mouse', 'Cursor']]
        .map(([v, n]) => `<option value="${v}"${(stick ? 'stick' : 'mouse') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>`;
      html += range('Width', 'w', 5, 100, 1, c.w);
      html += range('Height', 'h', 5, 100, 1, c.h);
      html += stick ? range('Sensitivity', 'sens', 0.3, 3, 0.1, c.sens || 1) : range('Sensitivity', 'sens', 0.2, 5, 0.1, c.sens || 1.5);
      if (!stick) html += range('Smoothing', 'smooth', 0, 1, 0.05, c.smooth == null ? 0.35 : c.smooth);
      html += textField('Label', 'label', c.label || '', touchHint(c));
      if (!stick) html += `<label class="row"><span>Tap to left-click</span><input type="checkbox" data-prop="tapClick"${c.tapClick ? ' checked' : ''}></label>`;
      html += `<label class="row"><span>Invert Y</span><input type="checkbox" data-prop="invertY"${c.invertY ? ' checked' : ''}></label>`;
    }
    html += `</div><div class="btns"><button class="grow" data-action="dup">Duplicate</button><button class="grow danger" data-action="delete">Delete</button></div>`;
    ui.inspector.innerHTML = html;
    ui.inspector.style.display = '';
    positionInspector();
  }

  /* ---------- actions ---------- */
  const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  function addControl(c) {
    controls().push(c);
    save();
    renderControls();
    select(c.id);
  }

  function switchProfile(name) {
    releaseLatched();
    resetInput();
    settings.active = name;
    if (mm.on && !profileUsesMouse()) ensureMouseMode(false);
  }

  /* ---------- sharing layouts ---------- */
  const layoutJson = () => JSON.stringify({ glasspad: 1, name: settings.active, controls: controls() });

  function uniqueName(base) {
    let name = base, n = 2;
    while (settings.profiles[name]) name = `${base} ${n++}`;
    return name;
  }

  // Accepts our export ({ name, controls }) or a bare array of controls.
  // Never overwrites: a clash gets a numbered name.
  function importLayout(text, quiet) {
    let data;
    try { data = JSON.parse(String(text || '').trim()); } catch (_) { data = null; }
    const list = data && (Array.isArray(data) ? data : data.controls);
    if (!Array.isArray(list) || !list.length || !list.every((x) => x && x.id && x.type)) {
      if (!quiet) toast('That isn\'t a GlassPad layout. Copy one with Share → Copy first.');
      return false;
    }
    const name = uniqueName(String((data && data.name) || 'Imported').trim().slice(0, 40) || 'Imported');
    releaseLatched();
    settings.profiles[name] = upgradeControls(list);
    switchProfile(name);
    save(); renderControls(); renderPanel();
    toast(`Imported "${name}" and switched to it.`);
    return true;
  }

  function exportFile() {
    const text = layoutJson();
    const fileName = `glasspad-${settings.active.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'layout'}.json`;
    const file = typeof File === 'function' ? new File([text], fileName, { type: 'application/json' }) : null;
    // iPhone/iPad: the share sheet offers Save to Files, AirDrop, Messages…
    if (IS_IOS && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch((e) => { if (e && e.name !== 'AbortError') download(); });
      return;
    }
    download();
    function download() {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      toast(`Saved ${fileName}`);
    }
  }

  function importFile(file) {
    if (!file) return;
    file.text().then((text) => importLayout(text), () => toast('Couldn\'t read that file.'));
  }

  // Fallback when the clipboard is blocked: show the text to copy or a box to paste into.
  function showIo(mode, text = '') {
    const wrap = ui.panel.querySelector('[data-io-wrap]');
    if (!wrap) return;
    wrap.style.display = '';
    const io = wrap.querySelector('[data-io]');
    wrap.querySelector('[data-io-hint]').textContent = mode === 'copy'
      ? 'Couldn\'t copy automatically. Select the text below and copy it.'
      : 'Paste a layout below, then tap Import.';
    wrap.querySelector('[data-io-go]').style.display = mode === 'copy' ? 'none' : '';
    io.value = text;
    io.readOnly = mode === 'copy';
    io.focus();
    if (mode === 'copy') io.select();
  }
  function hideIo() {
    const wrap = ui.panel.querySelector('[data-io-wrap]');
    if (wrap) wrap.style.display = 'none';
  }

  function doAction(action, el) {
    const c = ui.selected && findCtrl(ui.selected);
    const io = ui.panel.querySelector('[data-io]');
    switch (action) {
      case 'close': togglePanel(false); break;
      case 'edit': setEdit(true); break;
      case 'done': setEdit(false); break;
      case 'deselect': select(null); break;
      case 'add-button': addControl(btn(newId(), 'A', [0], 50, 50, 12)); break;
      case 'add-key': addControl(key(newId(), 'Space', ['Space'], 50, 50, 11)); break;
      case 'add-stick': addControl({ id: newId(), type: 'stick', output: 'pad', axes: 'right', x: 50, y: 50, size: 26, zone: 1.3, mode: 'fixed', sens: 1, deadzone: 0.1, invertY: false }); break;
      case 'add-dpad': addControl({ id: newId(), type: 'dpad', x: 50, y: 50, size: 24 }); break;
      case 'add-touch': addControl(profileUsesMouse()
        ? { id: newId(), type: 'touch', output: 'mouse', x: 50, y: 50, w: 40, h: 50, sens: 1.5, invertY: false, tapClick: true }
        : { id: newId(), type: 'touch', output: 'stick', x: 50, y: 50, w: 40, h: 50, sens: 1, invertY: false }); break;
      case 'reset-layout':
        if (confirm(`Reset "${settings.active}" to its default layout?`)) {
          releaseLatched();
          settings.profiles[settings.active] = (DEFAULT_LAYOUTS[settings.active] || defaultControls)();
          ui.selected = null; ui.inspector.style.display = 'none';
          save(); renderControls();
        }
        break;
      case 'map': {
        if (!c) break;
        const b = Number(el.dataset.btn);
        c.buttons = c.buttons.includes(b) ? c.buttons.filter((x) => x !== b) : [...c.buttons, b].sort((p, q) => p - q);
        save(); renderControls(); renderInspector();
        break;
      }
      case 'clear-color': if (c) { delete c.color; save(); renderControls(); renderInspector(); } break;
      case 'dup':
        if (c) addControl(Object.assign(JSON.parse(JSON.stringify(c)), { id: newId(), x: clamp(c.x + 5, 0, 100), y: clamp(c.y + 5, 0, 100) }));
        break;
      case 'delete':
        if (c) {
          if (latched.has(c.id)) { holdButton(c, false); latched.delete(c.id); }
          settings.profiles[settings.active] = controls().filter((x) => x !== c);
          ui.selected = null; ui.inspector.style.display = 'none';
          save(); renderControls();
        }
        break;
      case 'mousemode': toggleMouseMode(); break;
      case 'gyro-allow': requestGyro(true); break;
      case 'fullscreen': togglePanel(false); toggleFullscreen(); break;
      case 'profile-new': {
        const typed = (prompt('Name for the new profile (starts from the default controller layout):', uniqueName('My layout')) || '').trim();
        if (!typed) break;
        const name = uniqueName(typed.slice(0, 40)); // never overwrite an existing profile
        settings.profiles[name] = defaultControls();
        switchProfile(name);
        save(); renderControls(); renderPanel();
        break;
      }
      case 'profile-rename': {
        const name = (prompt('Rename profile:', settings.active) || '').trim();
        if (!name || name === settings.active) break;
        settings.profiles[name] = controls();
        delete settings.profiles[settings.active];
        settings.active = name;
        save(); renderPanel();
        break;
      }
      case 'profile-delete':
        if (Object.keys(settings.profiles).length < 2) { alert('You need at least one profile.'); break; }
        if (!confirm(`Delete profile "${settings.active}"?`)) break;
        releaseLatched();
        delete settings.profiles[settings.active];
        switchProfile(Object.keys(settings.profiles)[0]);
        save(); renderControls(); renderPanel();
        break;
      case 'export': {
        const text = layoutJson();
        const manual = () => showIo('copy', text);
        if (!navigator.clipboard || !navigator.clipboard.writeText) { manual(); break; }
        navigator.clipboard.writeText(text)
          .then(() => toast(`Copied "${settings.active}". Paste it anywhere to share or back it up.`), manual);
        break;
      }
      case 'import': {
        const manual = () => showIo('paste');
        if (!navigator.clipboard || !navigator.clipboard.readText) { manual(); break; }
        // Safari shows a small "Paste" bubble here; tapping it hands us the text.
        navigator.clipboard.readText().then((text) => { if (!importLayout(text, true)) manual(); }, manual);
        break;
      }
      case 'import-text': if (io && importLayout(io.value)) hideIo(); break;
      case 'io-close': hideIo(); break;
      case 'export-file': exportFile(); break;
      case 'import-file': { const f = ui.panel.querySelector('[data-file]'); if (f) { f.value = ''; f.click(); } break; }
      case 'adv': ui.advOpen = !ui.advOpen; renderPanel(); break;
      case 'profile-list': ui.profOpen = !ui.profOpen; renderPanel(); break;
      case 'profile-pick':
        ui.profOpen = false;
        if (el.dataset.name !== settings.active && settings.profiles[el.dataset.name]) {
          switchProfile(el.dataset.name);
          save(); renderControls();
        }
        renderPanel();
        break;
      case 'gyro-mode':
        settings.gyroMode = el.dataset.v;
        save(); requestGyro(true); renderPanel();
        break;
      case 'reconnect': syncConnection(true); break;
      case 'reset-all':
        if (!confirm('Delete all profiles and settings?')) break;
        releaseEverything();
        settings = defaultSettings();
        save(true); renderControls(); renderPanel(); syncConnection();
        break;
      default: break;
    }
  }

  function onInput(e) {
    const t = e.target;
    const val = t.type === 'checkbox' ? t.checked : t.type === 'range' ? parseFloat(t.value) : t.value;
    const out = (k, text) => {
      const o = t.closest('.ui').querySelector(`[data-out="${k}"]`);
      if (o) o.textContent = text;
    };

    if (t.dataset.file !== undefined) {
      if (e.type === 'change') importFile(t.files && t.files[0]);
      return;
    }

    if (t.dataset.set) {
      const k = t.dataset.set;
      if (k === 'hidden') return setHidden(t.dataset.invert ? !val : val);
      if (k === 'profile') switchProfile(val); else settings[k] = val;
      if (t.type === 'range') out(k, val);
      const pick = t.closest('.pick');
      if (pick) pick.classList.toggle('on', val);
      save();
      if (k === 'show' || k === 'autoHide') { scanRealPads(); syncConnection(); }
      if (k === 'opacity' || k === 'scale' || k === 'profile') renderControls();
      if (k === 'blur') updateVisibility();
      if (k === 'profile') renderPanel();
      if (k === 'gyroMode') { requestGyro(true); renderPanel(); }
      return;
    }

    if (t.dataset.prop) {
      const c = ui.selected && findCtrl(ui.selected);
      if (!c) return;
      const k = t.dataset.prop;
      let rerenderInspector = false;
      if (k === 'keys' || k === 'addKey') {
        if (latched.has(c.id)) { holdButton(c, false); latched.delete(c.id); }
        if (k === 'addKey') {
          if (!val) return;
          c.keys = [...new Set([...(c.keys || []), val])];
          t.value = '';
          const field = ui.inspector.querySelector('[data-prop="keys"]');
          if (field) field.value = formatKeys(c.keys);
          out('keys', formatKeys(c.keys));
        } else {
          const { codes, bad } = parseKeys(val, '+');
          c.keys = codes;
          out('keys', (formatKeys(codes) || 'none') + (bad.length ? `  ⚠ unknown: ${bad.join(', ')}` : ''));
        }
      } else if (k === 'keys4') {
        const { codes, bad } = parseKeys(val, ',');
        if (!val.trim() && c.type === 'dpad') delete c.keys4;
        else if (codes.length === 4 && !bad.length) c.keys4 = codes;
        else return;
      } else if (k === 'edgeKey') {
        const code = parseKey(val);
        if (code === null) c.edgeKey = '';
        else if (code) c.edgeKey = code;
        else return;
      } else if (k === 'opacity' && !val) {
        delete c.opacity;
      } else {
        c[k] = val;
        if (k === 'output') {
          rerenderInspector = true;
          if (val === 'keys' && !c.keys4) c.keys4 = WASD.slice();
          // Mouse mode blocks gamepad buttons, so drop it once nothing needs the cursor.
          if (mm.on && !profileUsesMouse()) ensureMouseMode(false);
        }
      }
      if (t.type === 'range') out(k, k === 'opacity' && !val ? 'auto' : val);
      save();
      renderControls();
      if (rerenderInspector) renderInspector();
    }
  }

  /* ------------------------------------------------------------------ *
   * Mounting
   * ------------------------------------------------------------------ */
  function mount() {
    if (!ui.host) return;
    // When GFN goes fullscreen (iPad), only the fullscreen element's subtree
    // is painted, so the overlay must move inside it.
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    const parent = fs && fs !== document.documentElement && !/^(VIDEO|CANVAS|IMG)$/.test(fs.tagName)
      ? fs : (document.body || document.documentElement);
    if (ui.host.parentNode !== parent) parent.appendChild(ui.host);
  }

  function buildUI() {
    const host = document.createElement('gfn-touch-controls');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block;';
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const layer = document.createElement('div');
    layer.className = 'layer';
    const gear = document.createElement('div');
    gear.className = 'ctrl gear';
    gear.dataset.ctrl = '__gear';
    const mk = (cls) => { const d = document.createElement('div'); d.className = `ui ${cls}`; d.style.display = 'none'; return d; };
    const panel = mk('panel');
    const editBar = mk('editbar');
    const inspector = mk('inspector');
    const toastEl = mk('toast');
    root.append(style, layer, gear, editBar, inspector, panel, toastEl);
    root.addEventListener('input', onInput);
    root.addEventListener('change', (e) => { if (e.target.type !== 'range') onInput(e); });
    Object.assign(ui, { host, root, layer, gear, panel, editBar, inspector, toast: toastEl });

    renderEditBar();
    renderControls();
    mount();

    for (const t of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(t, onFullscreenChange);
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resetInput(); renderControls(); positionInspector(); }, 120);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // Lifting a finger while switching apps never sends pointerup.
    document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });
    window.addEventListener('blur', resetInput);

    setInterval(() => { mount(); scanRealPads(); syncConnection(); }, 1500);
  }

  scanRealPads();
  syncConnection();
  requestGyro(false); // starts right away where no permission prompt is needed
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI, { once: true });
  else buildUI();

  // Handy for debugging from the Web Inspector.
  window.__gfnTouch = { settings: () => settings, pad, snapshot, mouseMode: mm, mouse, gyro };
})();
