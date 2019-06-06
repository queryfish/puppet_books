const puppeteer = require('puppeteer');
const fs = require('fs');
const mongoose = require('mongoose');
const Book = require('./models/book');
const Logger = require('./logger');
const CREDS = require('./creds');
const Configs = require('./configs');
const MAX_CRAWL_NUM = 200;
// const CTDownloader = require('./CTDownloader');

async function upsertBook(bookObj) {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }

  // if this email exists, update the entry, don't insert
  const conditions = { ctdiskUrl: bookObj.ctdiskUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  var query = Book.findOneAndUpdate(conditions, bookObj, options);
  const result = await query.exec();
  return ;
}

async function getSelectorHref(page, selector) {
  let tc = await page.evaluate((sel) => {
    if(document.querySelector(sel) != null){
      let baidu_url = document.querySelector(sel).getAttribute("href");
      return baidu_url;
    }
    else
      return null;
  }, selector);
  return tc;
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

async function fetchBook( bookUrl)
{
  const browser = await puppeteer.launch({
    headless: true,
      ignoreHTTPSErrors: true,
    defaultViewport: null
  });
  // Download and wait for download
  const page = await browser.newPage();
  // await injectCookiesFromFile(page, Configs.cookieFile);
  // await page.waitFor(5 * 1000);
  const client = await page.target().createCDPSession();

// intercept request when response headers was received
  await client.send('Network.setRequestInterception', {
    patterns: [{
        urlPattern: '*',
        resourceType: 'Document',
        interceptionStage: 'HeadersReceived'
    }],
  });

  await client.on('Network.requestIntercepted', async e => {
      let headers = e.responseHeaders || {};
      let contentType = headers['content-type'] || headers['Content-Type'] || '';
      let obj = {interceptionId: e.interceptionId};
      if (contentType.indexOf('application/zip') > -1) {
          obj['errorReason'] = 'BlockedByClient';
      }
      await client.send('Network.continueInterceptedRequest', obj);
  });

  await page.on('response', async response => {
      // If response has a file on it
      if (response._headers['content-disposition'] === 'attachment') {
         // Get the size
         var bookSize = Number(response._headers['content-length']);
         var download_url =response._url;
         console.log('Size del header: ', bookSize);
         console.log('Download url :', response._url);
         // save url to DB for later download workers.
         await upsertBook({"ctdiskUrl":bookUrl, "ctdownloadUrl":download_url, "bookSize":bookSize});
         // var child = require('child_process').fork(Configs.workingPath+'CTDownloader.js',[download_url] );
         // await CTDownloader.downloadBook(download_url);
         browser.close();
      }
  });

  // await page.goto(bookUrl, {waitUntil: 'networkidle2'});
  await page.goto(bookUrl);
  await page.waitFor(5*1000);
  const BOOK_SEL = '#table_files > tbody > tr:nth-child(INDEX) > td:nth-child(2) > a';
  // const BOOK_SEL = '#table_files > tbody > tr.even > td:nth-child(2) > a';
  var download_href = "";
  for (var i = 1; i < 4; i++) {
    let booknameSelector = BOOK_SEL.replace("INDEX", i);
    console.log(booknameSelector);
    if (await page.$(booknameSelector) != null)
    {
        let bookname = await getTextContent(page, booknameSelector);
        download_href = await getSelectorHref(page, booknameSelector);
        console.log(bookname);
        if(bookname !=null && bookname.split(".")[1] == "mobi"){
          console.log("found it");
          console.log(bookname);
          console.log(download_href);
          break;
        }
    }

  }

  if(download_href.length > 0){
    const DL_BUTTON = '#free_down_link';
    // await page.waitFor(5*1000);//会有找不到输入框的异常，加上一个弱等待试试
    // let download_href = await getSelectorHref(page, BOOK_SEL);
    var site = "https://sobooks.ctfile.com";
    Logger.info(download_href);
    download_href = site + download_href;
    await page._client.send('Page.setDownloadBehavior', {
          behavior: 'deny'
        });
  // page.click(BOOK_SEL);
    await page.goto(download_href, {waitUntil: 'networkidle2'});
  // await page.waitFor(5*1000);//会有找不到输入框的异常，加上一个弱等待试试
    await page.click(DL_BUTTON);
    await page.waitFor(10*1000);//会有找不到输入框的异常，加上一个弱等待试试
  }
  // await browser.close();
  return ;

}

async function crawl(page) {
   /*
   1- query from mongodb for impartial entry to be further crawl for detail
   2- use the crawl func and save it to db
   3- stop when MAX_CRAWL_NUM exceed or the db is out of candidate
   */
   var resultArray = await assertBook();
   Logger.info(resultArray.length+" books to copy ...");
   for (var i = 0; i < resultArray.length; i++) {
       var book = resultArray[i];
       Logger.info("NO."+i+": "+book.bookName+" -> "+book.bookUrl);
       if(book.baiduUrl.startsWith("https://pan.baidu.com"))
       {
         await grabABook_BDY(page, book);
       }
       else
       {
         //we do the check here and we save it backup to mongodb for further filter
         book["badApple"] = true;
         upsertBook(book);
       }
    }
}

async function automate() {
  /*
  1- query from mongodb for impartial entry to be further crawl for detail
  2- use the crawl func and save it to db
  3- stop when MAX_CRAWL_NUM exceed or the db is out of candidate
  */

}

function assertMongoDB() {

  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }
}

async function assertBook() {
  assertMongoDB();
  // const conditions = { "baiduUrl": {"$exists": false}} ;
  const conditions = { "$and":[
    {"ctdiskUrl": {"$exists": true}},{"ctdownloadUrl":{"$exists":false}}]} ;
  const options = { limit: Configs.crawlStep , sort:{"cursorId": -1} };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  return result;
}

// exports.run =
async function automate() {
  /*
  1- query from mongodb for impartial entry to be further crawl for detail
  2- use the crawl func and save it to db
  3- stop when MAX_CRAWL_NUM exceed or the db is out of candidate
  */
  var tick = 0;
  var r = await assertBook();
  // while(r.length > 0 && tick < max_crawled_items){
    Logger.info(r.length+" books to be CTed ...");
    // Logger.info(r);
    for (var i = 0; i < r.length; i++, tick++)
    {
      book = r[i];
      Logger.info("NO. "+i+" book: "+book.bookName);
      await fetchBook(book.ctdiskUrl);
      tick ++;
    }
    // r = await assertBook();
  // }
}


/*
 main
*/
(async () => {
    try {
      await automate();
    } catch (e) {
      throw(e);
      mongoose.connection.close();
    }
    mongoose.connection.close();

    // return;
    // retry(10, automate)
})();
