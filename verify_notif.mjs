import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const SNAP = (n) => `C:/Users/HP/AppData/Local/Temp/notif_${n}.png`;

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();

  console.log('\n=== STEP 1: Load app ===');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SNAP('01_home') });

  const isLogin = await page.$('input[type="email"]');
  if (isLogin) {
    console.log('Login page detected — logging in...');
    await page.fill('input[type="email"]', 'mesbertiga@gmail.com');
    await page.fill('input[type="password"]', 'Pemalang1233.');
    await page.screenshot({ path: SNAP('00_login') });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: SNAP('00b_after_login') });
    console.log('Logged in ✅');
  }
  console.log('App loaded ✅');

  console.log('\n=== STEP 2: Check bell icon ===');
  const bellBtn = await page.$('button[aria-label="Notifications"]');
  console.log('Bell button found:', !!bellBtn, bellBtn ? '✅' : '❌');

  const badge = await page.$('button[aria-label="Notifications"] span');
  const badgeText = badge ? await badge.textContent() : null;
  console.log('Unread badge:', badgeText ?? 'none');

  console.log('\n=== STEP 3: Open notification panel ===');
  if (bellBtn) await bellBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: SNAP('02_panel_open') });

  const panelVisible = await page.$('text=Notifikasi');
  console.log('Panel visible:', !!panelVisible, panelVisible ? '✅' : '❌');

  const markAllBtn = await page.$('button:has-text("Tandai semua dibaca")');
  console.log('"Tandai semua dibaca":', markAllBtn ? '✅ visible' : 'not shown (no unread or empty)');

  // Grab notification items
  const items = await page.$$('text=/Anggaran|masuk|Mingguan|Tagihan|Ringkasan|Peringatan/');
  console.log('Notification entries found:', items.length);

  // Close panel by clicking backdrop
  await page.mouse.click(10, 200);
  await page.waitForTimeout(400);

  console.log('\n=== STEP 4: Navigate to Settings via Lainnya drawer ===');
  // Click "Lainnya" (last nav button) to open the drawer
  const navBtns = await page.$$('nav button');
  await navBtns[navBtns.length - 1].click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: SNAP('03_lainnya_drawer') });

  // Click "Pengaturan" inside the drawer
  const settingsBtn = await page.$('text=Pengaturan');
  if (!settingsBtn) {
    console.log('Pengaturan button not found in drawer ❌');
  } else {
    await settingsBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: SNAP('03b_settings_top') });

    // Scroll down to notification card
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(400);
    await page.screenshot({ path: SNAP('03c_settings_scrolled') });

    const notifCard = await page.$('text=Pemberitahuan');
    console.log('Notification settings card:', notifCard ? '✅' : '❌');
    if (notifCard) {
      await notifCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: SNAP('03d_notif_card') });
    }

    const switches = await page.$$('button[role="switch"]');
    console.log('Toggle switches found:', switches.length);
    for (let i = 0; i < switches.length; i++) {
      const checked = await switches[i].getAttribute('aria-checked');
      console.log(`  switch[${i}] aria-checked="${checked}"`);
    }

    if (switches.length >= 3) {
      // Layout: 0=master notifications, 1=budget, 2=income, 3=weekly, 4=bills
      const incSwitch = switches[2];
      const before = await incSwitch.getAttribute('aria-checked');
      console.log('Income toggle before:', before);
      await incSwitch.click();
      await page.waitForTimeout(500);
      const after = await incSwitch.getAttribute('aria-checked');
      console.log('Income toggle after click:', after, before !== after ? '✅ changed' : '❌ unchanged');
      await page.screenshot({ path: SNAP('04_income_toggled_off') });

      // Go back to dashboard and verify panel reflects change
      const navBtns2 = await page.$$('nav button');
      await navBtns2[0].click(); // Beranda
      await page.waitForTimeout(700);
      const bellCheck = await page.$('button[aria-label="Notifications"]');
      if (bellCheck) {
        await bellCheck.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: SNAP('04b_panel_income_disabled') });
        console.log('Panel after income disabled — screenshot 04b captured');
        await page.mouse.click(10, 200);
        await page.waitForTimeout(300);
      }

      // Restore: go back to settings and re-enable income
      const navBtns3 = await page.$$('nav button');
      await navBtns3[navBtns3.length - 1].click();
      await page.waitForTimeout(500);
      const settingsBtn2 = await page.$('text=Pengaturan');
      if (settingsBtn2) {
        await settingsBtn2.click();
        await page.waitForTimeout(800);
        await page.evaluate(() => window.scrollTo(0, 600));
        await page.waitForTimeout(300);
        const switchesFinal = await page.$$('button[role="switch"]');
        if (switchesFinal.length >= 3) {
          await switchesFinal[2].click();
          await page.waitForTimeout(300);
          const restored = await switchesFinal[2].getAttribute('aria-checked');
          console.log('Income toggle restored to:', restored, '✅');
        }
      }
    }
  }

  console.log('\n=== STEP 5: Return to dashboard ===');
  const firstNav = (await page.$$('nav button'))[0];
  if (firstNav) {
    await firstNav.click();
    await page.waitForTimeout(600);
  }

  console.log('\n=== STEP 6: Mark all as read ===');
  const bell2 = await page.$('button[aria-label="Notifications"]');
  if (bell2) {
    await bell2.click();
    await page.waitForTimeout(600);
    const markAll = await page.$('button:has-text("Tandai semua dibaca")');
    if (markAll) {
      await markAll.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: SNAP('05_marked_read') });
      const badgeAfter = await page.$('button[aria-label="Notifications"] span');
      const badgeCountAfter = badgeAfter ? await badgeAfter.textContent() : null;
      console.log('Badge after mark-all-read:', badgeCountAfter ?? 'gone ✅');
    } else {
      console.log('No unread to mark (panel empty or already read)');
      await page.screenshot({ path: SNAP('05_panel_empty') });
    }
  }

  await browser.close();
  console.log('\n=== Done ===');
})();
