const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const mongoose = require('mongoose');
const Book = require('./models/book');
const fs = require('fs');
// const detailCrawler = require('./detailCrawler');
const MAX_CRAWL_NUM = 1000;
const DB_BATCH = 5;
const cookieFile = './cookieJar';

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

async function assertBook() {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { "$and":[
                          {"baiduUrl": {"$exists": true}},
                          {"baiduCode":{"$exists":true}},
                          {"lastCrawlCopyTime":{"$exists":false}}
                        ] };
  const options = { limit: 5 };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  return result;
}

async function getTextContent(page, selector) {
  let tc = await page.evaluate((sel) => {
    if(document.querySelector(sel) != null)
      return document.querySelector(sel).textContent;
    else
      return null;
  }, selector);
  return tc;
}

async function grabABook_BDY(page, bookObj) {

    const baidu_url = bookObj.baiduUrl;
    const pickcode = bookObj.baiduCode;
    console.log("going to cloud ..."+baidu_url);

    const CHECKCODE_SELECTOR2 = 'dd.clearfix.input-area > input';
    const BUTTON_SELECTOR2 = 'dd.clearfix.input-area > div > a';
    await page.goto(baidu_url, {waitUntil: 'networkidle2'});
    await page.waitFor(5*1000);//会有找不到输入框的异常，加上一个弱等待试试
    await page.click(CHECKCODE_SELECTOR2);
    await page.keyboard.type(pickcode);
    await page.click(BUTTON_SELECTOR2);
    await page.waitForNavigation();

    // const saveButtonSel = '#layoutMain > div.frame-content > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.g-button-blue';
    // const okButtonSel ='#fileTreeDialog > div.dialog-footer.g-clearfix > a:nth-child(2)';
    // check the file or folder
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
        console.log('folder found');
        await page.click(FILE_CHECK_SEL);
        saveButtonSel = '#bd-main > div > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.g-button-blue';
    }
    else{
        console.log('folder no found');
        saveButtonSel = '#layoutMain > div.frame-content > div.module-share-header > div > div.slide-show-right > div > div > div.x-button-box > a.g-button.g-button-blue'
    }

    // await page.click(FILE_CHECK_SEL);
    await page.click(saveButtonSel);
    await page.waitFor(7*1000);

    // If the target named dir exist , save to it, else save to top dir.
    var tree_dir_sel = '#fileTreeDialog > div.dialog-body > div > ul > li > ul > li:nth-child(2) > div > span > span';
    let  dir_name_text = await getTextContent(page, tree_dir_sel);
    if(dir_name_text == "A_bookstore"){
      await page.click(tree_dir_sel);
      await page.waitFor(1*1000);
    }

    const okButtonSel ='#fileTreeDialog > div.dialog-footer.g-clearfix > a.g-button.g-button-blue-large';
    await page.click(okButtonSel);
    // await page.waitForNavigation();
    const MSG_SEL = 'body > div.module-yun-tip > div > span.tip-msg'
    // try {
      await page.waitFor(10*1000);
      await page.waitForSelector(MSG_SEL, {timeout: 10000});
      let rsp_msg = await page.evaluate((sel) => {
        let msg = document.querySelector(sel).textContent;
        return msg;
      }, MSG_SEL);
      console.log(rsp_msg);
      await page.waitFor(5*1000);
      upsertBook({
        bookUrl:bookObj.bookUrl,
        lastCrawlCopyTime: new Date(),
        lastCrawlCopyResultMessage : rsp_msg,
      })

    // }
    // catch(err){
    //   throw err;
    // }

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

 /**
 * Inject cookies from previously saved cookies file
 * @param {string} file
 */

async function injectCookiesFromFile(page, file)
{
  let cb = async function (page, cookie)
  {
      await page.setCookie(cookie); // method 2
  };

  fs.readFile(file, async function(err, data) {
      if(err)
          throw err;
      let cookies = JSON.parse(data);
      console.log(cookies);
      for (var i = 0, len = cookies.length; i < len; i++)
          await cb(page, cookies[i]); // method 2
  });
 }

async function automate() {
  /*
  1- query from mongodb for impartial entry to be further crawl for detail
  2- use the crawl func and save it to db
  3- stop when MAX_CRAWL_NUM exceed or the db is out of candidate
  */
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null
  });

  const page = await browser.newPage();
  await injectCookiesFromFile(page, cookieFile);
  await page.waitFor(5 * 1000);

  var tick = 0;
  var r = await assertBook();
  // console.log(r);
  console.log(r.length+" books to crawl ...");
  // while(r.length>0 )
    // && tick < MAX_CRAWL_NUM)
    // {
    // console.log(r);
    // while(r.length == 0 && tick < MAX_CRAWL_NUM)
    // {
    //   await detailCrawler.crawl();
    //   r = await assertBook();
    //   tick++;
    // }
    for (var i = 0; i < r.length; i++) {
      book = r[i];
      console.log("crawling book detail "+book.bookName)
      console.log("fetching from -> "+book.bookUrl);
      if(book.baiduUrl.startsWith("https://pan.baidu.com"))
        await grabABook_BDY(page, book);
      tick ++;
      console.log(tick + "th book has been crawled");
    }
    // r = await assertBook();
  // }
  await browser.close();

}

async function retry(maxRetries, fn) {
  console.log("retry time "+maxRetries);
  return await fn().catch(function(err) {
    if (maxRetries <= 0) {
      throw err;
    }
    return retry(maxRetries - 1, fn);
  });
}
/*
 main
*/
(async () => {
    // try {
      await automate();
    // } catch (e) {
    //   throw(e);
    // }
    // return;
    // retry(10, automate)
})();
