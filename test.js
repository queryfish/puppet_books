const puppeteer = require('puppeteer');

const AUTHOR_SEL      = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(2)';
const TAGS_SEL = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(5)';
const UPLOAD_DATE_SEL = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(6)';
const ISBN_SEL        = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(8)';
const BOOK_BRIEF_SEL  = 'body > section > div.content-wrap > div > article > p:nth-child(5)';
const AUTHOR_BRIEF_SEL= 'body > section > div.content-wrap > div > article > p:nth-child(8)';
const CATEGORY_SEL   = '#mute-category > a';

async function getTextContent(page, selector) {
  let tc = await page.evaluate((sel) => {
    if(document.querySelector(sel) != null)
      return document.querySelector(sel).textContent;
    else
      return null;
  }, selector);
  return tc;
}

async function test() {
  /*
  1- query from mongodb for impartial entry to be further crawl for detail
  2- use the crawl func and save it to db
  3- stop when MAX_CRAWL_NUM exceed or the db is out of candidate
  */
  const browser = await puppeteer.launch({
    headless: true
    // , defaultViewport: null
  });
  const url = 'https://sobooks.cc/books/12732.html';
  const page = await browser.newPage();
  Logger.info('going to ' + url);
  await page.goto(url, {waitUntil: 'networkidle2'});

  var bookObj = {};

  bookObj["author"] = await getTextContent(page, AUTHOR_SEL);
  let uploadDateString = await getTextContent(page, UPLOAD_DATE_SEL);
  bookObj["uploadDate"]  = uploadDateString.substring(3, uploadDateString.length);
  bookObj["bookSerial"]= await getTextContent(page, ISBN_SEL);
  bookObj["bookBrief"]  = await getTextContent(page, BOOK_BRIEF_SEL);
  bookObj["category"] = await getTextContent(page, CATEGORY_SEL);
  bookObj["tags"] = await getTextContent(page, TAGS_SEL);
  Logger.info(bookObj);

  browser.close();

}




/*
 main
*/
(async () => {
    await test();
})();
