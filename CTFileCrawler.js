const puppeteer = require('puppeteer');
const fs = require('fs');
const mongoose = require('mongoose');
const process = require('process');
const Book = require('./models/book');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;
const StatsLogger = LOG4JS.stats_logger;
const CREDS = require('./creds');
const Configs = require('./configs');

var statCount = 0;

async function upsertBook(bookObj) {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { bookUrl: bookObj.bookUrl };
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

async function fetchBook(sobookUrl, bookUrl)
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
  client.send('Network.setRequestInterception', {
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

  var isBrowserClosed = false;
  await browser.on( 'disconnected', async ()=>{
      Logger.trace('Browser is closed');
      isBrowserClosed = true;
  });

  // await page.goto(bookUrl, {waitUntil: 'load'});
  // await page.goto(bookUrl);
  await page.goto(bookUrl, {waitUntil: 'networkidle2', timeout:0,});
  await page.waitFor(5*1000);

  var is_mobi_page = false;
  const BOOK_FILE_SEL = '#page-content > div.page-header.position-relative > div > div.pull-left > h3';
  let book_file_name = await getTextContent(page, BOOK_FILE_SEL);
  Logger.trace('resolved book name'+ book_file_name);
  if(book_file_name !=null && book_file_name.indexOf(".mobi")>0)
  {
      Logger.info(book_file_name+" Direct Page Found");
      is_mobi_page = true;
  }

  if(is_mobi_page)
  {
    const DL_BUTTON = '#free_down_link';
    // await page.waitFor(5*1000);//会有找不到输入框的异常，加上一个弱等待试试
    // let download_href = await getSelectorHref(page, BOOK_SEL);
    await page._client.send('Page.setDownloadBehavior', {
          behavior: 'deny'
        });
    // page.click(BOOK_SEL);
    // await page.goto(download_href, {waitUntil: 'load'});
    await page.on('response', async response => {
        // If response has a file on it
        if (response._headers['content-disposition'] === 'attachment') {
           // Get the size
           var bookSize = Number(response._headers['content-length']);
           var download_url =response._url;
           Logger.trace('BOOK Size : '+ bookSize);
           Logger.info("DOWNLOAD URL CATCHED!!");
           // save url to DB for later download workers.
           await upsertBook({"bookUrl":sobookUrl,
                             "ctdownloadUrl":download_url,
                             "bookSize":bookSize,
                             "hasMobi":true
                           });
           statCount ++;
           await browser.close();
           //statLogger();
           // var child = require('child_process').fork(Configs.workingPath+'CTDownloader.js',[download_url] );
           // await CTDownloader.downloadBook(download_url);
        }
    });

    await page.click(DL_BUTTON);
    await page.waitFor(10*1000);
    // set timeout to close a browser for leak provention
    // await browser.close();
    // setTimeout(()=>{ await browser.close() }, 2*, 'funky');
    Logger.trace("About to exit the CTFileCrawl mini Session");
  }
  else{
    //we can do more than HAS MOBI
    await upsertBook({"bookUrl":sobookUrl,
                      "hasMobi":false
                    });
    //should mark the book as mobi-less version
  }
  if(isBrowserClosed == false)
  {
    Logger.info("FORCING browser to close.");
    await browser.close();
  }

  return ;

}

async function fetchBookDir(sobookUrl, bookUrl)
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
  client.send('Network.setRequestInterception', {
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



  var isBrowserClosed = false;
  await browser.on( 'disconnected', async ()=>{
      Logger.trace('Browser is closed');
      isBrowserClosed = true;
  });



  // await page.goto(bookUrl, {waitUntil: 'load'});
  // await page.goto(bookUrl);
  await page.goto(bookUrl, {waitUntil: 'networkidle2', timeout:0,});
  await page.waitFor(5*1000);
  const BOOK_SEL = '#table_files > tbody > tr:nth-child(INDEX) > td:nth-child(2) > a';
  // const BOOK_SEL = '#table_files > tbody > tr.even > td:nth-child(2) > a';
  var download_href = "";
  for (var i = 1; i < 4; i++) {
    let booknameSelector = BOOK_SEL.replace("INDEX", i);
    if (await page.$(booknameSelector) != null)
    {
        let bookname = await getTextContent(page, booknameSelector);

        // Logger.trace("trying to find the mobi format url for "+bookname);
        if(bookname !=null && bookname.split(".")[1] == "mobi"){
          Logger.info(bookname+" Found");
          download_href = await getSelectorHref(page, booknameSelector);
          // Logger.trace(download_href);
          break;
        }
    }

  }

  if(download_href.length > 0){
    const DL_BUTTON = '#free_down_link';
    // await page.waitFor(5*1000);//会有找不到输入框的异常，加上一个弱等待试试
    // let download_href = await getSelectorHref(page, BOOK_SEL);
    var site = "https://sobooks.ctfile.com";
    download_href = site + download_href;
    Logger.trace("PAGE FOUND:"+download_href);
    await page._client.send('Page.setDownloadBehavior', {
          behavior: 'deny'
        });
    // page.click(BOOK_SEL);
    // await page.goto(download_href, {waitUntil: 'load'});
    await page.on('response', async response => {
        // If response has a file on it
        if (response._headers['content-disposition'] === 'attachment') {
           // Get the size
           var bookSize = Number(response._headers['content-length']);
           var download_url =response._url;
           Logger.trace('BOOK Size : '+ bookSize);
           Logger.info("DOWNLOAD URL CATCHED!!");
           // save url to DB for later download workers.
           await upsertBook({"bookUrl":sobookUrl,
                             "ctdownloadUrl":download_url,
                             "bookSize":bookSize,
                             "hasMobi":true
                           });
           statCount ++;
           await browser.close();
           //statLogger();
           // var child = require('child_process').fork(Configs.workingPath+'CTDownloader.js',[download_url] );
           // await CTDownloader.downloadBook(download_url);
        }
    });
    await page.goto(download_href, {waitUntil: 'networkidle2', timeout:0,});
  // await page.waitFor(5*1000);//会有找不到输入框的异常，加上一个弱等待试试
    await page.click(DL_BUTTON);
    await page.waitFor(10*1000);
    // set timeout to close a browser for leak provention
    // await browser.close();
    // setTimeout(()=>{ await browser.close() }, 2*, 'funky');
    Logger.trace("About to exit the CTFileCrawl mini Session");
  }
  else{
    await upsertBook({"bookUrl":sobookUrl,
                      "hasMobi":false
                    });
    //should mark the book as mobi-less version
  }
  if(isBrowserClosed == false)
  {
    Logger.info("FORCING browser to close.");
    await browser.close();
  }

  return ;

}

function assertMongoDB()
{
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }
}

async function assertBook() {
  assertMongoDB();
  // const conditions = { "baiduUrl": {"$exists": false}} ;
  const conditions = { "$and":[{"ctdiskUrl": {"$exists": true}}
                               ,{"ctdownloadUrl":{"$exists":false}}
                               ,{"hasMobi":{"$exists": false}}
                               // ,{"savedBaidu":{$exists: false}}
                             ]
                     } ;
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
    var r = await assertBook();
    Logger.info(r.length+" books to be CTed ...");
    // Logger.info(r);
    for (var i = 0; i < r.length; i++)
    {
      book = r[i];
      Logger.trace("NO. "+i+" book: "+book.bookName);
      var book_url  = book.ctdiskUrl;
      //Should be before this function
      var split = book_url.split('/');
      if(split[3] == 'dir'){
        await fetchBookDir(book.bookUrl, book.ctdiskUrl);
      }
      else if(split[3] == 'fs')
      {
        Logger.trace('gonna go :'+book_url);
        await fetchBook(book.bookUrl, book.ctdiskUrl);
      }
    }
    StatsLogger.info("CTFileCrawler catch rate :"+statCount+"/"+r.length);
    //statLogger();
}

/*
 main
*/
(async () => {
    try {
      Logger.info("CTFileCrawler Session roll out PID: ", process.pid);
      await automate();
      mongoose.connection.close();
      Logger.info("CTFileCrawler Session END PID: ", process.pid);
      // as the CTFileCrawler often STALLED for the sake of FileDownloading Async Calls
      // we should check it to kill itself and children as well.
      // NOTE!!! Such way works, the scheduler should not shoot the Jammer.
      // Logger.warn("And I should kill myself here and now @"+process.pid);
      // process.kill(process.pid, "SIGINT");

    } catch (e) {
      Logger.error(e);
      throw(e);
    }

})();
