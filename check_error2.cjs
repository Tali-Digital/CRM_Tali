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
    console.log('STACK:', error.stack);
  });

  await page.goto('http://localhost:3000/#/editor_prospeccao', { waitUntil: 'networkidle2' });
  
  // Wait a bit just in case
  await new Promise(r => setTimeout(r, 2000));

  // Try to click the first prospect in the list
  try {
    const editButtons = await page.$$('button');
    let clicked = false;
    for (const btn of editButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      // Find a button that might open the GeradorProspeccao. Maybe it has an icon?
      // Actually, in GestaoProspeccaoEditor, the "Editar" button has a specific class or icon.
      // Let's just click all buttons that look like edit.
    }
    // Alternatively, just evaluate a script to click the tr or edit button
    await page.evaluate(() => {
      const editBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerHTML.includes('Edit2') || b.innerHTML.includes('file-text') || b.innerHTML.includes('Gerar Carta'));
      if(editBtns.length > 0) editBtns[0].click();
      
      const links = Array.from(document.querySelectorAll('a')).filter(a => a.innerHTML.includes('Gerar') || a.innerHTML.includes('Editar'));
      if(links.length > 0) links[0].click();
    });
  } catch (e) {
    console.log("Error clicking:", e.message);
  }

  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
