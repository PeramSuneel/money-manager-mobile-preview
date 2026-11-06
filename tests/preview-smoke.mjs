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
let silverFetchCount = 0;
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://r.jina.ai/**', async route => {
    const url = route.request().url();
    if (url.includes('gold-rates/bangalore.html')) {
      await route.fulfill({ status: 200, contentType: 'text/plain', body: '1 | ₹14,346 (-256) | ₹13,150 (-235) | ₹10,759 (-193)\\n'.padEnd(300, ' ') });
    } else if (url.includes('silver-rates/bangalore.html')) {
      silverFetchCount += 1;
      if (silverFetchCount <= 2) {
        await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Silver source temporarily unavailable' });
      } else {
        await route.fulfill({ status: 200, contentType: 'text/plain', body: '| 1 | ₹ 150 | ₹ 1,500 | + ₹ 5 |\\n'.padEnd(300, ' ') });
      }
    } else {
      await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Market source temporarily unavailable' });
    }
  });
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
  const metalToggle = page.locator('#dashboardMetalToggle');
  if ((await metalToggle.innerText()).trim() !== '−') throw new Error('Expanded gold rates should show a minus symbol.');
  await metalToggle.click();
  if (!(await page.locator('#dashboardMetalContent').isHidden()) || (await metalToggle.innerText()).trim() !== '+') throw new Error('Collapsed gold rates should show a plus symbol.');
  await metalToggle.click();
  if (await page.locator('#dashboardMetalContent').isHidden() || (await metalToggle.innerText()).trim() !== '−') throw new Error('Expanded gold rates should restore the minus symbol.');
  await page.locator('.dashboard-metals-heading > div').click();
  if (!(await page.locator('#dashboardMetalContent').isHidden()) || (await metalToggle.innerText()).trim() !== '+') throw new Error('Clicking the rates header should minimise the section.');
  await page.locator('.dashboard-metals-heading > div').click();
  if (await page.locator('#dashboardMetalContent').isHidden() || (await metalToggle.innerText()).trim() !== '−') throw new Error('Clicking the rates header should expand the section again.');
  await page.waitForFunction(() => document.querySelector('#dashGold24')?.innerText.includes('14,346'), { timeout: 10000 }).catch(async error => {
    throw new Error('Gold-rate mock did not render. URL intercepted: ' + (await page.locator('#dashMetalSource').innerText().catch(() => 'no source')) + '; displayed value: ' + (await page.locator('#dashGold24').innerText().catch(() => 'missing')) + '; page errors: ' + errors.join(' | ') + '; original: ' + error.message);
  });
  if (!(await page.locator('#dashGold22').innerText()).includes('13,150')) throw new Error('Live gold rates did not render when the silver feed was unavailable.');

  const mobileNav = await page.locator('#nav').evaluate(el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return { position:s.position, bottom:Math.round(innerHeight-r.bottom), columns:s.gridTemplateColumns.split(' ').length,
      links:el.querySelectorAll('.nav-link').length, overflow:s.overflowX };
  });
  if (mobileNav.position !== 'fixed' || mobileNav.bottom !== 0 || mobileNav.columns !== 7 || mobileNav.links !== 7) {
    throw new Error('Mobile navigation is not a fixed, seven-item bottom bar: ' + JSON.stringify(mobileNav));
  }
  if (await page.locator('#menuToggle').isVisible()) throw new Error('Mobile hamburger menu should be hidden.');
  const brand = await page.locator('.site-navigation .brand').evaluate(el => {
    const r=el.getBoundingClientRect(); return {left:Math.round(r.left), top:Math.round(r.top)};
  });
  if (brand.left > 20) throw new Error('Mobile brand is not aligned to the top-left: ' + JSON.stringify(brand));
  await page.locator('#nav [data-page="markets"]').click();
  await page.locator('#holdingGrams').fill('20');
  if (!(await page.locator('#holdingPreviewValue').innerText()).includes('2,63,000')) throw new Error('Gold holding value preview is not calculated before saving.');
  await page.locator('#addGoldHolding').click();
  await page.waitForFunction(() => document.querySelector('#goldHoldingRows')?.innerText.includes('20.000 g'));
  if (!(await page.locator('#goldHoldingValue').innerText()).includes('₹')) throw new Error('Gold holding value was not calculated from the cached rate.');
  await page.locator('#refreshMarket').click();
  await page.waitForFunction(() => document.querySelector('#silverGram')?.innerText.includes('150'), { timeout: 10000 });
  await page.locator('#holdingMetal').selectOption('silver');
  if (await page.locator('#holdingPurity').inputValue() !== '999') throw new Error('Silver holding purity should be set to 999 fine.');
  await page.locator('#holdingGrams').fill('10');
  if (!(await page.locator('#holdingPreviewValue').innerText()).includes('1,500')) throw new Error('999 silver holding value preview is not calculated before saving.');
  await page.locator('#holdingPurity').selectOption('925');
  if (!(await page.locator('#holdingPreviewValue').innerText()).includes('1,388.89')) throw new Error('925 sterling silver value does not apply the correct fineness adjustment.');
  await page.locator('#addGoldHolding').click();
  await page.waitForFunction(() => document.querySelector('#goldHoldingRows')?.innerText.includes('Silver'));
  if (!(await page.locator('#goldHoldingRows').innerText()).includes('925 Sterling')) throw new Error('Sterling silver purity is not displayed correctly.');
  if (!(await page.locator('#goldHoldingValue').innerText()).includes('₹')) throw new Error('Combined gold and silver holdings total was not calculated.');
  await page.locator('#investBudget').fill('10300');
  await page.locator('#investRate').fill('1000');
  await page.locator('#investGst').fill('3');
  if (!(await page.locator('#investGrams').innerText()).includes('10.000 g')) throw new Error('Investment quantity does not include GST correctly.');
  await page.locator('#saveMetalPurchase').click();
  if (await page.locator('#metalPurchaseTable tr').count() !== 1) throw new Error('Validated metal purchase was not saved.');
  await page.locator('#jewelRate').fill('1000');
  await page.locator('#jewelGrams').fill('10');
  await page.locator('#jewelWastage').fill('8');
  await page.locator('#jewelMaking').fill('500');
  await page.locator('#jewelDiscount').fill('10');
  await page.locator('#jewelGst').fill('3');
  await page.locator('#jewelMakingType').selectOption('gram');
  if (!(await page.locator('#jewelTotal').innerText()).includes('14,646.60')) throw new Error('Jewellery total is incorrect for metal + wastage + making - discount + GST.');
  await page.locator('#loanGoldGrams').fill('10');
  await page.locator('#loanGoldLtv').selectOption('75');
  await page.locator('#loanGoldAmount').fill('');
  await page.locator('#loanGoldRate').fill('12');
  await page.locator('#loanGoldMonths').fill('12');
  await page.locator('#loanGoldFee').fill('500');
  await page.locator('#loanGoldGst').fill('18');
  if (!(await page.locator('#goldLoanBreakdown').innerText()).includes('GST on processing fee')) throw new Error('Gold-loan fee/GST breakdown did not render.');
  if ((await page.locator('#goldLoanEmi').innerText()).trim() === '—') throw new Error('Gold-loan EMI did not calculate with valid inputs.');
  await page.locator('#loanGoldAmount').fill('120000');
  await page.locator('#loanGoldRate').fill('0');
  const ltvBreakdown = await page.locator('#goldLoanBreakdown').innerText();
  if (!ltvBreakdown.includes('Amount requested') || !ltvBreakdown.includes('98,625')) throw new Error('Gold-loan amount above LTV was not separated from the eligible amount.');
  if (!(await page.locator('#goldLoanEmi').innerText()).includes('8,218.75')) throw new Error('Gold-loan EMI was not capped to the LTV-eligible principal.');

  if (await page.locator('#goldHoldingRows tr').count() !== 2) throw new Error('Gold and silver holdings should create exactly two rows.');
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
  if (!(await page.locator('#txMobileList').innerText()).includes('Preview smoke test')) throw new Error('Mobile transaction cards are not rendering.');
  if (!(await page.locator('.tx-desktop-table').isHidden())) throw new Error('Desktop transaction table should be hidden on mobile to avoid horizontal sliding.');
  await page.locator('#txAdd').click();
  await page.locator('#formFields [name="type"]').selectOption('Income');
  await page.locator('#formFields [name="description"]').fill('Large income test');
  await page.locator('#formFields [name="category"]').fill('Salary');
  await page.locator('#formFields [name="account"]').fill('Bank');
  await page.locator('#formFields [name="amount"]').fill('9900000');
  await page.locator('#recordForm button[type="submit"]').click();
  await page.locator('#modal.open').waitFor({ state: 'detached', timeout: 3000 }).catch(async () => {
    if (await page.locator('#modal').getAttribute('aria-hidden') !== 'true') throw new Error('Income transaction form did not close after saving.');
  });
  await page.locator('[data-page="dashboard"]').click();
  if (!(await page.locator('#dashIncome').innerText()).includes('99,00,000')) throw new Error('Large monthly income is not fully displayed.');
  await page.locator('#dashIncome').click();
  if (!(await page.locator('#page-transactions').evaluate(el => el.classList.contains('active')))) throw new Error('Monthly income metric did not open Transactions.');
  if ((await page.locator('.tx-filter.active').getAttribute('data-tx-filter')) !== 'Income') throw new Error('Monthly income metric did not apply the Income filter.');
  if (!(await page.locator('#txMobileList').innerText()).includes('Large income test')) throw new Error('Income-filtered transaction list is missing the income record.');
  await page.locator('.tx-filter[data-tx-filter="All"]').click();
  if (!(await page.locator('#txMobileList').innerText()).includes('Preview smoke test')) throw new Error('All transactions filter did not restore all records.');
  await page.locator('[data-page="dashboard"]').click();
  await page.locator('#dashExpense').click();
  if ((await page.locator('.tx-filter.active').getAttribute('data-tx-filter')) !== 'Expense') throw new Error('Monthly spending metric did not apply the Spending filter.');
  await page.locator('#nav [data-page="creditcards"]').click();
  await page.locator('#cardAdd').click();
  await page.locator('#formFields [name="bankName"]').fill('Test Bank');
  await page.locator('#formFields [name="last4"]').fill('4521');
  await page.locator('#formFields [name="creditLimit"]').fill('100000');
  await page.locator('#formFields [name="billAmount"]').fill('12500');
  await page.locator('#formFields [name="minimumDue"]').fill('13000');
  await page.locator('#formFields [name="statementDate"]').fill('2026-11-01');
  await page.locator('#formFields [name="dueDate"]').fill('2026-11-12');
  await page.locator('#recordForm button[type="submit"]').click();
  if (!(await page.locator('#modal').evaluate(el => el.classList.contains('open')))) throw new Error('Invalid credit-card minimum due should keep the form open for correction.');
  await page.locator('#formFields [name="minimumDue"]').fill('625');
  await page.locator('#recordForm button[type="submit"]').click();
  await page.locator('#creditCardList').getByText('Test Bank').waitFor();
  const cardText = await page.locator('#creditCardList').innerText();
  if (!(await page.locator('#creditCardList .credit-card-item').first().evaluate(el => el.classList.contains('metric-card')))) throw new Error('Credit-card bill does not use the shared metric-card style.');
  if (!cardText.includes('12,500') || !cardText.includes('Due date: 2026-11-12') || !cardText.includes('Minimum due: ₹625')) {
    throw new Error('Credit-card bill amount, due date, or minimum due is not displayed.');
  }
  if (!(await page.locator('#cardTotalOutstanding').innerText()).includes('12,500')) throw new Error('Credit card outstanding total is incorrect.');
  const transactionsBeforeCardPayment = await page.locator('#txMobileList .tx-mobile-card').count();
  await page.locator('[data-pay-card]').click();
  await page.locator('#formFields [name="paymentAmount"]').fill('5000');
  await page.locator('#recordForm button[type="submit"]').click();
  if (!(await page.locator('#creditCardList').innerText()).includes('7,500')) throw new Error('Partial credit-card payment was not calculated.');
  if ((await page.locator('#txMobileList .tx-mobile-card').count()) !== transactionsBeforeCardPayment) {
    throw new Error('Credit-card bill payment was incorrectly added as a second expense.');
  }
  await page.locator('[data-pay-card]').click();
  await page.locator('#formFields [name="paymentAmount"]').fill('7500');
  await page.locator('#recordForm button[type="submit"]').click();
  if (!(await page.locator('#creditCardList').innerText()).includes('Paid')) throw new Error('Fully paid credit-card bill was not marked Paid.');
  if (!(await page.locator('#cardTotalOutstanding').innerText()).includes('0')) throw new Error('Outstanding total did not clear after full payment.');
  await page.locator('#nav [data-page="loans"]').click();
  await page.locator('#loanAdd').click();
  await page.locator('#formFields [name="name"]').fill('Test Car Loan');
  await page.locator('#formFields [name="type"]').selectOption('Car loan');
  await page.locator('#formFields [name="balance"]').fill('350000');
  await page.locator('#formFields [name="rate"]').fill('9.5');
  await page.locator('#formFields [name="emi"]').fill('12500');
  await page.locator('#formFields [name="dueDate"]').fill('2026-11-15');
  await page.locator('#formFields [name="months"]').fill('36');
  await page.locator('#recordForm button[type="submit"]').click();
  await page.locator('#loanCardList').getByText('Test Car Loan').waitFor();
  const loanCard = page.locator('#loanCardList .loan-card-item').first();
  if (!(await loanCard.evaluate(el => el.classList.contains('metric-card'))) || !(await loanCard.innerText()).includes('12,500')) {
    throw new Error('Loan details are not displayed in the shared metric-card style.');
  }
  const pageIds = ['dashboard','transactions','creditcards','loans','markets','reports','settings'];
  const assertNoHorizontalOverflow = async label => {
    const horizontalOverflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      scrollable: [...document.querySelectorAll('*')].filter(el => {
        const style = getComputedStyle(el);
        return (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
      }).map(el => el.id || el.className || el.tagName).slice(0, 10)
    }));
    if (horizontalOverflow.document || horizontalOverflow.scrollable.length) {
      throw new Error('Horizontal sliding/scrolling remains on '+label+': ' + JSON.stringify(horizontalOverflow));
    }
  };
  for (const pageId of pageIds) {
    await page.locator('#nav [data-page="'+pageId+'"]').click();
    await assertNoHorizontalOverflow('mobile '+pageId);
  }
  await page.setViewportSize({width:1366,height:900});
  for (const pageId of pageIds) {
    await page.locator('#nav [data-page="'+pageId+'"]').click();
    await assertNoHorizontalOverflow('desktop '+pageId);
  }
  if (errors.length) throw new Error('Browser errors: ' + errors.join(' | '));
  console.log('PASS: dashboard, live gold/silver rates, pre-save holding values, combined holdings, currency math, transactions, card payments, loans, and no horizontal scrolling.');
} finally {
  await browser.close();
  server.close();
}
