#!/usr/bin/env node
// ============================================================
// Builds an importable Postman collection (v2.1) for the HRMS API.
//
//   node scripts/postman/build-postman.mjs            build from the running API
//   node scripts/postman/build-postman.mjs --capture  also refresh example responses
//
// Sources, merged per endpoint:
//   1. The live OpenAPI spec (GET {API_URL}/api/docs-json — dev mode only):
//      methods, paths, path/query params, body schemas, summaries.
//   2. The controller source (TypeScript AST): permission/feature rules,
//      public + Super Admin routes, file uploads, CSRF header, doc comments.
//   3. examples.json (written by --capture): real, trimmed GET responses from
//      the local DB, signed in as a company user and as the Super Admin.
//
// Output: docs/postman/*.json (collection + environments). Never writes secrets.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, '../..');
const repoRoot = path.resolve(apiRoot, '../..');
const outDir = path.join(repoRoot, 'docs/postman');
const examplesFile = path.join(here, 'examples.json');

loadDotEnv(path.join(apiRoot, '.env'));
const API_URL = (process.env.POSTMAN_API_URL || process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const PREFIX = '/api/v1';

// ── Helpers ─────────────────────────────────────────────────

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const humanize = (s) =>
  s
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

const singular = (s) => s.replace(/ies$/, 'y').replace(/(ss|x|ch|sh)es$/, '$1').replace(/s$/, '');

function normalizePath(p) {
  return ('/' + p)
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
    .replace(/\/+/g, '/')
    .replace(/(.)\/$/, '$1');
}

// ── 1. Controller source scan ───────────────────────────────

const HTTP = { Get: 'get', Post: 'post', Put: 'put', Patch: 'patch', Delete: 'delete' };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

function decoratorsOf(node) {
  return (ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : []).map((d) => {
    const e = d.expression;
    if (ts.isCallExpression(e)) return { name: e.expression.getText(), args: e.arguments };
    return { name: e.getText(), args: [] };
  });
}

const literal = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : undefined);

function docComment(node, sf) {
  const text = sf.getFullText();
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) || [];
  const parts = ranges.map((r) =>
    text
      .slice(r.pos, r.end)
      .replace(/^\/\*\*?|\*\/$/g, '')
      .split('\n')
      .map((l) => l.replace(/^\s*(\*|\/\/)\s?/, '').trim())
      .filter((l) => l && !/[─═]{2,}|^[=\-]{3,}/.test(l) && !/^@/.test(l))
      .join(' ')
      .trim(),
  );
  return parts.filter(Boolean).join(' ').trim();
}

function scanControllers() {
  const routes = new Map();
  for (const file of walk(path.join(apiRoot, 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);

    // `const receipt = FileInterceptor('receipt', …)` → interceptor name → field
    const interceptors = {};
    for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(?:File|Files)Interceptor\(\s*'([^']+)'/g)) interceptors[m[1]] = m[2];

    sf.forEachChild(function visit(node) {
      if (!ts.isClassDeclaration(node)) return ts.forEachChild(node, visit);
      const cdecs = decoratorsOf(node);
      const ctrl = cdecs.find((d) => d.name === 'Controller');
      if (!ctrl) return;
      const prefix = literal(ctrl.args[0]) ?? '';
      const classRule = rulesFrom(cdecs);
      const classDoc = docComment(node, sf);

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const decs = decoratorsOf(member);
        const http = decs.find((d) => HTTP[d.name]);
        if (!http) continue;
        const sub = literal(http.args[0]) ?? '';
        const method = HTTP[http.name];
        const full = normalizePath([prefix, sub].filter(Boolean).join('/'));

        const rule = rulesFrom(decs);
        let fileField;
        for (const d of decs.filter((x) => x.name === 'UseInterceptors')) {
          for (const a of d.args) {
            const t = a.getText();
            const inline = t.match(/^(?:File|Files)Interceptor\(\s*'([^']+)'/);
            if (inline) fileField = inline[1];
            else if (interceptors[t]) fileField = interceptors[t];
          }
        }
        // Inline `@Query('status') status?: CompanyStatus` — Swagger marks these required
        // and can't see enum values; remember optionality + type name.
        const inlineQuery = {};
        for (const prm of member.parameters) {
          const q = decoratorsOf(prm).find((d) => d.name === 'Query');
          const qName = q && literal(q.args[0]);
          if (qName) inlineQuery[qName] = { optional: !!prm.questionToken, type: prm.type?.getText() };
        }
        const bodyText = member.body ? member.body.getText() : '';
        const params = member.parameters.map((p) => p.getText()).join(' ');
        routes.set(`${method} ${full}`, {
          handler: member.name.getText(),
          controller: node.name?.getText(),
          file: path.relative(repoRoot, file).replace(/\\/g, '/'),
          line: sf.getLineAndCharacterOfPosition(member.getStart()).line + 1,
          doc: docComment(member, sf),
          classDoc,
          permission: rule.permission ?? classRule.permission,
          feature: rule.feature ?? classRule.feature,
          isPublic: rule.isPublic || classRule.isPublic,
          superAdmin: rule.superAdmin || classRule.superAdmin,
          throttled: rule.throttled || classRule.throttled,
          httpCode: rule.httpCode,
          fileField,
          fileOptional: /UploadedFile\(\)\s*\w+\?/.test(params),
          csrf: bodyText.includes('assertCsrfHeader('),
          zodBody: (params.match(/ZodBody\((\w+)\)/) || [])[1],
          inlineQuery,
        });
      }
    });
  }
  return routes;
}

function rulesFrom(decs) {
  const r = {};
  for (const d of decs) {
    if (d.name === 'RequirePermission') r.permission = literal(d.args[0]);
    if (d.name === 'RequireFeature') r.feature = literal(d.args[0]);
    if (d.name === 'Public') r.isPublic = true;
    if (d.name === 'SuperAdminOnly') r.superAdmin = true;
    if (d.name === 'Throttle') r.throttled = true;
    if (d.name === 'HttpCode') r.httpCode = Number(d.args[0]?.getText().replace(/\D/g, '')) || undefined;
  }
  return r;
}

// Swagger can't see the values of Prisma/TS enums used as `@IsEnum(X) prop?: X`
// (they come out as `{}`). Read them from schema.prisma and the source instead,
// and patch them into the spec's component schemas.
function patchEnums(spec) {
  const values = {};
  const prisma = fs.readFileSync(path.join(apiRoot, 'prisma/schema.prisma'), 'utf8');
  for (const m of prisma.matchAll(/^enum\s+(\w+)\s*\{([^}]*)\}/gm)) {
    values[m[1]] = m[2].split('\n').map((l) => l.replace(/\/\/.*/, '').trim().split(/\s+/)[0]).filter((w) => /^\w+$/.test(w));
  }
  const files = [];
  (function w(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) w(p);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) files.push(p);
    }
  })(path.join(apiRoot, 'src'));
  const props = []; // [className, prop, enumName]
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/export\s+enum\s+(\w+)\s*\{([^}]*)\}/g)) {
      values[m[1]] ||= [...m[2].matchAll(/=\s*'([^']+)'|^\s*(\w+)\s*,?$/gm)].map((x) => x[1] || x[2]).filter(Boolean);
    }
    for (const m of src.matchAll(/export\s+const\s+(\w+)\s*=\s*\[([^\]]+)\]\s*as\s+const/g)) {
      values[m[1]] ||= [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    }
    if (!src.includes('IsEnum(')) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
    sf.forEachChild(function visit(node) {
      if (ts.isClassDeclaration(node) && node.name) {
        for (const member of node.members) {
          if (!ts.isPropertyDeclaration(member)) continue;
          const dec = decoratorsOf(member).find((d) => d.name === 'IsEnum');
          if (dec && dec.args[0]) props.push([node.name.text, member.name.getText(), dec.args[0].getText(), /each:\s*true/.test(dec.args[1]?.getText() || '')]);
        }
      }
      ts.forEachChild(node, visit);
    });
  }
  const apply = (schema, enumName, each) => {
    const vals = values[enumName.replace(/^.*\./, '')];
    if (!schema || !vals?.length) return false;
    const e = { type: 'string', enum: vals };
    if (each || schema.type === 'array') Object.assign(schema, { type: 'array', items: e });
    else { delete schema.$ref; delete schema.allOf; Object.assign(schema, e); }
    return true;
  };
  let n = 0;
  const byProp = {};
  for (const [cls, prop, enumName, each] of props) {
    (byProp[prop] ||= new Set()).add(enumName + (each ? '[]' : ''));
    if (apply(spec.components.schemas[cls]?.properties?.[prop], enumName, each)) n++;
  }
  // Inherited properties (class B extends A) appear on B's schema too: patch any
  // still-opaque property whose name maps to exactly one enum across the code.
  for (const schema of Object.values(spec.components.schemas)) {
    for (const [prop, s] of Object.entries(schema.properties || {})) {
      const opaque = (s.type === 'object' && !s.properties) || (s.type === 'array' && s.items?.type === 'object' && !s.items.properties);
      if (!opaque || byProp[prop]?.size !== 1) continue;
      const [name] = byProp[prop];
      if (apply(s, name.replace('[]', ''), name.endsWith('[]'))) n++;
    }
  }
  spec['x-enum-values'] = values;
  return n;
}

// Zod-validated bodies are invisible to Swagger; describe them by hand.
const palette = {
  background: '#FFFFFF', surface: '#F8FAFC', foreground: '#0F172A', mutedForeground: '#64748B',
  border: '#E2E8F0', primary: '#4F46E5', primaryForeground: '#FFFFFF', sidebar: '#0F172A',
  sidebarForeground: '#E2E8F0', sidebarActive: '#4F46E5', success: '#16A34A', warning: '#D97706',
  danger: '#DC2626', info: '#0284C7',
};
const themeTokens = {
  version: 1, light: palette, dark: { ...palette, background: '#0B1120', surface: '#111827', foreground: '#F8FAFC' },
  typography: { font: 'inter', scale: 'md' }, shape: { radius: 8, shadow: 'soft' }, layout: { density: 'comfortable' },
};
const ZOD_BODIES = {
  createThemeSchema: { name: 'Ocean', description: 'Calm blues for the whole company', tokens: themeTokens },
  updateThemeSchema: { name: 'Ocean (v2)' },
  updateThemeSettingsSchema: { superAdminTheme: { kind: 'preset', key: 'default' }, defaultCompanyTheme: { kind: 'preset', key: 'default' } },
};

// ── 2. Sample values from JSON schema ───────────────────────

const PLACEHOLDER_UUID = '00000000-0000-0000-0000-000000000000';
const today = new Date();
const isoDate = (d) => d.toLocaleDateString('en-CA'); // local YYYY-MM-DD
const plusDays = (n) => isoDate(new Date(today.getTime() + n * 86400000));

function sampleString(name, s) {
  const n = (name || '').toLowerCase();
  if (s.format === 'uuid' || /(^id$|id$|ids$)/.test(n)) return PLACEHOLDER_UUID;
  if (s.format === 'email' || n.includes('email')) return 'jane.doe@example.com';
  if (s.format === 'date-time' || /(at$|datetime|timestamp)/.test(n)) return `${plusDays(3)}T09:30:00.000Z`;
  if (s.format === 'date' || /(date|^from$|^to$|day$|dob|birthday|until|since|start$|end$)/.test(n)) {
    return n.includes('end') || n === 'to' || n.includes('until') ? plusDays(5) : plusDays(3);
  }
  if (s.format === 'uri' || s.format === 'url' || n.endsWith('url')) return 'https://example.com';
  if (n.includes('password')) return 'ChangeMe123!';
  if (n.includes('phone') || n.includes('mobile')) return '+919876543210';
  if (n.includes('color') || n.includes('colour') || String(s.pattern).includes('#')) return '#4F46E5';
  if (/time$/.test(n) || /^\^?\\?d\{2\}:/.test(String(s.pattern))) return '09:30';
  const FIXED = {
    city: 'Bengaluru', state: 'Karnataka', country: 'India', line1: '12 MG Road', line2: 'Indiranagar', postalcode: '560038',
    emoji: '🎉', timezone: 'Asia/Kolkata', vendor: 'Dell', brand: 'Dell', model: 'Latitude 5440', serialnumber: 'SN-0001',
    employeeidprefix: 'EMP', label: 'Sample label', tag: 'sample', checkin: '09:30', checkout: '18:30', bloodgroup: 'O+',
    designationcontains: 'Engineer', icon: 'star', key: 'sample-key', pan: 'ABCDE1234F', aadhaar: '234123412346',
    uan: '100000000001', accountnumber: '000123456789', ifsc: 'HDFC0000123', esicnumber: '3100000000',
    pfaccountno: 'KN/BNG/0000000/000/0000001', emergencycontactrelation: 'Parent', coveremoji: '🎉', sticker: '🎉',
    eventplace: 'Cafeteria', prefix: 'EMP', reference: 'REF-001', queue: 'it', department: 'Engineering',
    designation: 'Software Engineer', location: 'Bengaluru', value: 'Sample value',
    csv: 'firstName,lastName,email\nJane,Doe,jane.doe@example.com',
  };
  if (FIXED[n]) return FIXED[n];
  if (s.pattern === 'DATE' || /^(valid|due|needed|loan)(from|to|on|back|by)?$/.test(n) || /^(valid|due|needed|loan)/.test(n))
    return n.includes('to') || n.includes('back') ? plusDays(30) : plusDays(3);
  if (/^(starts|ends)at$/.test(n)) return `${plusDays(n.startsWith('ends') ? 4 : 3)}T09:30:00.000Z`;
  if (/(question|issue|resolution|handover|greeting|tagline)/.test(n)) return 'Sample text for testing';
  if (n === 'firstname') return 'Jane';
  if (n === 'lastname') return 'Doe';
  if (n.includes('slug') || n.includes('workspace')) return 'acme';
  if (n === 'code' || n.endsWith('code')) return 'CODE1';
  if (n === 'currency') return 'INR';
  if (n === 'month') return isoDate(today).slice(0, 7);
  if (n === 'year') return String(today.getFullYear());
  if (n.includes('token')) return '<token from email>';
  if (n === 'search' || n === 'q') return 'jane';
  if (n.includes('reason') || n.includes('note') || n.includes('comment') || n.includes('message') || n.includes('body'))
    return 'Sample text for testing';
  if (n.includes('description')) return 'Short description';
  if (n.includes('title') || n.includes('subject')) return 'Sample title';
  if (n.includes('name')) return 'Sample name';
  if (s.pattern === '^[A-Za-z]$') return 'A';
  if (s.pattern && /\^\[a-z0-9-\]/.test(s.pattern)) return 'sample-key';
  let v = 'string';
  if (s.maxLength && v.length > s.maxLength) v = v.slice(0, s.maxLength);
  return v;
}

function sample(schema, spec, name, depth = 0, seen = new Set()) {
  if (!schema) return undefined;
  if (schema.$ref) {
    const key = schema.$ref.split('/').pop();
    if (seen.has(key) || depth > 6) return {};
    return sample(spec.components.schemas[key], spec, name, depth + 1, new Set([...seen, key]));
  }
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return schema.enum[0];
  if (schema.allOf) return Object.assign({}, ...schema.allOf.map((s) => sample(s, spec, name, depth + 1, seen)));
  if (schema.oneOf || schema.anyOf) return sample((schema.oneOf || schema.anyOf)[0], spec, name, depth + 1, seen);
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
  switch (type) {
    case 'object':
    case undefined: {
      if (!schema.properties) {
        const OBJECTS = {
          themeTokens, specs: { cpu: 'Intel i7', ram: '16 GB', storage: '512 GB SSD' },
          address: { line1: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', country: 'India', postalCode: '560038' },
        };
        if (OBJECTS[name]) return OBJECTS[name];
        return type === 'object' ? {} : 'string';
      }
      const o = {};
      for (const [k, v] of Object.entries(schema.properties)) o[k] = sample(v, spec, k, depth + 1, seen);
      return o;
    }
    case 'array':
      return [sample(schema.items, spec, singular(name || ''), depth + 1, seen)].filter((x) => x !== undefined);
    case 'integer':
    case 'number': {
      const n = (name || '').toLowerCase();
      if (n === 'page') return 1;
      if (n === 'limit' || n === 'pagesize') return 20;
      if (n === 'year') return today.getFullYear();
      if (n === 'month') return today.getMonth() + 1;
      if (schema.minimum !== undefined) return Math.max(schema.minimum, schema.minimum === 0 ? 1 : schema.minimum);
      return type === 'integer' ? 1 : 1.5;
    }
    case 'boolean':
      return false;
    case 'string':
      return sampleString(name, schema);
    default:
      return null;
  }
}

function resolve(schema, spec) {
  let s = schema;
  for (let i = 0; s && s.$ref && i < 10; i++) s = spec.components.schemas[s.$ref.split('/').pop()];
  return s || {};
}

function describeSchema(s, spec) {
  s = resolve(s, spec);
  const bits = [];
  const type = Array.isArray(s.type) ? s.type.join('|') : s.type;
  if (s.enum) bits.push('one of: ' + s.enum.map((e) => `\`${e}\``).join(', '));
  else if (type) bits.push(type + (s.format ? ` (${s.format})` : ''));
  if (s.minimum !== undefined || s.maximum !== undefined) bits.push(`range ${s.minimum ?? '…'}–${s.maximum ?? '…'}`);
  if (s.minLength || s.maxLength) bits.push(`length ${s.minLength ?? 0}–${s.maxLength ?? '…'}`);
  if (s.pattern && /[\^$\\[(]/.test(s.pattern)) bits.push(`pattern \`${s.pattern}\``);
  else if (s.pattern === 'DATE') bits.push('date `YYYY-MM-DD`');
  return bits.join(', ');
}

// ── 3. Example capture (optional, --capture) ────────────────

async function login(email, password, extra) {
  const res = await fetch(`${API_URL}${PREFIX}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, ...extra }),
  });
  if (!res.ok) throw new Error(`login ${email} → ${res.status}`);
  return (await res.json()).data.access_token;
}

const SECRET_KEY = /(token|secret|password|hash|otp|totp|api_?key|cookie|signature)/i;
const EMAIL = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

function trim(v, depth = 0) {
  if (Array.isArray(v)) return v.slice(0, 2).map((x) => trim(x, depth + 1));
  if (v && typeof v === 'object') {
    if (depth > 8) return {};
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = SECRET_KEY.test(k) && typeof x === 'string' ? '<redacted>' : trim(x, depth + 1);
    return o;
  }
  if (typeof v === 'string') {
    let s = v.replace(EMAIL, (m, local, domain) => (/(yopmail\.com|example\.com)$/i.test(domain) ? m : `${local.split(/[._+]/)[0]}@example.com`));
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s) || s.startsWith('::')) s = '127.0.0.1';
    return s.length > 400 ? s.slice(0, 400) + '…' : s;
  }
  return v;
}

async function capture(spec) {
  const company = {
    email: process.env.POSTMAN_COMPANY_EMAIL || 'rohan.kapoor.seedsai@yopmail.com',
    password: process.env.POSTMAN_COMPANY_PASSWORD || process.env.SEEDSAI_PASSWORD,
    slug: process.env.POSTMAN_COMPANY_SLUG || 'seedsai',
  };
  const tokens = {};
  if (company.password) tokens.company = await login(company.email, company.password, { portal: 'company', companySlug: company.slug });
  if (process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD)
    tokens.platform = await login(process.env.SUPER_ADMIN_EMAIL, process.env.SUPER_ADMIN_PASSWORD, { portal: 'platform' });
  if (!Object.keys(tokens).length) throw new Error('No credentials for --capture (SEEDSAI_PASSWORD / SUPER_ADMIN_* in apps/api/.env)');

  const SKIP = /(download|export|\.csv|\/file$|\/files?\/|avatar|logo|favicon|photo|cover|attachment|receipt|preview|stream|events|\/raw$|queues|bull)/i;
  const examples = {};
  const listCache = {};
  const gets = Object.entries(spec.paths)
    .filter(([p, ops]) => ops.get && !SKIP.test(p))
    .sort(([a], [b]) => a.split('{').length - b.split('{').length || a.localeCompare(b));

  const firstId = (body) => {
    const d = body?.data;
    const arr = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : Array.isArray(d?.rows) ? d.rows : null;
    return arr?.find((x) => x && typeof x.id === 'string')?.id;
  };

  for (const [p] of gets) {
    let url = p;
    const params = [...p.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (params.length) {
      // Fill path ids from the parent list we already fetched (/things → /things/{id}).
      let ok = true;
      for (const param of params) {
        const before = url.slice(0, url.indexOf(`{${param}}`)).replace(/\/$/, '');
        const id = listCache[before];
        if (!id) { ok = false; break; }
        url = url.replace(`{${param}}`, id);
      }
      if (!ok) continue;
    }
    for (const who of ['company', 'platform']) {
      if (!tokens[who]) continue;
      if (who === 'company' && /^\/api\/v1\/(admin|plans)\b/.test(p)) continue;
      let res;
      try {
        res = await fetch(API_URL + url + (url.includes('?') ? '' : '?limit=5'), { headers: { authorization: `Bearer ${tokens[who]}` } });
      } catch { continue; }
      if (!(res.headers.get('content-type') || '').includes('json')) break;
      if (res.status === 401 || res.status === 403 || res.status === 404) continue;
      const body = await res.json().catch(() => null);
      if (!body) break;
      if (res.ok) {
        const id = firstId(body);
        if (id) listCache[p.replace(/\/$/, '')] = id;
      }
      examples[`get ${p}`] = { status: res.status, as: who, body: trim(body) };
      break;
    }
  }

  // A few canonical error shapes, so the collection shows them once.
  const bad = await fetch(`${API_URL}${PREFIX}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  examples['error 400'] = { status: bad.status, body: trim(await bad.json()) };
  const unauth = await fetch(`${API_URL}${PREFIX}/people`);
  examples['error 401'] = { status: unauth.status, body: trim(await unauth.json()) };

  fs.writeFileSync(examplesFile, JSON.stringify(examples, null, 2) + '\n');
  console.log(`captured ${Object.keys(examples).length} example responses → ${path.relative(repoRoot, examplesFile)}`);
  return examples;
}

// ── 4. Collection building ──────────────────────────────────

const FOLDER_ORDER = [
  'Authentication', 'Account', 'Access', 'Users', 'Roles', 'Delegations', 'Organisation', 'Departments', 'Designations',
  'Locations', 'Employees', 'EmployeeProfile', 'EmployeeDocuments', 'ExperienceReviews', 'People', 'Attendance',
  'Holidays', 'Leave', 'Timesheets', 'Projects', 'ResourceRequests', 'Expenses', 'Assets', 'Helpdesk', 'Announcements',
  'Kudos', 'Celebrations', 'Notifications', 'Reports', 'Themes', 'Seasons', 'Companies', 'Admin', 'Admin — Plans',
  'Admin — System', 'Admin — Platform admins', 'Platform', 'Health', 'Root',
];
const FOLDER_LABEL = {
  EmployeeProfile: 'Employee profile', EmployeeDocuments: 'Employee documents', ExperienceReviews: 'Experience reviews',
  ResourceRequests: 'Resource requests', Organisation: 'Organisation (org chart, levels)', Root: 'Root',
};
const FOLDER_NOTE = {
  Authentication: 'Sign in, sign out, password reset, email verification and session management. Start with **Login** — it stores `accessToken` for every other request.',
  Companies: 'Super Admin (platform) company management, plus company branding uploads.',
  Admin: 'Super Admin console: companies, admins, usage. Sign in with the Super Admin environment.',
  'Admin — Plans': 'Super Admin: subscription plans, per-company features and limits.',
  'Admin — System': 'Super Admin: health checks, email outbox, locked users, caches.',
  'Admin — Platform admins': 'Super Admin: other platform administrators.',
  Health: 'Liveness/readiness probes. No `/api/v1` prefix, no auth.',
};

const METHOD_VERB = { get: 'Get', post: 'Create', put: 'Replace', patch: 'Update', delete: 'Delete' };

function requestName(method, p, op, src) {
  if (op.summary) return op.summary.replace(/\.$/, '');
  if (src?.handler) {
    const h = humanize(src.handler);
    // Bare CRUD verbs read badly ("List") — add the resource.
    if (/^(list|get|create|update|remove|delete|find all|find one|find|upsert|save|set|archive|restore)$/i.test(h)) {
      const segs = p.split('/').filter((s) => s && !s.startsWith('{') && s !== 'api' && s !== 'v1');
      return `${h} ${humanize(segs.at(-1) || '').toLowerCase()}`.trim();
    }
    return h;
  }
  const segs = p.split('/').filter((s) => s && !s.startsWith('{') && s !== 'api' && s !== 'v1');
  return `${METHOD_VERB[method]} ${humanize(segs.at(-1) || 'root').toLowerCase()}`;
}

function accessLine(src) {
  if (!src) return '';
  if (src.isPublic) return '**Access:** public — no token needed.';
  const parts = [];
  if (src.superAdmin) parts.push('Super Admin only (sign in with `portal: "platform"`)');
  if (src.permission) parts.push(`permission \`${src.permission}\``);
  if (src.feature) parts.push(`company feature \`${src.feature}\` must be on`);
  if (!parts.length) parts.push('any signed-in user (results are scoped to the caller)');
  return `**Access:** ${parts.join(' · ')}`;
}

function subfolderKey(p, tag, count) {
  if (count <= 14) return null;
  const segs = p.replace(PREFIX, '').split('/').filter(Boolean);
  const rest = segs.slice(1);
  if (tag.startsWith('Admin')) return humanize(segs[1] && !segs[1].startsWith('{') ? segs[1] : 'general');
  const seg = rest.find((s) => !s.startsWith('{'));
  return seg ? humanize(seg) : 'General';
}

function buildItem(method, p, op, spec, src, examples) {
  const isHealth = !p.startsWith(PREFIX);
  const pathSegs = p.split('/').filter(Boolean).map((s) => (s.startsWith('{') ? ':' + s.slice(1, -1) : s));
  const params = op.parameters || [];
  const pathParams = params.filter((x) => x.in === 'path');
  const queryParams = params
    .filter((x) => x.in === 'query')
    .map((x) => {
      const inline = src?.inlineQuery?.[x.name];
      if (!inline) return x;
      const vals = spec['x-enum-values']?.[inline.type];
      return { ...x, required: !inline.optional, schema: vals ? { type: 'string', enum: vals } : x.schema };
    });

  const segsNoParams = p.split('/');
  const pathVars = pathParams.map((x) => {
    const idx = segsNoParams.indexOf(`{${x.name}}`);
    const owner = idx > 0 ? singular(segsNoParams[idx - 1]) : 'record';
    return {
      key: x.name,
      value: '',
      description: x.description || (/id$/i.test(x.name) ? `UUID of the ${humanize(owner).toLowerCase()}` : humanize(x.name)),
    };
  });

  const query = queryParams.map((x) => {
    let v = sample(x.schema, spec, x.name);
    // Filters look backwards: use today (reports reject future days), and weeks start on Monday.
    if (/^weekstart$/i.test(x.name)) v = isoDate(new Date(today.getTime() - ((today.getDay() + 6) % 7) * 86400000));
    else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) v = isoDate(today);
    return {
      key: x.name,
      value: v === undefined || v === null ? '' : String(Array.isArray(v) ? v[0] : v),
      description: [x.required ? '(required)' : '(optional)', x.description, describeSchema(x.schema, spec)].filter(Boolean).join(' '),
      disabled: !x.required,
    };
  });

  const headers = [];
  let body;
  const bodySchema = op.requestBody?.content?.['application/json']?.schema || op.requestBody?.content?.['multipart/form-data']?.schema;
  if (src?.fileField) {
    const formdata = [{ key: src.fileField, type: 'file', src: [], description: `${src.fileOptional ? '(optional)' : '(required)'} file to upload` }];
    if (bodySchema) {
      const s = resolve(bodySchema, spec);
      const ex = sample(bodySchema, spec) || {};
      for (const [k, v] of Object.entries(s.properties || {})) {
        if (k === src.fileField) continue;
        const val = ex[k];
        formdata.push({
          key: k,
          type: 'text',
          value: val === undefined || val === null ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val),
          description: [(s.required || []).includes(k) ? '(required)' : '(optional)', describeSchema(v, spec)].join(' '),
          disabled: !(s.required || []).includes(k),
        });
      }
    }
    body = { mode: 'formdata', formdata };
  } else if (src?.zodBody && ZOD_BODIES[src.zodBody]) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
    body = { mode: 'raw', raw: JSON.stringify(ZOD_BODIES[src.zodBody], null, 2), options: { raw: { language: 'json' } } };
  } else if (bodySchema) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
    body = { mode: 'raw', raw: JSON.stringify(sample(bodySchema, spec) ?? {}, null, 2), options: { raw: { language: 'json' } } };
  }
  if (src?.csrf) headers.push({ key: 'X-HRMS-CSRF', value: '1', description: 'Required: proves the call comes from a script, not a cross-site form' });

  // Description
  const d = [];
  const purpose = [op.summary && op.description ? op.description : op.description || (op.summary ? null : null), src?.doc].filter(Boolean);
  if (purpose.length) d.push(purpose.join('\n\n'));
  else d.push(`${requestName(method, p, op, src)} — \`${method.toUpperCase()} ${p}\`.`);
  const access = accessLine(src);
  if (access) d.push(access);
  if (pathVars.length) d.push('**Path parameters:** ' + pathVars.map((v) => `\`${v.key}\` — ${v.description}`).join('; '));
  if (query.length) d.push('**Query parameters** (enable the ones you need in the Params tab):\n' + query.map((q) => `- \`${q.key}\` ${q.description}`).join('\n'));
  if (bodySchema && !src?.fileField) {
    const s = resolve(bodySchema, spec);
    const req = s.required || [];
    if (s.properties) {
      d.push(
        '**Body fields:**\n' +
          Object.entries(s.properties)
            .map(([k, v]) => `- \`${k}\`${req.includes(k) ? ' **(required)**' : ''} — ${[resolve(v, spec).description, describeSchema(v, spec)].filter(Boolean).join('; ')}`)
            .join('\n'),
      );
    }
  }
  if (src?.fileField) d.push(`**Upload:** \`multipart/form-data\` — pick a file for the \`${src.fileField}\` field in the Body tab.`);
  if (src?.throttled) d.push('**Rate limited:** stricter per-IP limit than other endpoints.');
  if (src?.httpCode === 204) d.push('Returns **204 No Content** on success.');
  if (src) d.push(`_Source: \`${src.file}:${src.line}\` (${src.controller}.${src.handler})_`);

  const request = {
    method: method.toUpperCase(),
    header: headers,
    url: {
      raw: `{{baseUrl}}/${pathSegs.join('/')}` + (query.some((q) => !q.disabled) ? '?' + query.filter((q) => !q.disabled).map((q) => `${q.key}=${q.value}`).join('&') : ''),
      host: ['{{baseUrl}}'],
      path: pathSegs,
      ...(query.length ? { query } : {}),
      ...(pathVars.length ? { variable: pathVars } : {}),
    },
    description: d.join('\n\n'),
  };
  if (body) request.body = body;
  if (src?.isPublic || isHealth) request.auth = { type: 'noauth' };

  // Example responses
  const response = [];
  const captured = examples[`${method} ${p}`];
  if (captured) {
    response.push(exampleResponse(`${captured.status} — sample (${captured.as === 'platform' ? 'Super Admin' : 'company admin'}, seeded data)`, request, captured.status, captured.body));
  } else {
    for (const [code, r] of Object.entries(op.responses || {})) {
      const s = r.content?.['application/json']?.schema;
      if (!s || !/^2/.test(code)) continue;
      const ex = sample(s, spec);
      if (ex === undefined || ex === 'string' || (ex && typeof ex === 'object' && !Object.keys(ex).length)) continue;
      const wrapped = ex && typeof ex === 'object' && 'data' in ex ? ex : { data: ex, meta: { request_id: 'req_0000' } };
      response.push(exampleResponse(`${code} — shape from schema`, request, Number(code), wrapped));
      break;
    }
  }

  return { name: requestName(method, p, op, src), request, response };
}

function exampleResponse(name, request, status, body) {
  const STATUS = { 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found' };
  return {
    name,
    originalRequest: { method: request.method, header: request.header, url: request.url, ...(request.body ? { body: request.body } : {}) },
    status: STATUS[status] || 'OK',
    code: status,
    _postman_previewlanguage: 'json',
    header: [{ key: 'Content-Type', value: status >= 400 ? 'application/problem+json' : 'application/json' }],
    body: JSON.stringify(body, null, 2),
  };
}

const AUTO_LOGIN = `// Signs in automatically when accessToken is missing or about to expire,
// using email / password / portal / companySlug from the active environment.
const url = pm.request.url.toString();
const isPublic = pm.request.auth && pm.request.auth.type === 'noauth';
if (isPublic || url.includes('/auth/login')) return;

const token = pm.environment.get('accessToken');
const expiresAt = Number(pm.environment.get('accessTokenExpiresAt') || 0);
if (token && Date.now() < expiresAt - 30000) return;

const email = pm.environment.get('email');
const password = pm.environment.get('password');
if (!email || !password) return; // nothing to sign in with: send as-is

const body = { email, password };
const portal = pm.environment.get('portal');
const slug = pm.environment.get('companySlug');
if (portal) body.portal = portal;
if (slug && portal !== 'platform') body.companySlug = slug;

pm.sendRequest({
  url: pm.environment.get('baseUrl') + '/api/v1/auth/login',
  method: 'POST',
  header: { 'Content-Type': 'application/json' },
  body: { mode: 'raw', raw: JSON.stringify(body) },
}, (err, res) => {
  if (err || res.code !== 200) { console.warn('Auto-login failed', err || res.code); return; }
  const d = res.json().data;
  pm.environment.set('accessToken', d.access_token);
  pm.environment.set('accessTokenExpiresAt', String(Date.now() + (d.expires_in || 900) * 1000));
});`;

const SAVE_TOKEN = `// Saves the token for every other request in the collection.
if (pm.response.code === 200) {
  const d = pm.response.json().data;
  pm.environment.set('accessToken', d.access_token);
  pm.environment.set('accessTokenExpiresAt', String(Date.now() + (d.expires_in || 900) * 1000));
  pm.test('access token saved', () => pm.expect(d.access_token).to.be.a('string'));
}`;

const COLLECTION_DOC = `REST API for the HRMS Portal (NestJS). Generated from the live OpenAPI spec and the controller source by \`apps/api/scripts/postman/build-postman.mjs\` — regenerate rather than hand-edit.

## Setup
1. Import this collection and one of the environments (**HRMS · Local · Company user** or **HRMS · Local · Super Admin**).
2. In the environment, set \`baseUrl\` (default \`http://localhost:4000\`), \`email\` and \`password\` (and \`companySlug\` for company users). Use the **Current value** column so credentials stay on your machine.
3. Select the environment and send any request. A collection pre-request script signs in automatically and refreshes the token when it expires (15 min). You can also run **Authentication → Login** by hand.

## Conventions
- **Base path:** every route is under \`/api/v1\` except \`/health\` and \`/health/ready\`.
- **Auth:** \`Authorization: Bearer {{accessToken}}\` (set at collection level). Public endpoints override it with *No Auth*.
- **Two portals:** \`portal: "platform"\` = Super Admins only; \`portal: "company"\` (+ \`companySlug\`) = company users only. Company data is always scoped to the caller's company — another company's ids return **404**, not 403.
- **Requests** are camelCase JSON. **Responses** are snake_case, wrapped as \`{ "data": …, "meta": { "request_id": … } }\`; lists add paging info to \`meta\`.
- **Paging:** list endpoints take \`page\` (1-based) and \`limit\` (max usually 100–200).
- **Errors** are RFC 7807 \`application/problem+json\`: \`{ type, title, status, detail, instance }\` (+ \`errors\` for validation).
- **Access:** each request's description lists the permission (e.g. \`leave.approve\`) and/or company feature it needs. Missing permission → 403.
- **Uploads** use \`multipart/form-data\`; pick the file in the Body tab.
- **Path ids** are left blank — copy an \`id\` from a list response into the Params tab. Body samples use \`${PLACEHOLDER_UUID}\` where an id is needed.
- **Live updates** (WebSocket, Socket.IO) are not part of this collection — see \`docs/realtime.md\`.
- **Swagger UI:** \`{{baseUrl}}/api/docs\` (non-production only).`;

async function main() {
  const res = await fetch(`${API_URL}/api/docs-json`).catch((e) => {
    throw new Error(`Cannot reach ${API_URL}/api/docs-json — start the API in dev mode first (${e.message})`);
  });
  if (!res.ok) throw new Error(`${API_URL}/api/docs-json → ${res.status}`);
  const spec = await res.json();
  const routes = scanControllers();
  patchEnums(spec);

  const examples = process.argv.includes('--capture')
    ? await capture(spec)
    : fs.existsSync(examplesFile)
      ? JSON.parse(fs.readFileSync(examplesFile, 'utf8'))
      : {};

  // Group by tag
  const byTag = {};
  let total = 0;
  const unmatched = [];
  for (const [p, ops] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(ops)) {
      if (!HTTP[method[0].toUpperCase() + method.slice(1)]) continue;
      const key = `${method} ${p.startsWith(PREFIX) ? p.slice(PREFIX.length) || '/' : p}`;
      const src = routes.get(key);
      if (!src) unmatched.push(key);
      const tag = (op.tags && op.tags[0]) || 'Root';
      (byTag[tag] ||= []).push({ method, p, op, src });
      total++;
    }
  }

  const order = (t) => (FOLDER_ORDER.indexOf(t) === -1 ? 999 : FOLDER_ORDER.indexOf(t));
  const folders = Object.keys(byTag)
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
    .map((tag) => {
      const ops = byTag[tag];
      const methodRank = { get: 0, post: 1, put: 2, patch: 3, delete: 4 };
      ops.sort((a, b) => a.p.localeCompare(b.p) || methodRank[a.method] - methodRank[b.method]);
      const items = ops.map((o) => {
        const item = buildItem(o.method, o.p, o.op, spec, o.src, examples);
        if (o.p === `${PREFIX}/auth/login` && o.method === 'post') {
          item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: SAVE_TOKEN.split('\n') } }];
          item.request.body.raw = JSON.stringify(
            { email: '{{email}}', password: '{{password}}', portal: '{{portal}}', companySlug: '{{companySlug}}' },
            null,
            2,
          );
          item.request.description += '\n\nFor a Super Admin, use `"portal": "platform"` and drop `companySlug`.';
          for (const k of ['400', '401']) {
            const e = examples[`error ${k}`];
            if (e) item.response.push(exampleResponse(`${e.status} — error shape`, item.request, e.status, e.body));
          }
        }
        return { key: subfolderKey(o.p, tag, ops.length), item };
      });

      const loose = items.filter((i) => !i.key).map((i) => i.item);
      const groups = {};
      for (const i of items.filter((i) => i.key)) (groups[i.key] ||= []).push(i.item);
      const groupItems = Object.entries(groups)
        .sort(([a], [b]) => (a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b)))
        .map(([name, item]) => ({ name, item }));
      const classDoc = ops.map((o) => o.src?.classDoc).find(Boolean);
      return {
        name: FOLDER_LABEL[tag] || tag,
        description: [FOLDER_NOTE[tag], classDoc].filter(Boolean).join('\n\n') || undefined,
        item: [...loose, ...groupItems],
      };
    });

  const collection = {
    info: {
      name: 'HRMS Portal API',
      description: COLLECTION_DOC,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
    event: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: AUTO_LOGIN.split('\n') } }],
    variable: [{ key: 'baseUrl', value: 'http://localhost:4000', description: 'Fallback when no environment is selected' }],
    item: folders,
  };

  const env = (name, values) => ({
    name,
    values: [
      { key: 'baseUrl', value: 'http://localhost:4000', type: 'default', enabled: true },
      ...values,
      { key: 'accessToken', value: '', type: 'secret', enabled: true },
      { key: 'accessTokenExpiresAt', value: '', type: 'default', enabled: true },
    ],
    _postman_variable_scope: 'environment',
  });
  const environments = {
    'HRMS.local.company.postman_environment.json': env('HRMS · Local · Company user', [
      { key: 'email', value: 'rohan.kapoor.seedsai@yopmail.com', type: 'default', enabled: true },
      { key: 'password', value: '', type: 'secret', enabled: true },
      { key: 'portal', value: 'company', type: 'default', enabled: true },
      { key: 'companySlug', value: 'seedsai', type: 'default', enabled: true },
    ]),
    'HRMS.local.super-admin.postman_environment.json': env('HRMS · Local · Super Admin', [
      { key: 'email', value: '', type: 'default', enabled: true },
      { key: 'password', value: '', type: 'secret', enabled: true },
      { key: 'portal', value: 'platform', type: 'default', enabled: true },
      { key: 'companySlug', value: '', type: 'default', enabled: true },
    ]),
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'HRMS.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
  for (const [file, e] of Object.entries(environments)) fs.writeFileSync(path.join(outDir, file), JSON.stringify(e, null, 2) + '\n');

  const withExamples = folders.flatMap(function flat(f) { return f.item.flatMap((i) => (i.item ? flat(i) : [i])); }).filter((i) => i.response.length).length;
  console.log(`${total} requests in ${folders.length} folders · ${withExamples} with example responses → ${path.relative(repoRoot, outDir)}`);
  if (unmatched.length) console.log(`no controller match (no access/upload info) for ${unmatched.length}:\n  ` + unmatched.join('\n  '));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
