const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const mongoose = require('mongoose');
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

  //pager selector
  //body > section > div.content-wrap > div > div.pagination > ul > li:nth-child(10) > span

  console.log('Numpages: ', MAX_PAGE_NUM);
  var max_pages = MAX_PAGE_NUM;
  for (let p = 1; p <= max_pages; p++)
  {
    // let pageUrl = BOOK_INFO_SITE+'/page/'+h;
    let pageUrl = uri_formatter(p);
    await page.goto(pageUrl);
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

      console.log('NO.',p,i,bookname, ' -> ', bookurl);
      upsertBook({
        bookName: bookname,
        bookUrl: bookurl,
        dateCrawled: new Date()
      });
    }
    await page.waitFor(5*1000);
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
      await crawlBookList()
      // process.exit(0);
    } catch (e) {
        throw(e)
        // Deal with the fact the chain failed
    }
})();
