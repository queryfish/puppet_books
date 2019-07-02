/*
  this version uses the Node Crawler and cherio jquery parser, for sake of profermance
*/
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const Book = require('./models/book');
const CREDS = require('./creds');
const Config = require('./configs');
const LOG4JS = require('./logger');
const Logger = LOG4JS.douban_logger;
const Crawler = require('crawler');
const request = require('async-request');
// const request = require('async-request');

const SEARCH_INPUT_SEL = '#inp-query';
const SEARCH_BUTTON_SEL = '#db-nav-book > div.nav-wrap > div > div.nav-search > form > fieldset > div.inp-btn > input[type=submit]';
const SEARCH_RESULT_LIST_SEL = '#root > div > div._2le4fbihe > div._ehwzi9rhh > div:nth-child(1) > div > div > div';
// const SEARCH_ISBN_RESULT_HREF_SEL = '#root > div > div._2le4fbihe > div._ehwzi9rhh > div:nth-child(1) > div > div > div > div.title > a'
const SEARCH_ISBN_RESULT_HREF_SEL ="div.detail > div.title > a";
const DETAIL_BOOK_INFO_BLOCK_SEL = '#info';
const DETAIL_PAGE_BOOK_INFO_LEN_SEL = '#info > span';
const DETAIL_PAGE_BOOK_INFO_SEL = '#info > span:nth-child(INDEX)';
const DETAIL_RATING_NUMBER_SEL = '#interest_sectl > div > div.rating_self.clearfix > strong';
const DETAIL_RATING_USER_NUMBER_SEL = '#interest_sectl > div > div.rating_self.clearfix > div > div.rating_sum > span > a';
// const DETAIL_BRIEF_SEL = '#link-report > span.short > div.intro';
const DETAIL_BRIEF_SEL = '#link-report > * > div.intro';
// const DETAIL_AUTHOR_BRIEF_SEL = 'div.related_info > div:nth-child(1) > * > div.intro';
const DETAIL_AUTHOR_BRIEF_SEL ='#content > div > div.article > div.related_info > div:nth-child(4) > div > div';
const DETAIL_TAGS_SEL = '#db-tags-section > div.indent  > span:nth-child(INDEX) > a';
const DETAIL_TAGS_SEL2 = '#db-tags-section > div.indent  > span ';
const DETAIL_TAGS_LEN_SEL = '#db-tags-section > div.indent > span';
const DETAIL_COMMENTS = '#content > div > div.article > div.related_info > div.mod-hd > h2 > span.pl > a';
const SEARCH_URL_TEMPLATE = 'https://book.douban.com/subject_search?search_text=ISBN&cat=1001';
const REC_SECTION_SEL = '#db-rec-section > div > dl';
const REC_SECTION_ARRAY_SEL = '#db-rec-section > div > dl > dt > a';
const TITLE_SEL = '#wrapper > h1 > span';
const COVER_SEL = '#mainpic > a > img';


async function parseAndSave(book)
{
  if(book.doubanBookMeta.length == 0)
    return ;
  var doubanISBN = getDoubanISBN(book.doubanBookMeta);
  if(doubanISBN != null && doubanISBN.length > 0){
    book.doubanISBN = doubanISBN;
    Logger.trace("-> "+book.doubanBookName+"("+book.doubanUrl+")");
    await upsertBook({doubanUrl:book.doubanUrl,
                      doubanISBN: doubanISBN
                    });
    statCount++
  }

}


function getDoubanISBN(array) {
  var isbn = null;
  for (var i = 0; i < array.length; i++) {
    var v = array[i];
    if(v.indexOf("ISBN:") >=0 && i < array.length-1)
    {
      isbn = array[i+1];
      break;
    }
  }
  return isbn;
}

var statCount = 0;

async function upsertBook(bookObj)
{
  assertMongoDB();
  const conditions = { doubanUrl: bookObj.doubanUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  const query = Book.findOneAndUpdate(conditions, bookObj, options);
  await query.exec();
}

function assertMongoDB() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl, {useNewUrlParser: true, poolSize:4});
  }
}

async function assertBook() {
  assertMongoDB();
  const conditions = {$and :[
  {"doubanISBN":{"$ne":null}}
  ]}
  const options = { limit:Config.crawlStep };
  var query = Book.find(conditions ,'doubanISBN' ,null);
  const result = await query.exec();
  return result;
}

async function assertBook2() {
  assertMongoDB();
  const conditions = {$and :[
    {"bookSerial":{"$ne": null}},
    {"bookSerial":{"$ne": ""}}
  ]}
  const options = { limit:5 };
  var query = Book.find(conditions ,'bookSerial' ,null);
  const result = await query.exec();
  return result;
}

// exports.run =
async function fakeMain(max_crawled_items)
{
    var tick = 0;
    Logger.trace("in douban Crawler");
    var dbISBNs = await assertBook();
    var soISBNS = await assertBook2();
    console.log(dbISBNs.length);
    console.log(soISBNS.length);

    var r = dbISBNs.map(function(x){
      var isbn = x.doubanISBN;
      return isbn;
    });

    var soisbn = soISBNS.map(function(x){
        var isbn = x.bookSerial.split("：").pop();
        return isbn;
    });


    let intersection = r.filter(x => soisbn.includes(x));

    console.log("intersection: " +intersection.length);


    for (var i = 0; i < r.length && tick < max_crawled_items; i++, tick++)
    {
      // var rand = Math.floor(Math.random() * Math.floor(r.length));
      book = r[i];
      if(book.doubanUrl == null)
        continue;
      // c.queue(book.doubanUrl);
      try {
        Logger.trace(i);
        await parseAndSave(book);
      }
      catch (e)
      {
        Logger.error(e);
        throw(e);
      }
      // console.log(request, response);

    }
    Logger.info("DOUBAN DetailCrawler Rate "+statCount+"/"+r.length);

}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
/*
 main
*/
(async () => {
    try {
        Logger.info("Douban Detail Crawler Session START  PID@"+process.pid);
          await fakeMain(0);
        mongoose.connection.close();
        Logger.info("Douban Detail Crawler Session END PID@"+process.pid);
    } catch (e) {
        throw(e);
    }
})();
