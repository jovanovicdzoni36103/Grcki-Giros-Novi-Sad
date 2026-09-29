// Local emulator of the Google Apps Script services this project uses.
// It runs the real backend/apps-script/*.gs files; every call gets a fresh global scope
// (like a real Apps Script execution) while Sheets/Properties/Cache/Mail state persists outside.
import vm from 'node:vm';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const gasDir = path.join(root, 'backend/apps-script');

// ---------------------------------------------------------------------------
// Date formatting (java.text.SimpleDateFormat subset used by the backend)
// ---------------------------------------------------------------------------

function wallParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23'
  });
  const o = {};
  for (const p of fmt.formatToParts(date)) o[p.type] = p.value;
  const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[o.weekday];
  return { y: +o.year, M: +o.month, d: +o.day, H: +o.hour % 24, m: +o.minute, s: +o.second, u: wd };
}

function offsetMinutes(date, timeZone) {
  const p = wallParts(date, timeZone);
  const asUtc = Date.UTC(p.y, p.M - 1, p.d, p.H, p.m, p.s);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

export function formatDate(date, timeZone, pattern) {
  const p = wallParts(date, timeZone);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  let out = '';
  for (let i = 0; i < pattern.length; ) {
    const ch = pattern[i];
    if (ch === "'") {
      const end = pattern.indexOf("'", i + 1);
      out += pattern.slice(i + 1, end === -1 ? undefined : end);
      i = end === -1 ? pattern.length : end + 1;
      continue;
    }
    let j = i;
    while (j < pattern.length && pattern[j] === ch) j++;
    const n = j - i;
    switch (ch) {
      case 'y': out += n === 2 ? pad(p.y % 100) : String(p.y); break;
      case 'M': out += n >= 2 ? pad(p.M) : String(p.M); break;
      case 'd': out += n >= 2 ? pad(p.d) : String(p.d); break;
      case 'H': out += n >= 2 ? pad(p.H) : String(p.H); break;
      case 'm': out += n >= 2 ? pad(p.m) : String(p.m); break;
      case 's': out += n >= 2 ? pad(p.s) : String(p.s); break;
      case 'u': out += String(p.u); break;
      case 'X': {
        const off = offsetMinutes(date, timeZone);
        const sign = off >= 0 ? '+' : '-';
        const a = Math.abs(off);
        out += n >= 3 ? `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}` : `${sign}${pad(Math.floor(a / 60))}`;
        break;
      }
      default: out += ch.repeat(n);
    }
    i = j;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spreadsheet model
// ---------------------------------------------------------------------------

const chainable = (target) =>
  new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (typeof prop === 'symbol') return undefined;
      return () => chainable(obj); // formatting calls (setBackground, setFontWeight, …) are no-ops
    }
  });

function colToIndex(letters) {
  let n = 0;
  for (const c of letters.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n;
}

function parseA1(a1) {
  const m = String(a1).match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!m) throw new Error('Unsupported A1 notation: ' + a1);
  const r1 = +m[2];
  const c1 = colToIndex(m[1]);
  const r2 = m[4] ? +m[4] : r1;
  const c2 = m[3] ? colToIndex(m[3]) : c1;
  return [r1, c1, r2 - r1 + 1, c2 - c1 + 1];
}

function displayOf(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return formatDate(v, 'Europe/Belgrade', 'yyyy-MM-dd HH:mm:ss');
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

class MockRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    if (row < 1 || col < 1 || numRows < 1 || numCols < 1) throw new Error(`Invalid range ${row},${col},${numRows},${numCols} on ${sheet.name}`);
    Object.assign(this, { sheet, row, col, numRows, numCols });
    return chainable(this);
  }
  getRow() { return this.row; }
  getColumn() { return this.col; }
  getNumRows() { return this.numRows; }
  getNumColumns() { return this.numCols; }
  getSheet() { return this.sheet; }
  getA1Notation() { return `R${this.row}C${this.col}`; }
  getValues() {
    this.sheet.ss.emu.fault('sheetsRead', this.sheet.name);
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = this.sheet.data[this.row - 1 + r] || [];
      const vals = [];
      for (let c = 0; c < this.numCols; c++) {
        const v = row[this.col - 1 + c];
        vals.push(v === undefined || v === null ? '' : v instanceof Date ? new Date(v.getTime()) : v);
      }
      out.push(vals);
    }
    return out;
  }
  getDisplayValues() {
    return this.getValues().map((r) => r.map(displayOf));
  }
  getValue() { return this.getValues()[0][0]; }
  getDisplayValue() { return this.getDisplayValues()[0][0]; }
  setValues(values) {
    this.sheet.ss.emu.fault('sheetsWrite', this.sheet.name);
    if (values.length !== this.numRows || values.some((r) => r.length !== this.numCols)) {
      throw new Error(`The number of rows or columns in the data does not match the range (${this.sheet.name})`);
    }
    values.forEach((r, i) => {
      const target = (this.sheet.data[this.row - 1 + i] ||= []);
      r.forEach((v, j) => {
        let value = v;
        if (typeof value === 'string' && value.startsWith("'")) value = value.slice(1);
        if (value instanceof Date) value = new Date(value.getTime());
        target[this.col - 1 + j] = value;
      });
    });
    return chainable(this);
  }
  setValue(v) { return this.setValues([[v]]); }
  clearContent() {
    const blank = Array.from({ length: this.numRows }, () => Array(this.numCols).fill(''));
    const saved = this.sheet.ss.emu.faults.sheetsWrite;
    this.sheet.ss.emu.faults.sheetsWrite = false;
    this.setValues(blank);
    this.sheet.ss.emu.faults.sheetsWrite = saved;
    return chainable(this);
  }
  clear() { return this.clearContent(); }
  createTextFinder(text) {
    const range = this;
    let entire = false;
    const finder = {
      matchEntireCell(b) { entire = !!b; return finder; },
      matchCase() { return finder; },
      findAll() {
        const hits = [];
        range.getDisplayValues().forEach((r, i) =>
          r.forEach((v, j) => {
            if (entire ? v === String(text) : v.includes(String(text))) hits.push(new MockRange(range.sheet, range.row + i, range.col + j));
          })
        );
        return hits;
      },
      findNext() { return finder.findAll()[0] || null; }
    };
    return finder;
  }
}

class MockSheet {
  constructor(ss, name) {
    this.ss = ss;
    this.name = name;
    this.data = [];
    this.charts = [];
    this.frozenRows = 0;
    this.id = Math.floor(Math.random() * 1e9);
    return chainable(this);
  }
  getName() { return this.name; }
  getSheetId() { return this.id; }
  getParent() { return this.ss; }
  getLastRow() {
    for (let r = this.data.length - 1; r >= 0; r--) {
      const row = this.data[r];
      if (row && row.some((v) => v !== '' && v !== null && v !== undefined)) return r + 1;
    }
    return 0;
  }
  getLastColumn() {
    let max = 0;
    for (const row of this.data) {
      if (!row) continue;
      for (let c = row.length - 1; c >= 0; c--) {
        if (row[c] !== '' && row[c] !== null && row[c] !== undefined) {
          max = Math.max(max, c + 1);
          break;
        }
      }
    }
    return max;
  }
  getMaxRows() { return Math.max(1000, this.data.length); }
  getMaxColumns() { return Math.max(26, this.getLastColumn()); }
  getRange(a, b, c, d) {
    if (typeof a === 'string') return new MockRange(this, ...parseA1(a));
    return new MockRange(this, a, b, c ?? 1, d ?? 1);
  }
  getDataRange() { return new MockRange(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  appendRow(values) { return this.getRange(this.getLastRow() + 1, 1, 1, values.length).setValues([values]); }
  deleteRows(start, n) { this.data.splice(start - 1, n); }
  setFrozenRows(n) { this.frozenRows = n; return chainable(this); }
  getCharts() { return this.charts; }
  insertChart(chart) { this.charts.push(chart); }
  newChart() {
    const spec = { ranges: [], options: {} };
    const b = {
      setChartType(t) { spec.type = t; return b; },
      addRange(r) { spec.ranges.push(r.getA1Notation()); return b; },
      setPosition(...p) { spec.position = p; return b; },
      setNumHeaders() { return b; },
      setOption(k, v) { spec.options[k] = v; return b; },
      build() { return spec; }
    };
    return b;
  }
  clear() { this.data = []; return chainable(this); }
}

class MockSpreadsheet {
  constructor(emu) {
    this.emu = emu;
    this.sheets = [];
    this.id = 'ss-local-emulator';
    this.timeZone = 'Europe/Belgrade';
    this.sheets.push(new MockSheet(this, 'Sheet1'));
    return chainable(this);
  }
  getId() { return this.id; }
  getSheets() { return this.sheets.slice(); }
  getSheetByName(name) {
    this.emu.fault('sheetsOpen', name);
    return this.sheets.find((s) => s.name === name) || null;
  }
  insertSheet(name) {
    const s = new MockSheet(this, name);
    this.sheets.push(s);
    return s;
  }
  deleteSheet(sheet) { this.sheets = this.sheets.filter((s) => s !== sheet); }
  setActiveSheet(s) { this.active = s; return s; }
  moveActiveSheet(pos) {
    const s = this.active;
    this.sheets = this.sheets.filter((x) => x !== s);
    this.sheets.splice(pos - 1, 0, s);
  }
  setSpreadsheetTimeZone(tz) { this.timeZone = tz; }
  getSpreadsheetTimeZone() { return this.timeZone; }
}

// ---------------------------------------------------------------------------
// Serialization (dev server persistence)
// ---------------------------------------------------------------------------

const reviveCell = (v) => (v && typeof v === 'object' && '$date' in v ? new Date(v.$date) : v);
const storeCell = (v) => (v instanceof Date ? { $date: v.toISOString() } : v);

// ---------------------------------------------------------------------------
// Emulator
// ---------------------------------------------------------------------------

const toSigned = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
const toBuffer = (v) => (Array.isArray(v) ? Buffer.from(v.map((b) => b & 0xff)) : Buffer.from(String(v), 'utf8'));

export function createEmulator(options = {}) {
  const scripts = readdirSync(gasDir)
    .filter((f) => f.endsWith('.gs'))
    .sort((a, b) => (a.startsWith('Shared_') === b.startsWith('Shared_') ? a.localeCompare(b) : a.startsWith('Shared_') ? -1 : 1))
    .map((f) => new vm.Script(readFileSync(path.join(gasDir, f), 'utf8'), { filename: f }));

  const emu = {
    now: options.now ? new Date(options.now).getTime() : null,
    properties: {},
    cache: new Map(),
    outbox: [],
    triggers: [],
    driveFiles: [],
    folders: [],
    mailQuota: options.mailQuota ?? 100,
    faults: { sheetsWrite: false, sheetsRead: false, sheetsOpen: false, mail: false, lock: false },
    lockLog: [],
    executions: 0,
    fault(kind, sheetName) {
      const f = emu.faults[kind];
      if (!f) return;
      if (f === true || f === sheetName) throw new Error(`Service Spreadsheets failed while accessing document (${kind}, injected)`);
    }
  };
  emu.spreadsheet = new MockSpreadsheet(emu);

  const clock = () => (emu.now !== null ? emu.now : Date.now());

  const cache = {
    get(k) {
      const e = emu.cache.get(k);
      if (!e) return null;
      if (e.exp <= clock()) {
        emu.cache.delete(k);
        return null;
      }
      return e.v;
    },
    put(k, v, ttl = 600) {
      if (String(v).length > 100000) throw new Error('Argument too large: value');
      emu.cache.set(k, { v: String(v), exp: clock() + Math.min(ttl, 21600) * 1000 });
    },
    remove(k) { emu.cache.delete(k); },
    removeAll(keys) { keys.forEach((k) => emu.cache.delete(k)); },
    getAll(keys) { return Object.fromEntries(keys.map((k) => [k, cache.get(k)]).filter(([, v]) => v !== null)); },
    putAll(obj, ttl) { Object.entries(obj).forEach(([k, v]) => cache.put(k, v, ttl)); }
  };

  const props = {
    getProperty: (k) => (k in emu.properties ? emu.properties[k] : null),
    setProperty: (k, v) => { emu.properties[k] = String(v); return props; },
    setProperties: (obj) => { Object.entries(obj).forEach(([k, v]) => (emu.properties[k] = String(v))); return props; },
    deleteProperty: (k) => { delete emu.properties[k]; return props; },
    getProperties: () => ({ ...emu.properties })
  };

  function makeLock() {
    let held = false;
    return {
      tryLock(ms) {
        if (emu.faults.lock) {
          emu.lockLog.push({ event: 'timeout', ms });
          return false;
        }
        held = true;
        emu.lockLog.push({ event: 'acquire' });
        return true;
      },
      waitLock(ms) {
        if (!this.tryLock(ms)) throw new Error('Lock timeout: another process was holding the lock for too long.');
      },
      releaseLock() {
        if (held) emu.lockLog.push({ event: 'release' });
        held = false;
      },
      hasLock: () => held
    };
  }

  function sendEmail(a, b, c, d) {
    const msg = typeof a === 'object' ? { ...a } : { to: a, subject: b, body: c, ...(d || {}) };
    const recipients = String(msg.to).split(',').map((s) => s.trim()).filter(Boolean);
    if (emu.faults.mail === true || recipients.includes(emu.faults.mail)) throw new Error('Service invoked too many times for one day: email. (injected)');
    if (recipients.some((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))) throw new Error('Invalid email: ' + msg.to);
    if (emu.mailQuota < recipients.length) throw new Error('Service invoked too many times for one day: email.');
    emu.mailQuota -= recipients.length;
    emu.outbox.push({
      at: new Date(clock()).toISOString(),
      to: msg.to,
      subject: msg.subject,
      htmlBody: msg.htmlBody || '',
      body: msg.body || '',
      replyTo: msg.replyTo || '',
      name: msg.name || '',
      attachments: Array.from(msg.attachments || [], (x) => x.getName())
    });
  }

  function triggerBuilder(handler) {
    const spec = { handler };
    const b = {
      timeBased: () => b,
      everyDays: (n) => ((spec.everyDays = n), b),
      everyHours: (n) => ((spec.everyHours = n), b),
      everyMinutes: (n) => {
        if (![1, 5, 10, 15, 30].includes(n)) throw new Error('everyMinutes must be 1, 5, 10, 15 or 30');
        spec.everyMinutes = n;
        return b;
      },
      atHour: (h) => ((spec.atHour = h), b),
      nearMinute: (m) => ((spec.nearMinute = m), b),
      onWeekDay: (d) => ((spec.onWeekDay = d), b),
      onMonthDay: (d) => ((spec.onMonthDay = d), b),
      create() {
        const t = { ...spec, id: randomUUID(), getHandlerFunction: () => handler, getUniqueId: () => t.id };
        emu.triggers.push(t);
        return t;
      }
    };
    return b;
  }

  function folderApi(meta) {
    return {
      getId: () => meta.id,
      getName: () => meta.name,
      createFile: (blob) => {
        const bytes = blob.getBytes();
        const file = {
          id: 'file-' + randomUUID().slice(0, 8),
          folderId: meta.id,
          name: blob.getName(),
          size: bytes.length,
          type: blob.getContentType(),
          sharing: 'PRIVATE',
          data: Buffer.from(Array.from(bytes, (b) => b & 0xff)).toString('base64')
        };
        emu.driveFiles.push(file);
        return {
          getUrl: () => `https://drive.google.com/file/d/${file.id}/view`,
          getId: () => file.id,
          getName: () => file.name,
          setSharing: (access) => {
            file.sharing = access;
          }
        };
      }
    };
  }

  function services() {
    const Utilities = {
      DigestAlgorithm: { MD5: 'md5', SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      formatDate: (date, tz, pattern) => formatDate(date, tz, pattern),
      getUuid: () => randomUUID(),
      computeDigest: (alg, value) => toSigned(createHash(alg).update(toBuffer(value)).digest()),
      computeHmacSha256Signature: (value, key) => toSigned(createHmac('sha256', toBuffer(key)).update(toBuffer(value)).digest()),
      base64Encode: (v) => toBuffer(v).toString('base64'),
      base64EncodeWebSafe: (v) => toBuffer(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64Decode: (s) => {
        if (!/^[A-Za-z0-9+/=\s]*$/.test(s)) throw new Error('Could not decode string.');
        return toSigned(Buffer.from(s, 'base64'));
      },
      newBlob: (bytes, type, name) => ({ getBytes: () => bytes, getContentType: () => type, getName: () => name }),
      sleep: () => {}
    };
    return {
      console,
      Date,
      Utilities,
      Logger: { log: (...a) => (options.verbose ? console.log('[GAS]', ...a) : undefined) },
      SpreadsheetApp: {
        getActiveSpreadsheet: () => emu.spreadsheet,
        getActive: () => emu.spreadsheet,
        openById: () => emu.spreadsheet,
        flush: () => {},
        newDataValidation: () => chainable({ build: () => ({}) }),
        getUi: () => ({
          createMenu: () => chainable({ addToUi: () => {} }),
          alert: () => {},
          prompt: () => ({ getSelectedButton: () => 'CANCEL', getResponseText: () => '' }),
          ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL' },
          Button: { OK: 'OK', CANCEL: 'CANCEL' }
        })
      },
      LockService: { getScriptLock: makeLock, getDocumentLock: makeLock },
      CacheService: { getScriptCache: () => cache },
      PropertiesService: { getScriptProperties: () => props },
      MailApp: { sendEmail, getRemainingDailyQuota: () => emu.mailQuota },
      ContentService: {
        MimeType: { JSON: 'application/json', TEXT: 'text/plain' },
        createTextOutput: (content) => {
          const out = { content, mime: 'text/plain', setMimeType: (m) => ((out.mime = m), out), getContent: () => out.content };
          return out;
        }
      },
      Session: { getEffectiveUser: () => ({ getEmail: () => options.ownerEmail || 'vlasnik@example.com' }), getScriptTimeZone: () => 'Europe/Belgrade' },
      ScriptApp: {
        WeekDay: { MONDAY: 'MONDAY', TUESDAY: 'TUESDAY', WEDNESDAY: 'WEDNESDAY', THURSDAY: 'THURSDAY', FRIDAY: 'FRIDAY', SATURDAY: 'SATURDAY', SUNDAY: 'SUNDAY' },
        getProjectTriggers: () => emu.triggers.slice(),
        deleteTrigger: (t) => { emu.triggers = emu.triggers.filter((x) => x !== t); },
        newTrigger: triggerBuilder
      },
      DriveApp: {
        Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', PRIVATE: 'PRIVATE' },
        Permission: { VIEW: 'VIEW', EDIT: 'EDIT' },
        createFolder: (name) => {
          const meta = { id: 'folder-' + randomUUID().slice(0, 8), name };
          emu.folders.push(meta);
          return folderApi(meta);
        },
        getFolderById: (id) => {
          const meta = emu.folders.find((f) => f.id === id);
          if (!meta) throw new Error('No item with the given ID could be found.');
          return folderApi(meta);
        }
      },
      Charts: { ChartType: { COLUMN: 'COLUMN', LINE: 'LINE' } }
    };
  }

  /** Runs `fn` inside a fresh Apps Script execution. */
  function run(fn, ...args) {
    emu.executions++;
    const sandbox = services();
    sandbox.GG_NOW_OVERRIDE = emu.now;
    const context = vm.createContext(sandbox);
    for (const s of scripts) s.runInContext(context);
    // Tests run against a fixed demo menu (tests/fixtures), not the shop's real, changing one.
    if (options.seed) context.SEED = JSON.parse(JSON.stringify(options.seed));
    if (typeof context[fn] !== 'function') throw new Error(`No Apps Script function ${fn}`);
    return context[fn](...args);
  }

  function parseResponse(out) {
    return JSON.parse(out.getContent());
  }

  const api = {
    state: emu,
    run,
    setNow(value) {
      emu.now = value === null ? null : new Date(value).getTime();
    },
    doGet(params) {
      return parseResponse(run('doGet', { parameter: { ...params } }));
    },
    doPost(body) {
      return parseResponse(run('doPost', { postData: { contents: typeof body === 'string' ? body : JSON.stringify(body), type: 'text/plain' }, parameter: {} }));
    },
    sheet(name) {
      return emu.spreadsheet.getSheetByName(name);
    },
    rows(name) {
      const sh = emu.spreadsheet.sheets.find((s) => s.name === name);
      if (!sh || sh.data.length < 2) return [];
      const headers = sh.data[0];
      return sh.data
        .slice(1)
        .filter((r) => r && r.some((v) => v !== '' && v !== null && v !== undefined))
        .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
    },
    toJSON() {
      return {
        properties: emu.properties,
        cache: [...emu.cache.entries()],
        outbox: emu.outbox,
        triggers: emu.triggers.map(({ getHandlerFunction, getUniqueId, ...t }) => t),
        mailQuota: emu.mailQuota,
        folders: emu.folders,
        driveFiles: emu.driveFiles,
        sheets: emu.spreadsheet.sheets.map((s) => ({ name: s.name, data: s.data.map((r) => (r || []).map(storeCell)), charts: s.charts }))
      };
    },
    save(file) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(api.toJSON()));
    },
    load(file) {
      if (!existsSync(file)) return false;
      const j = JSON.parse(readFileSync(file, 'utf8'));
      emu.properties = j.properties || {};
      emu.cache = new Map(j.cache || []);
      emu.outbox = j.outbox || [];
      emu.mailQuota = j.mailQuota ?? 100;
      emu.folders = j.folders || [];
      emu.driveFiles = j.driveFiles || [];
      emu.triggers = (j.triggers || []).map((t) => ({ ...t, getHandlerFunction: () => t.handler, getUniqueId: () => t.id }));
      emu.spreadsheet.sheets = j.sheets.map((s) => {
        const sh = new MockSheet(emu.spreadsheet, s.name);
        sh.data = s.data.map((r) => r.map(reviveCell));
        sh.charts = s.charts || [];
        return sh;
      });
      return true;
    }
  };
  return api;
}
