const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const Config = require('./configs');
const mongoose = require('mongoose');
const CrawlerConfig = require('./models/crawlerConfig');
const Book = require('./models/book');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;
const fs = require('fs');
const MAX_PAGE_NUM = 200;
const MAX_TICKS = 2000;
const BOOK_INFO_SITE = 'http://sobooks.cc'

// const db = mongoose.connect( Config.dbUrl,{}
  // {
  //   // sets how many times to try reconnecting
  //   reconnectTries: Number.MAX_VALUE,
  //   // sets the delay between every retry (milliseconds)
  //   reconnectInterval: 1000
  //   }
// );

async function crawlBookListByPage(pageNum)
{
  pageUrl = 'https://sobooks.cc/page/'+pageNum;
  // searchUrl = 'https://sobooks.cc/search/'+qString;
  let result = await crawlBookList(pageUrl);
  return result;
}

async function getMaxCursor() {
  assertMongoDB();
  var query = Book.find({}).sort({"cursorId" : -1}).limit(1);
  const result = await query.exec();
  Logger.info("Getting Max BookId");
  Logger.info(result);
  if (result.length >0)
    return result[0].cursorId;
  else
      return 0;
}

async function getCursor() {
  assertMongoDB();
  const conditions = { "index": {"$eq":1 } };
  const options = { limit: 1 };
  var query = CrawlerConfig.find(conditions ,null ,options);
  const result = await query.exec();
  return result;
}

async function upsertCursor(cursorUpdate)
{
  assertMongoDB();
  var config = {cursor:cursorUpdate};
  const conditions = { index:1 };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  const q = CrawlerConfig.findOneAndUpdate(conditions, config, options);
  await q.exec();
}

async function crawlBookListScanner()
{
  var bookId = 970;
  var tick =1;
  // searchUrl = 'https://sobooks.cc/search/'+qString;
  // let result = await crawlBookList(pageUrl);
  // return result;
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();

  while(bookId >0 && tick < MAX_TICKS){
      var pageUrl = 'https://sobooks.cc/books/'+bookId+".html";
      var exist = await assertBook(pageUrl);
      if(exist == null || exist.length == 0){
          let res = await page.goto(pageUrl);
          if (res && res.status() == 404) {
            Logger.error("!!!! invalid url "+ pageUrl);
          }
          else {
            Logger.trace("Valid URL "+ pageUrl);
            await upsertBook({bookUrl:pageUrl});
          }
      }
      else{
        Logger.trace("exist book url "+pageUrl);
      }
      bookId --;
      tick ++;

  }

}

async function greedyDigger()
{
  await greedyDiggerWithFormatter((p)=>{
    return (BOOK_INFO_SITE+'/page/'+p);
  });
}

async function crawlBookListPlain()
{
  await crawlBookList((p)=>{
    return (BOOK_INFO_SITE+'/page/'+p);

  });
}

async function crawlBookListByTag(page, tag)
{
  await crawlBookList(page, (p)=>{
    // https://sobooks.net/books/tag/%E5%B0%8F%E8%AF%B4/page/1
    return (BOOK_INFO_SITE+'/books/tag/'+tag+'/page/'+p);
  });
}

async function crawlBookList(page, uri_formatter)
{
  const CARDLIST_SEL = '#cardslist';
  const LENGTH_SELECTOR_CLASS   = 'card-item';
  const LIST_BOOKNAME_SELECTOR  =  '#cardslist > div:nth-child(INDEX) > div > h3 > a';
  const LIST_BOOKURL_SELECTOR   =  '#cardslist > div:nth-child(INDEX) > div > div > a';
  const LIST_META_SELECTOR      =  '#cardslist > div:nth-child(INDEX) > div > div > div > a';
  const LIST_AUTHOR_SELECTOR    =  '#cardslist > div:nth-child(INDEX) > div > p > a';
  const LIST_PAGE_MAX_SELECTOR  = 'body > section > div.content-wrap > div > div.pagination > ul > li:nth-last-child(1) > span';
  // const LIST_THUMBNAIL_SELECTOR = '';

  Logger.trace('Numpages: ', MAX_PAGE_NUM);
  var max_pages = MAX_PAGE_NUM;
  //数据库中保存的是最大的BookID: crawlerCursor
  // let crawlerCursorObj = await getCursor();
  let crawlerCursor = await getMaxCursor();
  // var crawlerCursor = 0;
  // if(crawlerCursorObj.length >0)
  //     crawlerCursor = crawlerCursorObj[0]["cursor"];
  //由于爬虫是按照BookId的降序爬取的，所以要保存一个爬到的最大值 : maxCursor
  var maxCursor = 0;
  //用于保存当前爬取的书目的BookId: currentBookId
  var currentBookId = crawlerCursor+5;
  //接下来要考虑洞的问题

  Logger.trace("start crawling ");
  Logger.trace("Max BoodId = "+crawlerCursor);
  Logger.trace("starting BookId = "+currentBookId);

  for (let p = 1; p <= max_pages && currentBookId >= crawlerCursor; p++)
  {
    var statCounter = 0;
    // let pageUrl = BOOK_INFO_SITE+'/page/'+h;
    let pageUrl = uri_formatter(p);
    await page.goto(pageUrl, {waitUntil: 'networkidle2'});
    let listLength = await page.evaluate((sel) => {
      return document.getElementsByClassName(sel).length;
    }, LENGTH_SELECTOR_CLASS);

    let max_pages = await page.evaluate((sel) => {
      var mp = document.querySelector(sel).textContent;
      var numb = mp.match(/\d/g);
      return numb.join("");
    }, LIST_PAGE_MAX_SELECTOR);

    Logger.trace('starting '+p+'th PAGE of '+max_pages+' pages');
    Logger.trace('crawling '+pageUrl);

    for (let i = 1; i <= listLength && currentBookId >= crawlerCursor; i++)
    {
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

      if(bookurl != null && typeof(bookurl)!="undefined"&&bookurl!="")
      {
          var bookId = bookurl.split("/").pop().split(".").shift();
          currentBookId = Number(bookId);
          if(currentBookId > maxCursor) maxCursor = currentBookId;
          Logger.trace("get book Id "+currentBookId);
          statCounter ++ ;
      }

      Logger.info('NO.'+statCounter+" "+bookname+ ' -> '+ bookurl);
      await upsertBook({
        bookName: bookname,
        bookUrl: bookurl,
        cursorId: currentBookId,
        dateCrawled: new Date()
      });
    }
    // await page.waitFor(5*1000);
  }
  // statCounter should be recorded here
  statLogger.info(statCounter+"BookId Crawled");
  Logger.trace("end crawling ");
  Logger.trace("crawlerCursor = "+crawlerCursor);
  Logger.trace("currentBookId = "+currentBookId);
  await upsertCursor(maxCursor);

}

async function greedyDiggerWithFormatter(uri_formatter)
{
  const CARDLIST_SEL = '#cardslist';
  const LENGTH_SELECTOR_CLASS   = 'card-item';
  const LIST_BOOKNAME_SELECTOR  =  '#cardslist > div:nth-child(INDEX) > div > h3 > a';
  const LIST_BOOKURL_SELECTOR   =  '#cardslist > div:nth-child(INDEX) > div > div > a';
  const LIST_META_SELECTOR      =  '#cardslist > div:nth-child(INDEX) > div > div > div > a';
  const LIST_AUTHOR_SELECTOR    =  '#cardslist > div:nth-child(INDEX) > div > p > a';
  const LIST_PAGE_MAX_SELECTOR  = 'body > section > div.content-wrap > div > div.pagination > ul > li:nth-last-child(1) > span';

  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();

  Logger.trace('Numpages: ', MAX_PAGE_NUM);
  var max_pages = MAX_PAGE_NUM;
  var ticks = 0;
  var currentBookId = 0;

  for (let p = 1; p <= max_pages ; p++)
  {
    // let pageUrl = BOOK_INFO_SITE+'/page/'+h;
    let pageUrl = uri_formatter(p);
    await page.goto(pageUrl, {waitUntil: 'networkidle2', timeout:0});
    // await page.goto(pageUrl);
    // await page.waitFor(5*1000);
    let listLength = await page.evaluate((sel) => {
      return document.getElementsByClassName(sel).length;
    }, LENGTH_SELECTOR_CLASS);

    let max_pages = await page.evaluate((sel) => {
      var mp = document.querySelector(sel).textContent;
      var numb = mp.match(/\d/g);
      return numb.join("");
    }, LIST_PAGE_MAX_SELECTOR);


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

      if(bookurl != null && typeof(bookurl)!="undefined"&&bookurl!="")
      {
          var bookId = bookurl.split("/").pop().split(".").shift();
          currentBookId = Number(bookId);
      }
      await upsertBook({
        bookName: bookname,
        bookUrl: bookurl,
        cursorId: currentBookId,
        dateCrawled: new Date()
      });

      ticks++;
      Logger.trace('NO.',ticks ,bookname, ' -> ', bookurl, ' Page ', p);

    }
    // await page.waitFor(5*1000);
  }
  Logger.trace("job finished ...");
  await browser.close();

}

function assertMongoDB() {
  //
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
  }
}

async function upsertBook(bookObj) {
  assertMongoDB();
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  let q = Book.findOneAndUpdate(conditions, bookObj, options);
  await q.exec();
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

function isInvalidValue(v) {
  if(typeof(v) == "undefined") return true;
  if(v == null) return true;
  if(v == "") return true;
  return false;
}

// exports.run =
async function fakeMain(page)
{
  await crawlBookList(page, (p)=>{
    return (BOOK_INFO_SITE+'/page/'+p);
  });
}

/**** main ***/
// const process = require('process');
(async () => {
    try {
        Logger.info('List Crawler Session STARTED PID@ '+process.pid);
        const browser = await puppeteer.launch({
          headless: true
        });
        const page = await browser.newPage();
        await crawlBookList(page, function(p){
          return (BOOK_INFO_SITE+'/page/'+p);
        });
        await browser.close();
        await mongoose.connection.close();
        Logger.info('List Crawler Session END PID@ '+process.pid);
    } catch (e) {
        Logger.error(e);
        throw(e);
    }

})();
