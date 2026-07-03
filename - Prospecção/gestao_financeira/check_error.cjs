const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Catch console logs and errors
    page.on('console', msg => {
      console.log(`[Browser Console ${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.error(`[Browser PageError] ${err.toString()}`);
    });

    console.log('Navigating to http://localhost:5173/imovel/p_875xrybl1 ...');
    await page.goto('http://localhost:5173/imovel/p_875xrybl1', { waitUntil: 'networkidle2' });
    
    console.log('Page loaded. Waiting a bit to catch errors...');
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
    console.log('Done.');
  } catch (e) {
    console.error('Puppeteer Script Error:', e);
  }
})();
