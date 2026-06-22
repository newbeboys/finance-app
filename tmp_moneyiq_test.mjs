import { chromium } from 'playwright';

const BASE = 'http://localhost:5176';
const REF = 'ykyzgaztfbvwsjdcdpwk';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const SNAP = (n) => `C:/Users/HP/AppData/Local/Temp/moneyiq_${n}.png`;
const SESSION = {
  access_token: 'fake.access.token', refresh_token: 'fake-refresh', token_type: 'bearer',
  expires_in: 999999999, expires_at: 4070908800,
  user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {} },
};
const PRO_ROW = { user_id: USER_ID, plan: 'pro', billing_cycle: 'annual', started_at: '2026-01-01', expires_at: null, updated_at: '2026-01-01' };
const TX_PRO = [
  { id: 't1', user_id: USER_ID, type: 'expense', amount: -1500000, category: 'food',     merchant: 'Resto', note: '', date: '2026-06-10', time: '10:00', method: 'Tunai', created_at: '2026-06-10T10:00:00Z' },
  { id: 't2', user_id: USER_ID, type: 'expense', amount: -500000,  category: 'transport', merchant: 'Bensin',note: '', date: '2026-06-12', time: '10:00', method: 'Tunai', created_at: '2026-06-12T10:00:00Z' },
  { id: 't3', user_id: USER_ID, type: 'income',  amount: 5000000,  category: 'salary',    merchant: 'Gaji', note: '', date: '2026-06-01', time: '10:00', method: 'Tunai', created_at: '2026-06-01T10:00:00Z' },
];
const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

let failures = 0;
const check = (l, c, e = '') => { console.log(`${c ? '✅' : '❌'} ${l}${e ? ' — ' + e : ''}`); if (!c) failures++; };
const noAI = (text, label) => {
  const hits = ['Wawasan AI', 'wawasan AI', 'AI Insight', 'AI insight', 'AI insights'].filter(p => text.includes(p));
  check(`${label}: tidak ada sisa teks "AI"`, hits.length === 0, hits.length ? 'DITEMUKAN: ' + JSON.stringify(hits) : '');
};

async function makeCtx(browser, { bahasa = 'id', pro = false, tx = [] }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Jakarta' });
  await ctx.addInitScript(([ref, session, lng]) => {
    try {
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
      localStorage.setItem('bahasa', lng);
    } catch {}
  }, [REF, SESSION, bahasa]);
  const page = await ctx.newPage();
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/transactions')) return json(route, tx);
    if (url.includes('/user_subscriptions')) return pro ? json(route, PRO_ROW) : json(route, []);
    return json(route, []);
  });
  await page.route('**/auth/v1/**', (route) => json(route, SESSION));
  await page.clock.setFixedTime(new Date('2026-06-23T05:00:00Z'));
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── A. BASIC, Bahasa Indonesia ──────────────────────────────────
  console.log('\n===== A. Basic / id — dashboard, paywall, settings =====');
  {
    const { ctx, page } = await makeCtx(browser, { bahasa: 'id', pro: false });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3800);

    let body = await page.evaluate(() => document.body.innerText);
    check('dashboard menampilkan "Money IQ"', body.includes('Money IQ'));
    noAI(body, 'dashboard(id)');
    await page.screenshot({ path: SNAP('A1_dashboard_id') });

    // Klik kartu Money IQ (locked) → paywall
    await page.evaluate(() => {
      const card = [...document.querySelectorAll('.card')].find(c => c.textContent.includes('Money IQ'));
      card?.click();
    });
    await page.waitForTimeout(600);
    body = await page.evaluate(() => document.body.innerText);
    check('paywall: judul "Fitur Khusus Pro"', body.includes('Fitur Khusus Pro'));
    check('paywall: "Money IQ adalah fitur khusus Pro."', body.includes('Money IQ adalah fitur khusus Pro.'));
    noAI(body, 'paywall(id)');
    await page.screenshot({ path: SNAP('A2_paywall_id') });

    // Tutup paywall → ke Settings
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Mengerti');
      btn?.click();
    });
    await page.waitForTimeout(400);
    // Buka drawer "Lainnya" (tombol nav terakhir) lalu "Pengaturan"
    await page.evaluate(() => { const b = document.querySelectorAll('nav.bottom-nav button'); b[b.length - 1]?.click(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Pengaturan');
      btn?.click();
    });
    await page.waitForTimeout(800);
    // Scroll cari kartu Money IQ
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    body = await page.evaluate(() => document.body.innerText);
    check('settings: judul kartu "Money IQ"', body.includes('Money IQ'));
    check('settings: toggle "Tampilkan Money IQ"', body.includes('Tampilkan Money IQ'));
    noAI(body, 'settings(id)');
    await page.screenshot({ path: SNAP('A3_settings_id'), fullPage: true });
    await ctx.close();
  }

  // ── B. BASIC, English ───────────────────────────────────────────
  console.log('\n===== B. Basic / en — konsistensi "Money IQ" =====');
  {
    const { ctx, page } = await makeCtx(browser, { bahasa: 'en', pro: false });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3800);
    let body = await page.evaluate(() => document.body.innerText);
    check('dashboard(en) menampilkan "Money IQ" (sama, tak diterjemahkan)', body.includes('Money IQ'));
    noAI(body, 'dashboard(en)');
    await page.screenshot({ path: SNAP('B1_dashboard_en') });

    // Settings en
    await page.evaluate(() => { const b = document.querySelectorAll('nav.bottom-nav button'); b[b.length - 1]?.click(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Settings');
      btn?.click();
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    body = await page.evaluate(() => document.body.innerText);
    check('settings(en): "Money IQ" + "Show Money IQ"', body.includes('Money IQ') && body.includes('Show Money IQ'));
    noAI(body, 'settings(en)');
    await page.screenshot({ path: SNAP('B2_settings_en'), fullPage: true });
    await ctx.close();
  }

  // ── C. PRO + transaksi — kartu unlocked, counter "Money IQ ·" ────
  console.log('\n===== C. Pro / id — counter kartu insight =====');
  {
    const { ctx, page } = await makeCtx(browser, { bahasa: 'id', pro: true, tx: TX_PRO });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3800);
    const body = await page.evaluate(() => document.body.innerText);
    check('Pro: kartu insight unlocked menampilkan counter "Money IQ ·"', /Money IQ ·/.test(body), body.match(/Money IQ[^\n]*/)?.[0] || 'tidak ketemu');
    noAI(body, 'dashboard-pro(id)');
    await page.screenshot({ path: SNAP('C1_pro_counter'), fullPage: true });
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${failures === 0 ? '🎉 ALL MONEY IQ TESTS PASS' : '⚠️ ' + failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
})();
