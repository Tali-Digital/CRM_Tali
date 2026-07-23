const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('UNCAUGHT PAGE ERROR:', error.message);
  });

  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });

  await page.goto('http://localhost:3000/#/editor_prospeccao', { waitUntil: 'networkidle2' });
  
  // Wait a bit just in case
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
