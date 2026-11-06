import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = process.cwd();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = resolve(root, relative);
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Invalid path');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('mmMarketCache.v2', JSON.stringify({rates:{g24:14500,g22:13290,g18:10875,silver:180,change24:100,change22:90,change18:75,changeSilver:2},stamp:'2026-11-06',source:'Smoke test rates',savedAt:Date.now()})));
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.locator('#heroNetWorth').waitFor();

  const order = await page.evaluate(() => {
    const top = selector => document.querySelector(selector).getBoundingClientRect().top;
    return {
      metrics: top('.dashboard-metrics'),
      recent: top('.lower-grid'),
      rates: top('#dashboardMetals'),
      charts: top('#page-dashboard > .content-grid:not(.lower-grid)')
    };
  });
  if (!(order.metrics < order.recent && order.recent < order.rates && order.rates < order.charts)) {
    throw new Error('Dashboard sections are not in the requested order: ' + JSON.stringify(order));
  }
  const columns = await page.locator('.dashboard-metrics').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if (columns !== 3) throw new Error('Dashboard income/spending/EMI cards are not in one row on mobile.');
  if (!(await page.locator('#dashboardMetals').innerText()).includes('Gold & Silver Rates - Today')) {
    throw new Error('Dashboard rates heading is missing.');
  }
  if (await page.locator('#dashboardMetalContent').isHidden()) throw new Error('Dashboard gold/silver rates are hidden by default.');
  if ((await page.locator('#dashGold24').innerText()).trim() === '—') throw new Error('Cached gold rate is not rendered on dashboard.');

  await page.locator('#menuToggle').click();
  await page.locator('#nav [data-page="markets"]').click();
  await page.locator('#holdingGrams').fill('20');
  await page.locator('#addGoldHolding').click();
  await page.waitForFunction(() => document.querySelector('#goldHoldingRows')?.innerText.includes('20.000 g'));
  if (!(await page.locator('#goldHoldingValue').innerText()).includes('₹')) throw new Error('Gold holding value was not calculated from the cached rate.');
  if (await page.locator('#goldHoldingRows tr').count() !== 1) throw new Error('Gold holding did not create exactly one row.');
    await page.locator('#menuToggle').click();
  await page.locator('#nav [data-page="transactions"]').click();
  await page.locator('#txAdd').click();
  const type = page.locator('#formFields [name="type"]');
  const labels = await type.locator('option').allTextContents();
  if (!labels.includes('Spending')) throw new Error('Transaction type does not show Spending.');
  if (await type.locator('option').first().getAttribute('value') !== 'Expense') {
    throw new Error('Spending display label must retain the existing Expense data value.');
  }
  const categoryCombo = page.locator('.suggest-combo').filter({ has: page.locator('[name="category"]') });
  const paidViaCombo = page.locator('.suggest-combo').filter({ has: page.locator('[name="account"]') });
  await categoryCombo.locator('.suggest-toggle').click();
  if (!(await categoryCombo.locator('.suggest-menu').innerText()).includes('Food')) throw new Error('Category dropdown does not open its options.');
  await categoryCombo.locator('[data-value="Food"]').click();
  await paidViaCombo.locator('.suggest-toggle').click();
  if (!(await paidViaCombo.locator('.suggest-menu').innerText()).includes('UPI')) throw new Error('Paid via dropdown does not open its options.');
  await paidViaCombo.locator('[data-value="UPI"]').click();
  const categoryOptions = await categoryCombo.locator('.suggest-menu').innerText().catch(() => '');
  const paidViaOptions = await paidViaCombo.locator('.suggest-menu').innerText().catch(() => '');
  if (await page.locator('[name="category"]').inputValue() !== 'Food') throw new Error('Category suggestion did not populate the input.');
  if (await page.locator('[name="account"]').inputValue() !== 'UPI') throw new Error('Paid via suggestion did not populate the input.');

  await type.selectOption('Income');
  await categoryCombo.locator('.suggest-toggle').click();
  if (!(await categoryCombo.locator('.suggest-menu').innerText()).includes('Salary')) throw new Error('Category suggestions did not update for Income.');
  await categoryCombo.locator('.suggest-menu').locator('[data-value="Salary"]').click();
  await type.selectOption('Expense');
  await page.locator('#formFields [name="date"]').fill('2026-11-06');
  await page.locator('#formFields [name="description"]').fill('Preview smoke test');
  await page.locator('#formFields [name="category"]').fill('Custom category');
  await page.locator('#formFields [name="account"]').fill('Custom payment');
  await page.locator('#formFields [name="amount"]').fill('125');
  await page.locator('#recordForm button[type="submit"]').click();
  await page.locator('#modal.open').waitFor({ state: 'detached', timeout: 3000 }).catch(async () => {
    if (await page.locator('#modal').getAttribute('aria-hidden') !== 'true') throw new Error('Transaction form did not close after saving.');
  });
  const transactionText = await page.locator('#txTable').innerText();
  if (!transactionText.includes('Spending') || !transactionText.includes('Custom category') || !transactionText.includes('Custom payment')) {
    throw new Error('Saved transaction did not preserve custom category/payment or Spending label.');
  }
  if (errors.length) throw new Error('Browser errors: ' + errors.join(' | '));
  console.log('PASS: mobile dashboard order, visible cached metal rates, gold holding valuation, searchable category/payment dropdowns, custom values, and Spending terminology.');
} finally {
  await browser.close();
  server.close();
}
