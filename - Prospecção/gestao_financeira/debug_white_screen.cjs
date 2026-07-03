const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Catch errors
    page.on('console', msg => {
      console.log(`[CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Go to the domain first so we can set localStorage
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    
    // Inject localStorage
    await page.evaluate(() => {
      localStorage.setItem('ruth_dias_portfolio', JSON.stringify([{
        id: 'p_875xrybl1',
        title: 'Dummy Property',
        type: 'Usado',
        city: 'Brasília',
        neighborhood: 'Asa Norte',
        price: 'R$ 1.000.000',
        description: 'Test description',
        imageUrl: 'http://example.com/img.jpg',
        gallery: [],
        garages: '2',
        rooms: '3',
        area: '100',
        featured: false,
        isActive: true
      }]));
      
      localStorage.setItem('ruth_dias_user', JSON.stringify({
        id: '1', name: 'Test User', role: 'admin', favorites: []
      }));
    });
    
    console.log('Navigating to http://localhost:5173/imovel/p_875xrybl1 ...');
    await page.goto('http://localhost:5173/imovel/p_875xrybl1', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    
    const html = await page.evaluate(() => document.body.innerHTML);
    if (html.length < 1000) {
      console.log('[BODY HTML] Body seems small: ', html);
    } else {
      console.log('[BODY HTML] Body rendered normally, ' + html.length + ' chars');
    }
    
    await browser.close();
  } catch (e) {
    console.error(e);
  }
})();
