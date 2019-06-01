const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const mongoose = require('mongoose');
const CrawlerConfig = require('./models/crawlerConfig');
const Book = require('./models/book');
const fs = require('fs');
const MAX_PAGE_NUM = 200;
const MAX_TICKS = 2000;
const BOOK_INFO_SITE = 'http://sobooks.cc'

async function crawlBookListByPage(pageNum)
{
  pageUrl = 'https://sobooks.cc/page/'+pageNum;
  // searchUrl = 'https://sobooks.cc/search/'+qString;
  let result = await crawlBookList(pageUrl);
  return result;
}

function assertMongoDB() {
  const DB_URL = 'mongodb://localhost/sobooks';
  if (mongoose.connection.readyState == 0) {
    mongoose.connect(DB_URL);
  }
}

async function getCursor() {
  assertMongoDB();
  const conditions = { "index": {"$eq":1 } };
  const options = { limit: 1 };
  var query = CrawlerConfig.find(conditions ,null ,options);
  const result = await query.exec();
  return result;
}

function upsertCursor(cursorUpdate) {
  const DB_URL = 'mongodb://localhost/sobooks';
  if (mongoose.connection.readyState == 0) {
    mongoose.connect(DB_URL);
  }
  // if this email exists, update the entry, don't insert
  var config = {cursor:cursorUpdate};
  const conditions = { index:1 };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  CrawlerConfig.findOneAndUpdate(conditions, config, options, (err, result) => {
    if (err) {
      throw err;
    }
  });
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
            console.log("!!!! invalid url "+ pageUrl);
          }
          else {
            console.log("valid url "+ pageUrl);
            upsertBook({bookUrl:pageUrl});
          }
      }
      else{
        console.log("exist book url "+pageUrl);
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

async function crawlBookListByTag(tag)
{
  await crawlBookList((p)=>{
    // https://sobooks.net/books/tag/%E5%B0%8F%E8%AF%B4/page/1
    return (BOOK_INFO_SITE+'/books/tag/'+tag+'/page/'+p);
  });
}

async function crawlBookList(uri_formatter)
{
  const CARDLIST_SEL = '#cardslist';
  const LENGTH_SELECTOR_CLASS   = 'card-item';
  const LIST_BOOKNAME_SELECTOR  =  '#cardslist > div:nth-child(INDEX) > div > h3 > a';
  const LIST_BOOKURL_SELECTOR   =  '#cardslist > div:nth-child(INDEX) > div > div > a';
  const LIST_META_SELECTOR      =  '#cardslist > div:nth-child(INDEX) > div > div > div > a';
  const LIST_AUTHOR_SELECTOR    =  '#cardslist > div:nth-child(INDEX) > div > p > a';
  const LIST_PAGE_MAX_SELECTOR  = 'body > section > div.content-wrap > div > div.pagination > ul > li:nth-last-child(1) > span';
  // const LIST_THUMBNAIL_SELECTOR = '';

  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();

  console.log('Numpages: ', MAX_PAGE_NUM);
  var max_pages = MAX_PAGE_NUM;
  //数据库中保存的是最大的BookID: crawlerCursor
  let crawlerCursorObj = await getCursor();
  var crawlerCursor = crawlerCursorObj[0]["cursor"];
  crawlerCursor = 12706;
  //由于爬虫是按照BookId的降序爬取的，所以要保存一个爬到的最大值 : maxCursor
  var maxCursor = 0;
  //用于保存当前爬取的书目的BookId: currentBookId
  var currentBookId = 100000;
  //接下来要考虑洞的问题

  console.log("start crawling ");
  console.log("crawlerCursor = "+crawlerCursor);
  console.log("currentBookId = "+currentBookId);

  for (let p = 1; p <= max_pages && currentBookId >= crawlerCursor; p++)
  {
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

    console.log('starting '+p+'th PAGE of '+max_pages+' pages');
    console.log('crawling '+pageUrl);

    for (let i = 1; i <= listLength && currentBookId >= crawlerCursor; i++) {
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
          console.log("get book Id "+currentBookId);
          // 12725 the default page
      }

      console.log('NO.',p,i,bookname, ' -> ', bookurl);
      upsertBook({
        bookName: bookname,
        bookUrl: bookurl,
        dateCrawled: new Date()
      });
    }
    // await page.waitFor(5*1000);
  }
  console.log("end crawling ");
  console.log("crawlerCursor = "+crawlerCursor);
  console.log("currentBookId = "+currentBookId);

  upsertCursor(12706);
  await browser.close();
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

  console.log('Numpages: ', MAX_PAGE_NUM);
  var max_pages = MAX_PAGE_NUM;
  var ticks = 0;

  for (let p = 1; p <= max_pages ; p++)
  {
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

      upsertBook({
        bookName: bookname,
        bookUrl: bookurl,
        dateCrawled: new Date()
      });

      ticks++;
      console.log('NO.',ticks ,bookname, ' -> ', bookurl);

    }
    // await page.waitFor(5*1000);
  }
  console.log("job finished ...");
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

function isInvalidValue(v) {
  if(typeof(v) == "undefined") return true;
  if(v == null) return true;
  if(v == "") return true;
  return false;
}

/**** main ***/
// const process = require('process');
(async () => {
    try {
      // var v = process.argv.slice(2);
      // await crawlBookListScanner();
      // await crawlBookListByTag("小说")
      // await crawlBookListPlain()
      await greedyDigger();
      // process.exit(0);
    } catch (e) {
        throw(e)
        // Deal with the fact the chain failed
    }
})();
