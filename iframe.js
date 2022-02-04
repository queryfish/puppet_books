const puppeteer = require('puppeteer');
(async () => {
	    const browser = await puppeteer.launch({ headless: true });
	    const page = await browser.newPage();
	    await page.goto('https://sobooks.lanzouo.com/ikw9yzbabmj', { timeout: 80000 });
	    var frames = await page.frames();
	    var myframe = frames.find(
		            f =>{
				    console.log(f.url());
				    return f.url().indexOf("fn") > -1;});
	    //const serialNumber = await myframe.$("#MainContent_SerNumText");
	    console.log('we selected : '+myframe.url());
	    //const ser = await myframe.contentFrame();
	    const sir = await myframe.$("#go > a > span:nth-child(1)").contentText;
	const href_sel = '#go > a';
	const ser = await myframe.$eval(href_sel, h => { return h.getAttribute('href')});
	console.log(ser);
	    //await serialNumber.type("12345");

	    await page.screenshot({ path: 'example.png' });

	    await browser.close();
})();
