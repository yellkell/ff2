/**
 * THE BANK — iron-dollars for money. Mounted at /bank on THE ROOM SERVER
 * (room.mjs); runs alone on :8791 with `npm run server:bank`.
 *
 * The headset never touches a card and never says how many coins it has
 * bought. It asks here for a CHECKOUT (a Stripe-hosted page), pays there,
 * Stripe tells this server it was paid (a signed webhook), this server
 * writes the coins into THE LEDGER, and the headset CLAIMS them:
 *
 *   GET  /            the catalogue: mode, currency, packs      (public)
 *   POST /checkout    {pack} → {id, url, short, pack}           (signed)
 *   GET  /go/<code>   the short link → 302 to the checkout      (public)
 *   POST /webhook     Stripe's word that a session was paid     (Stripe)
 *   POST /claim       {} → {coins, credit, claimed, email}      (signed)
 *   GET  /whoami      {uid, protected, email (masked)}          (signed)
 *   POST /protect     {email} → attach it to this uid           (signed)
 *   POST /handoff     {} → {code} for a new headset to redeem   (signed)
 *   POST /redeem      {code} → {token} that signs it in as you  (public)
 *
 * SIGNED means a Firebase ID token in `Authorization: Bearer …`, verified
 * here with the same service account that writes the ledger — the uid in
 * the token is the uid that is credited, and nothing the client sends can
 * name another. The ledger is `bank/{uid}` in Firestore: `credit` (what
 * Stripe has paid for, ever), `claimed` (what the headset has collected),
 * and one receipt per checkout session, so a webhook Stripe retries
 * credits nothing twice. Claiming is a transaction: owed = credit −
 * claimed, and claimed becomes credit in the same write.
 *
 * MODES. With STRIPE_SECRET_KEY + FIREBASE_SERVICE_ACCOUNT set this is a
 * bank ('live' with an sk_live key, 'test' with sk_test — Stripe's own
 * test cards, no real money). With either missing — or BANK_DEV=1 — it is
 * 'dev': the checkout is a page this server serves with one PAY button,
 * the ledger is in memory, and an unsigned `x-dev-uid` header stands in
 * for a token. Dev mode charges nobody and forgets everything on restart;
 * a Stripe key without a ledger to write is refused outright, because a
 * charge that cannot be recorded is a charge that cannot be honoured.
 *
 * The SHORT LINK exists because a Stripe checkout URL runs to four
 * hundred characters and the panel's QR encoder (src/ui/qr.ts) holds two
 * hundred: /go/<8 chars> redirects, and is kept in memory for as long as
 * the session can be paid (half an hour).
 *
 *   STRIPE_SECRET_KEY        sk_test_… / sk_live_…
 *   STRIPE_WEBHOOK_SECRET    whsec_… for the /bank/webhook endpoint
 *   FIREBASE_SERVICE_ACCOUNT the service-account JSON (raw or base64)
 *   BANK_CURRENCY            ISO code, default gbp
 *   BANK_MANAGED=1           Stripe Managed Payments (merchant of record) —
 *                            only after activating it in the dashboard
 *   BANK_TAX_CODE            the packs' Stripe tax code (default the general
 *                            electronically-supplied-services code)
 *   PUBLIC_URL               where paid.html lives (default https://ff2.web.app)
 *   BANK_REQUIRE_TOS=1       ask Stripe to collect terms consent (needs the
 *                            terms URL set in the Stripe dashboard)
 *   BANK_DEV=1               force dev mode
 */

import { randomBytes } from 'node:crypto';
import { isMain, serve } from './mount.mjs';

const PORT = Number(process.env.PORT || 8791);
const CURRENCY = (process.env.BANK_CURRENCY || 'gbp').toLowerCase();
/**
 * MANAGED PAYMENTS: Stripe as the merchant of record — it charges, files
 * and pays the VAT (or sales tax) of wherever the buyer is, and handles
 * the cooling-off rules. Switch it on with BANK_MANAGED=1 AFTER activating
 * it in the Stripe dashboard (Settings → Managed Payments, terms accepted,
 * eligibility passed); the flag alone is refused by Stripe until then.
 * Every line item must then carry a tax code Stripe deems eligible:
 * BANK_TAX_CODE, default the general "electronically supplied services"
 * code. Prices are TAX-INCLUSIVE — the pack price on the board is what the
 * buyer pays, the way a UK shelf price is.
 */
const MANAGED = process.env.BANK_MANAGED === '1';
const TAX_CODE = process.env.BANK_TAX_CODE || 'txcd_10000000';
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://ff2.web.app').replace(/\/$/, '');
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const FORCE_DEV = process.env.BANK_DEV === '1';
/** How long a checkout (and its short link) is kept: Stripe's minimum
 *  session life is 30 minutes; the client calls it expired at 25. */
const SESSION_TTL_MS = 35 * 60 * 1000;
/** Open checkouts one uid may hold at once — a tap-happy panel, not an attack. */
const MAX_OPEN_PER_UID = 6;

/**
 * THE PACKS. The server's list is the one that charges; the client's copy
 * (src/net/bank.ts FALLBACK_PACKS) is only what the board draws before
 * this answers. `minor` is the price in the currency's minor unit.
 */
export const PACKS = [
  { id: 'pocket', name: 'POCKET CHANGE', coins: 500, minor: 199, blurb: 'a deck and a piece' },
  { id: 'purse', name: 'THE PURSE', coins: 1300, minor: 449, blurb: 'most of a shelf' },
  { id: 'strongbox', name: 'STRONGBOX', coins: 3000, minor: 899, best: true, blurb: 'the forge, and change' },
  { id: 'vault', name: 'THE VAULT', coins: 7000, minor: 1799, blurb: 'the whole store, near enough' },
];

/* ── the ledger ──────────────────────────────────────────────────────── */

/** Dev only: forgets everything on restart. */
class MemoryLedger {
  persistent = false;
  accounts = new Map(); // uid → { credit, claimed, receipts: Map }
  account(uid) {
    let a = this.accounts.get(uid);
    if (!a) {
      a = { credit: 0, claimed: 0, receipts: new Map() };
      this.accounts.set(uid, a);
    }
    return a;
  }
  async credit(uid, receipt, coins, meta) {
    const a = this.account(uid);
    if (a.receipts.has(receipt)) return { credited: false, duplicate: true, credit: a.credit };
    a.receipts.set(receipt, { coins, ...meta, at: Date.now() });
    a.credit += coins;
    if (meta.email) a.lastEmail = meta.email;
    return { credited: true, credit: a.credit };
  }
  async claim(uid) {
    const a = this.account(uid);
    const owed = Math.max(0, a.credit - a.claimed);
    a.claimed = a.credit;
    return { coins: owed, credit: a.credit, claimed: a.claimed, email: a.lastEmail ?? '' };
  }
}

/** The real thing: `bank/{uid}` + `bank/{uid}/receipts/{session}`. */
class FirestoreLedger {
  persistent = true;
  constructor(db) {
    this.db = db;
  }
  async credit(uid, receipt, coins, meta) {
    const acct = this.db.collection('bank').doc(uid);
    const rcpt = acct.collection('receipts').doc(receipt);
    return this.db.runTransaction(async (tx) => {
      const r = await tx.get(rcpt);
      if (r.exists) return { credited: false, duplicate: true, credit: (await tx.get(acct)).data()?.credit ?? 0 };
      const a = await tx.get(acct);
      const prev = a.exists ? a.data() : {};
      const credit = (prev.credit ?? 0) + coins;
      tx.set(rcpt, { coins, ...meta, at: Date.now() });
      // The email typed at the checkout is kept so the board can offer to
      // PROTECT the account with it — it is the player's own, handed back
      // only to the player's own signed session.
      tx.set(acct, { credit, claimed: prev.claimed ?? 0, at: Date.now(), lastEmail: meta.email || prev.lastEmail || '' }, { merge: true });
      return { credited: true, credit };
    });
  }
  async claim(uid) {
    const acct = this.db.collection('bank').doc(uid);
    return this.db.runTransaction(async (tx) => {
      const a = await tx.get(acct);
      if (!a.exists) return { coins: 0, credit: 0, claimed: 0, email: '' };
      const { credit = 0, claimed = 0, lastEmail = '' } = a.data();
      const owed = Math.max(0, credit - claimed);
      if (owed > 0) tx.update(acct, { claimed: credit, claimedAt: Date.now() });
      return { coins: owed, credit, claimed: credit, email: lastEmail };
    });
  }
}

/** Open the ledger — Firestore with a service account, memory without. */
async function openLedger() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) return { ledger: new MemoryLedger(), auth: null };
  try {
    const json = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');
    const app = getApps()[0] ?? initializeApp({ credential: cert(json), projectId: json.project_id });
    return { ledger: new FirestoreLedger(getFirestore(app)), auth: getAuth(app) };
  } catch (err) {
    console.error(`[bank] FIREBASE_SERVICE_ACCOUNT unusable (${err?.message ?? err}) — memory ledger, dev mode`);
    return { ledger: new MemoryLedger(), auth: null };
  }
}

const { ledger, auth } = await openLedger();

/* ── stripe ──────────────────────────────────────────────────────────── */

let stripe = null;
if (STRIPE_KEY && !FORCE_DEV) {
  if (!ledger.persistent) {
    console.error('[bank] STRIPE_SECRET_KEY is set but there is no ledger to write — refusing to take money. Set FIREBASE_SERVICE_ACCOUNT.');
  } else {
    try {
      const { default: Stripe } = await import('stripe');
      stripe = new Stripe(STRIPE_KEY);
      if (!WEBHOOK_SECRET) console.error('[bank] STRIPE_WEBHOOK_SECRET is not set — paid sessions will not be credited until it is.');
    } catch (err) {
      console.error(`[bank] the stripe package is not available (${err?.message ?? err}) — dev mode`);
    }
  }
}

/**
 * 'live' | 'test' | 'dev' | 'closed' — what the panel shows as a badge.
 *
 * DEV MODE IS FOR A LAPTOP. Its PAY button credits coins for nothing, so
 * it must never answer from a deployed host: on Render (which sets RENDER
 * in the environment) a bank with no Stripe key is CLOSED — every door
 * answers 503 and the board says so — until the secrets are set. BANK_DEV=1
 * overrides that for a deliberate staging box, and nothing else does.
 */
const DEV_ALLOWED = FORCE_DEV || !process.env.RENDER;
export const MODE = stripe ? (STRIPE_KEY.startsWith('sk_live') ? 'live' : 'test') : DEV_ALLOWED ? 'dev' : 'closed';
const DEV = MODE === 'dev';
const CLOSED = MODE === 'closed';

if (CLOSED) {
  console.log('[bank] THE BANK is CLOSED — a deployed host with no STRIPE_SECRET_KEY answers 503 until the secrets are set (BANK_DEV=1 would force dev mode; do not, on a public host)');
} else {
  console.log(
    `[bank] THE BANK is open — ${MODE} mode, ${ledger.persistent ? 'firestore' : 'memory'} ledger, ${CURRENCY.toUpperCase()}${stripe ? (MANAGED ? ', Stripe as merchant of record' : ', you as merchant of record') : ''}`,
  );
}

/* ── sessions and short links (memory) ───────────────────────────────── */

/** id → { uid, pack, url, code, at, paid } */
const sessions = new Map();
/** short code → session id */
const codes = new Map();

/* ── THE ACCOUNT: protect, and recover ──────────────────────────────────
 *
 * Nobody signs in to play: a headset is its anonymous uid. A BUYER can
 * PROTECT that uid by attaching the email they paid with (Admin SDK
 * updateUser — the uid does not change, so nothing moves), and later, on
 * another headset, RECOVER it: Firebase emails a sign-in link, the phone
 * that opens it (public/recover.html) signs in as that uid and asks here
 * for a HANDOFF code, and the new headset REDEEMS the code for a custom
 * token that signs IT in as the same uid. Six digits, ten minutes, once.
 */

/** handoff code → { uid, at } */
const handoffs = new Map();
const HANDOFF_TTL_MS = 10 * 60 * 1000;
const MAX_HANDOFFS_PER_UID = 3;
/** Dev mode only: email → uid, in place of Firebase Auth. */
const devEmails = new Map();

function prune() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) {
    if (s.at < cutoff) {
      sessions.delete(id);
      codes.delete(s.code);
    }
  }
  const dead = Date.now() - HANDOFF_TTL_MS;
  for (const [code, h] of handoffs) if (h.at < dead) handoffs.delete(code);
}
setInterval(prune, 60_000).unref();

const EMAIL_OK = /^[^\s@]{1,64}@[^\s@]{1,128}\.[^\s@]{2,24}$/;

/** a***@example.com — enough to recognise, not enough to harvest. */
function maskEmail(email) {
  if (!email) return '';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 1)}***@${domain ?? ''}`;
}

/** The email on an account, or ''. */
async function emailOf(uid) {
  if (auth) {
    try {
      return (await auth.getUser(uid)).email ?? '';
    } catch {
      return '';
    }
  }
  for (const [email, owner] of devEmails) if (owner === uid) return email;
  return '';
}

/** Attach an email to a uid. 'taken' when another uid already wears it. */
async function protect(uid, email) {
  if (auth) {
    try {
      await auth.updateUser(uid, { email, emailVerified: false });
      return { ok: true };
    } catch (err) {
      if (err?.code !== 'auth/email-already-exists') throw err;
      const other = await auth.getUserByEmail(email).catch(() => null);
      return other && other.uid === uid ? { ok: true } : { ok: false, taken: true };
    }
  }
  const owner = devEmails.get(email);
  if (owner && owner !== uid) return { ok: false, taken: true };
  devEmails.set(email, uid);
  return { ok: true };
}

function newHandoff(uid) {
  let live = 0;
  for (const h of handoffs.values()) if (h.uid === uid) live++;
  if (live >= MAX_HANDOFFS_PER_UID) return null;
  let code = '';
  do code = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
  while (handoffs.has(code));
  handoffs.set(code, { uid, at: Date.now() });
  return code;
}

function newCode() {
  let code = '';
  do code = randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8);
  while (codes.has(code));
  return code;
}

function openFor(uid) {
  let n = 0;
  for (const s of sessions.values()) if (s.uid === uid && !s.paid) n++;
  return n;
}

/** This server's own base URL as the client reached it, plus the mount
 *  path room.mjs stamps on the request — for the short link. */
function selfBase(req) {
  const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() || 'http';
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? `localhost:${PORT}`;
  return `${proto}://${host}${req.mountPath ?? ''}`;
}

/* ── identity ────────────────────────────────────────────────────────── */

const UID_OK = /^[A-Za-z0-9_-]{1,128}$/;

/** The uid behind a request, or null. A real token is verified against
 *  the project; in dev mode a token is trusted unverified and a bare
 *  `x-dev-uid` header is accepted, so a headset with no cloud (and the
 *  probes) can walk the whole loop against a laptop. */
async function whoIs(req) {
  const bearer = String(req.headers.authorization ?? '');
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : '';
  if (token) {
    if (auth) {
      try {
        const decoded = await auth.verifyIdToken(token);
        return UID_OK.test(decoded.uid) ? decoded.uid : null;
      } catch {
        return null;
      }
    }
    if (DEV) {
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
        const uid = String(payload.sub ?? payload.user_id ?? '');
        return UID_OK.test(uid) ? uid : null;
      } catch {
        return null;
      }
    }
    return null;
  }
  if (DEV) {
    const dev = String(req.headers['x-dev-uid'] ?? '');
    if (UID_OK.test(dev)) return dev;
  }
  return null;
}

/* ── http helpers ────────────────────────────────────────────────────── */

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function html(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
}

function readRaw(req, max = 64 * 1024) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > max) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => resolve(null));
  });
}

async function readBody(req) {
  const raw = await readRaw(req, 8 * 1024);
  if (!raw) return null;
  const text = raw.toString('utf8');
  const type = String(req.headers['content-type'] ?? '');
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
  try {
    return JSON.parse(text || '{}');
  } catch {
    return null;
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function price(minor) {
  const sym = { usd: '$', gbp: '£', eur: '€' }[CURRENCY] ?? `${CURRENCY.toUpperCase()} `;
  return CURRENCY === 'jpy' ? `${sym}${minor}` : `${sym}${(minor / 100).toFixed(2)}`;
}

/* ── the checkout ────────────────────────────────────────────────────── */

async function createCheckout(req, uid, pack) {
  const code = newCode();
  const base = selfBase(req);
  let id;
  let url;
  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: uid,
      metadata: { uid, pack: pack.id, coins: String(pack.coins) },
      ...(MANAGED ? { managed_payments: { enabled: true } } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: pack.minor,
            tax_behavior: 'inclusive',
            product_data: {
              name: `${pack.coins} iron-dollars — ${pack.name}`,
              description: 'FIRE FIGHT 2 in-game currency. No cash value; not refundable once delivered.',
              tax_code: TAX_CODE,
            },
          },
        },
      ],
      success_url: `${PUBLIC_URL}/paid.html?s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_URL}/paid.html?cancel=1`,
      // Stripe's floor is thirty minutes from now, measured on its clock —
      // a minute over keeps a skewed host from being refused at the edge.
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      ...(process.env.BANK_REQUIRE_TOS === '1' ? { consent_collection: { terms_of_service: 'required' } } : {}),
    });
    id = session.id;
    url = session.url;
  } else {
    id = `dev_${code}`;
    url = `${base}/dev-pay?s=${id}`;
  }
  sessions.set(id, { uid, pack: pack.id, coins: pack.coins, url, code, at: Date.now(), paid: false });
  codes.set(code, id);
  return { id, url, short: `${base}/go/${code}`, pack };
}

/** Stripe's word (or dev-pay's) that a session was paid: credit it. */
async function settle(id, uid, coins, meta) {
  const s = sessions.get(id);
  if (s) s.paid = true;
  const out = await ledger.credit(uid, id, coins, meta);
  console.log(`[bank] ${out.duplicate ? 'replayed' : 'paid'} ${id} → ${uid} +${coins} (credit ${out.credit})`);
  return out;
}

async function handleWebhook(req, res) {
  if (!stripe) return json(res, 503, { error: 'no stripe in dev mode' });
  const raw = await readRaw(req, 256 * 1024);
  if (!raw) return json(res, 400, { error: 'bad body' });
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, String(req.headers['stripe-signature'] ?? ''), WEBHOOK_SECRET);
  } catch (err) {
    console.error(`[bank] webhook refused: ${err?.message ?? err}`);
    return json(res, 400, { error: 'bad signature' });
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object;
    if (s.payment_status === 'paid') {
      const uid = String(s.metadata?.uid ?? s.client_reference_id ?? '');
      const coins = Number(s.metadata?.coins ?? 0);
      if (UID_OK.test(uid) && Number.isInteger(coins) && coins > 0 && coins <= 100000) {
        const email = String(s.customer_details?.email ?? '').trim().toLowerCase();
        await settle(s.id, uid, coins, { pack: String(s.metadata?.pack ?? ''), amount: s.amount_total ?? 0, currency: s.currency ?? CURRENCY, event: event.id, email: EMAIL_OK.test(email) ? email : '' });
      } else {
        console.error(`[bank] paid session ${s.id} carries no usable uid/coins — not credited`);
      }
    }
  }
  return json(res, 200, { received: true });
}

/* ── dev-pay: the fake checkout page ─────────────────────────────────── */

function devPayPage(req, s, id, paid) {
  const pack = PACKS.find((p) => p.id === s.pack) ?? { name: s.pack, coins: s.coins, minor: 0 };
  const body = paid
    ? `<h1>PAID</h1><p class="big">+${pack.coins} <span class="sym">$</span></p><p>are on their way to the headset. You can close this.</p>`
    : `<h1>TEST BANK</h1><p class="big">+${pack.coins} <span class="sym">$</span></p><p>${esc(pack.name)} · ${esc(price(pack.minor))} · <em>no real charge — this is the development bank</em></p>
       <form method="post" action="${esc(req.mountPath ?? '')}/dev-pay"><input type="hidden" name="s" value="${esc(id)}"><button>PAY</button></form>`;
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FIRE FIGHT 2 — test bank</title>
<style>body{margin:0;background:#101116;color:#e8ecf2;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center}
main{padding:32px}h1{color:#ffb02e;letter-spacing:.08em}.big{font-size:3rem;font-weight:800;margin:.2em 0}.sym{color:#ffb02e}
button{font:inherit;font-weight:800;letter-spacing:.1em;padding:18px 48px;border:0;border-radius:12px;background:#ffb02e;color:#221302;font-size:1.2rem}
em{color:#ffb454;font-style:normal}</style><main>${body}</main>`;
}

/* ── the router ──────────────────────────────────────────────────────── */

export function handleHttp(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-dev-uid');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (CLOSED) return json(res, 503, { error: 'the bank is not open yet', mode: 'closed' });

  if (req.method === 'GET' && (path === '/' || path === '/packs')) {
    return json(res, 200, { bank: 'iron-dollars', mode: MODE, currency: CURRENCY, managed: MANAGED, ledger: ledger.persistent ? 'firestore' : 'memory', packs: PACKS });
  }

  if (req.method === 'POST' && path === '/checkout') {
    void (async () => {
      const uid = await whoIs(req);
      if (!uid) return json(res, 401, { error: 'sign in first' });
      const body = await readBody(req);
      const pack = PACKS.find((p) => p.id === body?.pack);
      if (!pack) return json(res, 400, { error: 'no such pack' });
      if (openFor(uid) >= MAX_OPEN_PER_UID) return json(res, 429, { error: 'too many open checkouts — pay or wait' });
      try {
        json(res, 200, await createCheckout(req, uid, pack));
      } catch (err) {
        console.error(`[bank] checkout failed: ${err?.message ?? err}`);
        json(res, 502, { error: 'the bank could not open a checkout' });
      }
    })();
    return;
  }

  if (req.method === 'POST' && path === '/claim') {
    void (async () => {
      const uid = await whoIs(req);
      if (!uid) return json(res, 401, { error: 'sign in first' });
      try {
        json(res, 200, await ledger.claim(uid));
      } catch (err) {
        console.error(`[bank] claim failed: ${err?.message ?? err}`);
        json(res, 502, { error: 'the ledger is not answering' });
      }
    })();
    return;
  }

  if (req.method === 'POST' && path === '/webhook') {
    void handleWebhook(req, res);
    return;
  }

  // THE ACCOUNT.
  if (req.method === 'GET' && path === '/whoami') {
    void (async () => {
      const uid = await whoIs(req);
      if (!uid) return json(res, 401, { error: 'sign in first' });
      const email = await emailOf(uid);
      json(res, 200, { uid, protected: !!email, email: maskEmail(email) });
    })();
    return;
  }

  if (req.method === 'POST' && path === '/protect') {
    void (async () => {
      const uid = await whoIs(req);
      if (!uid) return json(res, 401, { error: 'sign in first' });
      const body = await readBody(req);
      const email = String(body?.email ?? '').trim().toLowerCase();
      if (!EMAIL_OK.test(email)) return json(res, 400, { error: 'that is not an email address' });
      try {
        const out = await protect(uid, email);
        if (!out.ok) return json(res, 409, { error: 'that email already protects another wallet — RECOVER it instead', taken: true });
        console.log(`[bank] ${uid} protected with ${maskEmail(email)}`);
        json(res, 200, { protected: true, email: maskEmail(email) });
      } catch (err) {
        console.error(`[bank] protect failed: ${err?.message ?? err}`);
        json(res, 502, { error: 'the account service is not answering' });
      }
    })();
    return;
  }

  if (req.method === 'POST' && path === '/handoff') {
    void (async () => {
      const uid = await whoIs(req);
      if (!uid) return json(res, 401, { error: 'sign in first' });
      const code = newHandoff(uid);
      if (!code) return json(res, 429, { error: 'too many codes on the go — wait ten minutes' });
      json(res, 200, { code, ttl: HANDOFF_TTL_MS });
    })();
    return;
  }

  if (req.method === 'POST' && path === '/redeem') {
    void (async () => {
      const body = await readBody(req);
      const code = String(body?.code ?? '').trim();
      const h = /^\d{6}$/.test(code) ? handoffs.get(code) : undefined;
      if (!h || h.at < Date.now() - HANDOFF_TTL_MS) return json(res, 404, { error: 'no such code — it may have expired' });
      handoffs.delete(code); // once
      try {
        const token = auth ? await auth.createCustomToken(h.uid) : `dev:${h.uid}`;
        console.log(`[bank] handoff redeemed → ${h.uid}`);
        json(res, 200, { token, uid: h.uid });
      } catch (err) {
        console.error(`[bank] redeem failed: ${err?.message ?? err}`);
        json(res, 502, { error: 'the account service is not answering' });
      }
    })();
    return;
  }

  const go = path.match(/^\/go\/([A-Za-z0-9]{6,12})$/);
  if (req.method === 'GET' && go) {
    const id = codes.get(go[1]);
    const s = id && sessions.get(id);
    if (!s) return html(res, 404, '<!doctype html><meta charset="utf-8"><title>expired</title><p style="font-family:system-ui;padding:32px">This checkout link has expired. Start another from the headset.');
    res.writeHead(302, { location: s.url, 'cache-control': 'no-store' });
    res.end();
    return;
  }

  if (DEV && path === '/dev-pay') {
    if (req.method === 'GET') {
      const id = url.searchParams.get('s') ?? '';
      const s = sessions.get(id);
      if (!s) return html(res, 404, '<!doctype html><meta charset="utf-8"><p style="font-family:system-ui;padding:32px">No such checkout.');
      return html(res, 200, devPayPage(req, s, id, s.paid));
    }
    if (req.method === 'POST') {
      void (async () => {
        const body = await readBody(req);
        const id = String(body?.s ?? '');
        const s = sessions.get(id);
        if (!s) return json(res, 404, { error: 'no such checkout' });
        const out = await settle(id, s.uid, s.coins, { pack: s.pack, amount: PACKS.find((p) => p.id === s.pack)?.minor ?? 0, currency: CURRENCY, event: 'dev' });
        const wantsJson = String(req.headers.accept ?? '').includes('application/json') || String(req.headers['content-type'] ?? '').includes('json');
        if (wantsJson) return json(res, 200, { paid: true, duplicate: !!out.duplicate, credit: out.credit });
        html(res, 200, devPayPage(req, s, id, true));
      })();
      return;
    }
  }

  json(res, 404, { error: 'not a door' });
}

if (isMain(import.meta.url)) {
  serve({ port: PORT, http: handleHttp, wss: null, onListen: () => console.log(`[bank] listening on :${PORT}`) });
}
