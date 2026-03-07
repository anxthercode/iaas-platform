/**
 * Playwright script - VM creation flow.
 * Steps: clear storage, login, navigate, enter success-test-vm, submit, wait 10s.
 */

import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = {
    steps: [],
    success: false,
    message: null,
    redirectedToVMList: false,
    url: null,
    screenshots: [],
  };

  try {
    // 1. Navigate to login
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
    results.steps.push('1. Navigated to login');

    // 2. localStorage.clear(); location.reload();
    await page.evaluate(() => { localStorage.clear(); location.reload(); });
    await page.waitForLoadState('networkidle');
    results.steps.push('2. localStorage.clear(); location.reload();');

    // 3. Wait 3 seconds
    await page.waitForTimeout(3000);
    results.steps.push('3. Waited 3s');

    // 4-5. Enter credentials
    await page.fill('input[type="email"]', 'aleksei@acme.com');
    await page.fill('input[type="password"]', 'user123');
    results.steps.push('4-5. Entered email and password');

    // 6. Click login
    await page.click('button[type="submit"]');
    results.steps.push('6. Clicked login');

    // 7. Wait 5 seconds
    await page.waitForTimeout(5000);
    results.steps.push('7. Waited 5s');

    // 8. Navigate to /vms/create
    await page.goto('http://localhost:5173/vms/create', { waitUntil: 'networkidle' });
    results.steps.push('8. Navigated to /vms/create');

    // 9. Wait 3 seconds
    await page.waitForTimeout(3000);
    results.steps.push('9. Waited 3s');

    // 10. Enter "success-test-vm" in VM name field
    const nameInput = page.locator('input[placeholder="web-server-01"]').first();
    await nameInput.fill('success-test-vm');
    results.steps.push('10. Entered success-test-vm');

    // 11. Click Создать ВМ
    await page.click('button[type="submit"]:has-text("Создать ВМ")');
    results.steps.push('11. Clicked Создать ВМ');

    // 12. Wait 10 seconds
    await page.waitForTimeout(10000);
    results.steps.push('12. Waited 10s');

    // 13. Screenshot
    await page.screenshot({ path: 'vm-test-success-result.png', fullPage: true });
    results.screenshots.push('vm-test-success-result.png');

    // Determine result
    results.url = page.url();
    results.redirectedToVMList = results.url.includes('/vms') && !results.url.includes('/create');

    const errBox = page.locator('.err-box');
    const hasError = await errBox.count() > 0;

    if (hasError) {
      results.success = false;
      results.message = (await errBox.textContent()).trim();
    } else if (results.redirectedToVMList) {
      results.success = true;
      results.message = 'Redirected to VM list';
    } else {
      results.success = false;
      results.message = 'Still on create page - no visible error';
    }
  } catch (e) {
    results.message = e.message || String(e);
    results.success = false;
    try {
      await page.screenshot({ path: 'vm-test-success-error.png', fullPage: true });
      results.screenshots.push('vm-test-success-error.png');
    } catch (_) {}
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch(err => { console.error(err); process.exit(1); });
