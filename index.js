const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const mongoose = require('mongoose');
const Book = require('./models/book');
const Logger = require('./logger').Logger;
const fs = require('fs');
const detailCrawler = require('./detailCrawler');
const cookieFile = './cookieFile';

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
  await page.goto('https://pan.baidu.com');
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
  await saveToJSONFile(cookie, '~/Downloads/temp/tmp');
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
  await injectCookiesFromFile(page, './tmpcook');
  await page.waitFor(10 * 1000);
  const cookie = await page.cookies();
  Logger.info("feedback cookie");
  Logger.info(JSON.stringify(cookie));
  // await page.goto('https://pan.baidu.com');
  await page.goto('https://pan.baidu.com/s/1PY14ZC9YufwPaJoxNMsFww');
  // await page.waitForNavigation({'waitUntil' : 'networkidle0'});

}

async function crawlBookListByPage(pageNum)
{
  pageUrl = 'https://sobooks.cc/page/'+pageNum;
  // searchUrl = 'https://sobooks.cc/search/'+qString;
  let result = await crawlBookList(pageUrl);
  return result;
}

async function crawlBookList(booklistUrl)
{
  const CARDLIST_SEL = '#cardslist';
  const LENGTH_SELECTOR_CLASS   = 'card-item';
  const LIST_BOOKNAME_SELECTOR  =  '#cardslist > div:nth-child(INDEX) > div > h3 > a';
  const LIST_BOOKURL_SELECTOR   =  '#cardslist > div:nth-child(INDEX) > div > div > a';
  const LIST_META_SELECTOR      =  '#cardslist > div:nth-child(INDEX) > div > div > div > a';
  const LIST_AUTHOR_SELECTOR    =  '#cardslist > div:nth-child(INDEX) > div > p > a';
  // const LIST_THUMBNAIL_SELECTOR = '';

  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();

  const numPages = 10
  Logger.info('Numpages: ', numPages);

  for (let h = 1; h <= numPages; h++)
  {
    let pageUrl = booklistUrl+'/page/'+h;
    await page.goto(pageUrl);
    let listLength = await page.evaluate((sel) => {
      return document.getElementsByClassName(sel).length;
    }, LENGTH_SELECTOR_CLASS);
    Logger.info('staring Page NO.'+h);

    for (let i = 1; i <= listLength; i++) {
      // change the index to the next child
      let booknameSelector = LIST_BOOKNAME_SELECTOR.replace("INDEX", i);
      let metaSelector = LIST_META_SELECTOR.replace("INDEX", i);
      let bookurlSelector = LIST_BOOKURL_SELECTOR.replace("INDEX", i);
      let authorSelector = LIST_AUTHOR_SELECTOR.replace("INDEX", i);

      let bookname = await page.evaluate((sel) => {
        var bookname = document.querySelector(sel).textContent;
        return bookname;
      }, booknameSelector);


      let bookurl = await page.evaluate((sel) => {
        var burl = document.querySelector(sel).getAttribute('href');
        return burl;
      }, bookurlSelector);

      // let email = await page.evaluate((sel) => {
      //   let element = document.querySelector(sel);
      //   return element ? element.innerHTML : null;
      // }, emailSelector);

      // not all users have emails visible
      // if (!email)
        // continue;

      Logger.info('NO.',h,i,bookname, ' -> ', bookurl);
      upsertBook({
        bookName: bookname,
        bookUrl: bookurl,
        dateCrawled: new Date()
      });
    }
  }

  await browser.close();
}

function assertMongoDB() {
  const DB_URL = 'mongodb://localhost/sobooks';
  if (mongoose.connection.readyState == 0) {
    mongoose.connect(DB_URL);
  }
}

function upsertBook(bookObj) {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  Book.findOneAndUpdate(conditions, bookObj, options, (err, result) => {
    if (err) {
      throw err;
    }
  });
}

async function assertBook(bookInfoUrl) {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { bookUrl: bookInfoUrl };
  // const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  var query = Book.findOne(conditions);
  const result = await query.exec();
  return result;
}

async function crawlAndSaveBooKInfo(bookInfoUrl) {

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto(bookInfoUrl);
  await page.waitFor(5 * 1000);

  // dom element selectors
  const CHECKCODE_SELECTOR = 'input.euc-y-i';
  const PASSWORD_SELECTOR = '#password';
  // const BUTTON_SELECTOR = '#login > form > div.auth-form-body.mt-3 > input.btn.btn-primary.btn-block';
  const BUTTON_SELECTOR = 'input.euc-y-s';

  Logger.info("getting book pickcode ...");
  // Logger.info(page.$('h1.article-title'));
  // var msg = document.querySelector('h1.article-title');
  let emial = await page.evaluate((sel) => {
    // let element = document.querySelector(sel).getAttribute("href");
    let element = document.querySelector(sel).textContent;
    return element;
  }, 'h1.article-title > a');
  Logger.info(emial);

  await page.click(CHECKCODE_SELECTOR);
  await page.keyboard.type(CREDS.checkcode);
  // await page.click(PASSWORD_SELECTOR);
  // await page.keyboard.type(CREDS.password);
  await page.click(BUTTON_SELECTOR);
  await page.waitFor(5*1000);

  let secret = await page.evaluate((sel) => {
    // let element = document.querySelector(sel).getAttribute("href");
    let element = document.querySelector(sel).textContent;
    return element;
  }, 'div.e-secret > strong');

  Logger.info("wait for secret");
  Logger.info(secret);

  var l = secret.length
  const pickcode  = secret.substring(l-4, l);
  Logger.info(pickcode);

  // const url_selector = 'table.dltable > tbody > tr:nth-child(2) > td > a:nth-child(0)';
  const url_selector = 'table.dltable > tbody * a:first-of-type';
  let dl_url = await page.evaluate((sel) => {
    let baidu_url = document.querySelector(sel).getAttribute("href");
    Logger.info(baidu_url);
    return baidu_url;
  }, url_selector);

  Logger.info("wait for url");
  Logger.info(dl_url);

  /*parse the download url*/
  const temp_url = new URL(dl_url);
  const baidu_url  = temp_url.searchParams.get('url');

  var bookInfo = {
      bookUrl: bookInfoUrl,
      baiduUrl: baidu_url,
      baiduCode: pickcode
  };
  upsertBook(bookInfo);
  await browser.close();
  return bookInfo;

}

async function grabABook_BDY(bookObj) {

    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null
    });

    const page = await browser.newPage();
    await injectCookiesFromFile(page, './tmpcook');
    await page.waitFor(5 * 1000);

    const baidu_url = bookObj.baiduUrl;
    const pickcode = bookObj.baiduCode;
    Logger.info("going to cloud ..."+baidu_url);

    const CHECKCODE_SELECTOR2 = 'dd.clearfix.input-area > input';
    const BUTTON_SELECTOR2 = 'dd.clearfix.input-area > div > a';
    await page.goto(baidu_url);
    await page.click(CHECKCODE_SELECTOR2);
    await page.keyboard.type(pickcode);
    await page.click(BUTTON_SELECTOR2);
    await page.waitForNavigation();

    // const saveButtonSel = '#layoutMain > div.frame-content > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.g-button-blue';
    // const okButtonSel ='#fileTreeDialog > div.dialog-footer.g-clearfix > a:nth-child(2)';
    const okButtonSel ='#fileTreeDialog > div.dialog-footer.g-clearfix > a.g-button.g-button-blue-large';
    // check the file or folder
    // #shareqr > div.KPDwCE > div.QxJxtg > div > ul.QAfdwP.tvPMvPb > li.fufHyA.yfHIsP.JFaAINb > div
    // #shareqr > div.KPDwCE > div.zJMtAEb > div > div > dd > div.file-name > div.text
    // #shareqr > div.KPDwCE > div.zJMtAEb > div > div > dd > div.file-name
    // #shareqr > div.KPDwCE > div.zJMtAEb > div > div > dd > div.file-size
    // const FILE_CHECK_SEL = 'div.file-name';
    const FILE_CHECK_SEL = 'div.file-size';

    // check all the documents
    // const CHECK_ALL = '#shareqr > div.KPDwCE > div.QxJxtg > div > ul.QAfdwP.tvPMvPb > li.fufHyA.yfHIsP.JFaAINb > div > span.zbyDdwb'
    // const SAVE_BUTTON_SEL = '#bd-main > div > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.g-button-blue';
    // const DOWNLOAD_BUTTON_SEL = 'a.g-button.last-button';

    /*
      这里需要判断是文件夹还是单个文件，两种布局不一样，操作方式也不一样
    */
    var saveButtonSel = '';

    if (await page.$(FILE_CHECK_SEL) !== null) {
        Logger.info('folder found');
        await page.click(FILE_CHECK_SEL);
        saveButtonSel = '#bd-main > div > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.g-button-blue';
    }
    else{
        Logger.info('folder no found');
        saveButtonSel = '#layoutMain > div.frame-content > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.g-button-blue'
    }

    // await page.click(FILE_CHECK_SEL);
    await page.click(saveButtonSel);
    // await page.waitForNavigation({'waitUntil' : 'networkidle0'});
    await page.waitFor(5*1000);
    var tree_dir_sel = '#fileTreeDialog > div.dialog-body > div > ul > li > ul > li:nth-child(2) > div > span';
    await page.click(tree_dir_sel);
    await page.waitFor(1*1000);
    await page.click(okButtonSel);
    // await page.waitForNavigation();
    const MSG_SEL = 'body > div.module-yun-tip > div > span.tip-msg'
    try {
      await page.waitFor(10*1000);
      await page.waitForSelector(MSG_SEL, {timeout: 10000});
      let rsp_msg = await page.evaluate((sel) => {
        let msg = document.querySelector(sel).textContent;
        return msg;
      }, MSG_SEL);
      Logger.info(rsp_msg);
      await page.waitFor(5*1000);
      upsertBook({
        bookUrl:bookUrl,
        lastCrawlCopyTime: new Date(),
        lastCrawlCopyResultMessage : rsp_msg,
      })
      // update Book.lastCrawlCopyTime & Book.lastCrawlCopyResultMessage in the database
      await browser.close();

    }
    catch(err){
      throw err;
    }

    // body > div.module-yun-tip > div > span.tip-msg  已为您成功保存文件

    /*
      这里需要判断是否操作成功，用于入库保存
    */


    // const FILE_CHECK_SEL = 'div.file-name';
    // const SAVE_BUTTON_SEL = '#bd-main > div > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.g-button-blue';
    // const DOWNLOAD_BUTTON_SEL = 'a.g-button.last-button';
    // await page.click(FILE_CHECK_SEL);
    // await page.click(DOWNLOAD_BUTTON_SEL);
    // await page.waitForNavigation();


}

function isInvalidValue(v) {
  if(typeof(v) == "undefined") return true;
  if(v == null) return true;
  if(v == "") return true;
  return false;
}

async function fetchBookByUrl(bookUrl){

  var result = await assertBook(bookUrl);
  Logger.info("query result ...main ")
  Logger.info(result);

  if( result == null || isInvalidValue(result["baiduUrl"]) || isInvalidValue(result["baiduCode"]))
  {
    result = await crawlAndSaveBooKInfo(bookUrl);
  }

  if(result["baiduUrl"] && result["baiduCode"])
  {
    await grabABook_BDY(result);
  }

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
  await page.goto('https://yun.baidu.com');
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
  await page.goto(baidu_url);
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

async function test() {
  const browser = await puppeteer.launch({
    headless: true
  });

  const page = await browser.newPage();

  // await page.goto('https://github.com');
  // await page.screenshot({ path: 'screenshots/github.png' });

  // await page.goto('https://github.com/login');
  await page.goto('https://sobooks.cc/books/12296.html');
  // await page.waitForNavigation({'waitUntil' : 'networkidle0'});
  await page.screenshot({path:'~/digg.png', fullPage: true});
  await browser.close();

}

async function run(bookurl) {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null
  });
  const page = await browser.newPage();

  await page.goto(bookurl);
  await page.waitFor(5*1000);
  // dom element selectors
  const CHECKCODE_SELECTOR = 'input.euc-y-i';
  const PASSWORD_SELECTOR = '#password';
  // const BUTTON_SELECTOR = '#login > form > div.auth-form-body.mt-3 > input.btn.btn-primary.btn-block';
  const BUTTON_SELECTOR = 'input.euc-y-s';

  Logger.info("get something");
  // Logger.info(page.$('h1.article-title'));
  // var msg = document.querySelector('h1.article-title');
  let email = await page.evaluate((sel) => {
    // let element = document.querySelector(sel).getAttribute("href");
    let element = document.querySelector(sel).textContent;
    return element;
  }, 'h1.article-title > a');
  Logger.info(email);

  await page.click(CHECKCODE_SELECTOR);
  await page.keyboard.type(CREDS.checkcode);
  await page.click(BUTTON_SELECTOR);
  await page.waitForNavigation();

  let secret = await page.evaluate((sel) => {
    // let element = document.querySelector(sel).getAttribute("href");
    let element = document.querySelector(sel).textContent;
    return element;
  }, 'div.e-secret > strong');

  Logger.info("wait for secret");
  Logger.info(secret);

  var l = secret.length
  const pickcode  = secret.substring(l-4, l);
  Logger.info(pickcode);

  // const url_selector = 'table.dltable > tbody > tr:nth-child(2) > td > a:nth-child(0)';
  const url_selector = 'table.dltable > tbody * a:first-of-type';
  let dl_url = await page.evaluate((sel) => {
    let baidu_url = document.querySelector(sel).getAttribute("href");
    Logger.info(baidu_url);
    return baidu_url;
  }, url_selector);

  Logger.info("wait for url");
  Logger.info(dl_url);

  /*parse the download url*/
  const temp_url = new URL(dl_url);
  const baidu_url  = temp_url.searchParams.get('url');

  const CHECKCODE_SELECTOR2 = 'dd.clearfix.input-area > input';
  const BUTTON_SELECTOR2 = 'dd.clearfix.input-area > div > a';
  await page.goto(baidu_url);
  await page.click(CHECKCODE_SELECTOR2);
  await page.keyboard.type(pickcode);
  await page.click(BUTTON_SELECTOR2);
  await page.waitForNavigation();

  const FILE_CHECK_SEL = 'div.file-name';
  const SAVE_BUTTON_SEL = '#bd-main > div > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.g-button-blue';
  const DOWNLOAD_BUTTON_SEL = 'a.g-button.last-button';
  await page.click(FILE_CHECK_SEL);
  await page.click(DOWNLOAD_BUTTON_SEL);
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
     fs.writeFile('./tmpcook', data, (err, text) => {
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

 /**
 * Inject cookies from previously saved cookies file
 * @param {string} file
 */

 async function injectCookiesFromFile(page, file) {

  let cb = async function (page, cookie) {
      Logger.info("Injecting cookies from file: %s", JSON.stringify(cookie) );
      //await page.setCookie(..._cookies); // method 1
      await page.setCookie(cookie); // method 2
  };

  fs.readFile(file, async function(err, data) {

      if(err)
          throw err;

      let cookies = JSON.parse(data);
      //await cb(cookies); // method 1

      for (var i = 0, len = cookies.length; i < len; i++)
          await cb(page, cookies[i]); // method 2
  });
 }


/**** main ***/
// run();
// test();
// saveCookieTest();
// loadCookieTest();

const process = require('process');

// process.argv.slice(2).forEach(function (val, index, array) {
//   Logger.info(index + ': ' + val);
//   fetchBookByUrl(val);
// });
(async () => {
    try {
      var v = process.argv.slice(2);
      await fetchBookByUrl(v[0]);
      process.exit(0);
    } catch (e) {
        // Deal with the fact the chain failed
    }
})();

// process.exit(0);

// autoSaveBooks('https://sobooks.cc/books/12251.html');
// crawlBookList('https://sobooks.cc');
// saveTest();
