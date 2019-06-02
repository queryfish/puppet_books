const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const Config = require('./configs');
const fs = require('fs');
// const cookieFile = './cookieFile';

async function saveCookieTest() {
  const usernameSel = '#TANGRAM__PSP_4__userName';
  const passwordSel = '#TANGRAM__PSP_4__password';
  const loginButtonSel = '#TANGRAM__PSP_4__submit';
  const loginTypeSel = 'p#TANGRAM__PSP_4__footerULoginBtn';

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto('https://pan.baidu.com', {waitUntil: 'networkidle2'});
  // await page.waitForNavigation({'waitUntil' : 'networkidle0'});
  await page.waitFor(5 * 1000);

  await page.click(loginTypeSel);
  // await page.waitForNavigation({'waitUntil' : 'networkidle0'});
  await page.click(usernameSel);
  await page.keyboard.type('goodman@126.com');

  await page.click(passwordSel);
  await page.keyboard.type('baiduyun_secret');

  await page.click(loginButtonSel);
  // await page.waitForNavigation();
  await page.waitFor(10*1000);

  // let cookie = page.cookies();
  const cookie = await page.cookies()
  Logger.info(JSON.stringify(cookie));
  await saveToJSONFile(cookie, Config.cookieFile);
  // await browser.close();
  // const newp = await browser.newPage();
  // await newp.setCookie(cookie);
  // await newp.goto('https://yun.baidu.com');

}

async function loadCookieTest() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null
  });

  const page = await browser.newPage();
  await injectCookiesFromFile(page, Config.cookieFile);
  await page.waitFor(10 * 1000);
  const cookie = await page.cookies();
  Logger.info("feedback cookie");
  Logger.info(JSON.stringify(cookie));
  await page.goto('https://pan.baidu.com/s/1PY14ZC9YufwPaJoxNMsFww', {waitUntil: 'networkidle2'});
  // await page.waitForNavigation({'waitUntil' : 'networkidle0'});

}

async function saveTest() {

  const usernameSel = '#TANGRAM__PSP_4__userName';
  const passwordSel = '#TANGRAM__PSP_4__password';
  const loginButtonSel = '#TANGRAM__PSP_4__submit';
  const loginTypeSel = 'p#TANGRAM__PSP_4__footerULoginBtn';

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto('https://yun.baidu.com', {waitUntil: 'networkidle2'});
  // await page.waitForNavigation({'waitUntil' : 'networkidle0'});
  await page.waitFor(5 * 1000);

  await page.click(loginTypeSel);
  // await page.waitForNavigation({'waitUntil' : 'networkidle0'});


  await page.click(usernameSel);
  await page.keyboard.type('goodman@126.com');

  await page.click(passwordSel);
  await page.keyboard.type('baiduyun_secret');

  await page.click(loginButtonSel);
  await page.waitForNavigation();

  //await browser.close();

  const baidu_url = 'http://pan.baidu.com/s/1c1LdP4G';
  const pickcode = 'njdv';
  const CHECKCODE_SELECTOR2 = 'dd.clearfix.input-area > input';
  const BUTTON_SELECTOR2 = 'dd.clearfix.input-area > div > a';
  await page.goto(baidu_url, {waitUntil: 'networkidle2'});
  await page.click(CHECKCODE_SELECTOR2);
  await page.keyboard.type(pickcode);
  await page.click(BUTTON_SELECTOR2);
  await page.waitForNavigation();

  const saveButtonSel = '#layoutMain > div.frame-content > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.g-button-blue';
  // const okButtonSel ='#fileTreeDialog > div.dialog-footer.g-clearfix > a:nth-child(2)';
  const okButtonSel ='#fileTreeDialog > div.dialog-footer.g-clearfix > a.g-button.g-button-blue-large';
  await page.click(saveButtonSel);
  // await page.waitForNavigation({'waitUntil' : 'networkidle0'});
  await page.waitFor(5*1000);
  await page.click(okButtonSel);
  await page.waitForNavigation();

}

 // /**
 //  * Write Cookies object to target JSON file
 //  * @param {String} targetFile
 //  */
 // async saveCookies(targetFile, cookies) {
 //   // let cookies = await this._page.cookies();
 //   return this.saveToJSONFile(cookies, this._cookiessPath + targetFile);
 // }

 // /**
 //  * Write JSON object to specified target file
 //  * @param {String} jsonObj
 //  * @param {String} targetFile
 //  */
 async function saveToJSONFile (jsonObj, targetFile) {
   // if( !/^\//.test(targetFile) )
      // return ;
     // targetFile = this._jsonsPath + targetFile;
   return new Promise((resolve, reject) => {

     try {
        var data = JSON.stringify(jsonObj);
        Logger.info("Saving object '%s' to JSON file: %s", data, targetFile);
     }
     catch (err) {
       Logger.info("Could not convert object to JSON string ! " + err);
       reject(err);
     }

     // Try saving the file.
     fs.writeFile(cookieFile, data, (err, text) => {
       if(err){
         Logger.info(err);
         reject(err);
       }
       else {
         resolve(targetFile);
       }
     });

   });
}

// process.argv.slice(2).forEach(function (val, index, array) {
//   Logger.info(index + ': ' + val);
//   fetchBookByUrl(val);
// });
(async () => {
    try {
      await saveCookieTest();
    } catch (e) {
      throw(e);
        // Deal with the fact the chain failed
    }
})();

// process.exit(0);
