/*
  this version uses the Node Crawler and cherio jquery parser, for sake of profermance
*/
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const Book = require('./models/book');
const CREDS = require('./creds');
const Config = require('./configs');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;
const StatsLogger = LOG4JS.stats_logger;
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

/*
var c = new Crawler({
    rateLimit: 200,
    maxConnections: 1,
    callback: function(error, res, done) {
        if(error) {
            console.log(error)
        } else {
            var $ = res.$;
            // console.log($(SEARCH_ISBN_RESULT_HREF_SEL).text());
            console.log(searchUrl);
            console.log(res.request.uri.href);
            var infos = ($(DETAIL_BOOK_INFO_BLOCK_SEL).text().replace(/\r?\n|\r/g, "").replace(/\s+/g,' ').split(" "));
            infos = removeSpaceElement(infos);
            var tags = $(DETAIL_TAGS_SEL2).text().replace(/\r?\n|\r/g, "").replace(/\s+/g,' ').split(" ");
            tags = removeSpaceElement(tags);

            var obj = {};
            obj["doubanUrl"] = res.request.uri.href;
            obj["doubanBookBrief"] = $(DETAIL_BRIEF_SEL).text();
            obj["doubanAuthorBrief"] = $(DETAIL_AUTHOR_BRIEF_SEL).text();
            obj["doubanTags"] = tags;
            obj["doubanRating"] = $(DETAIL_RATING_NUMBER_SEL).text();
            obj["doubanRatingUser"] = $(DETAIL_RATING_USER_NUMBER_SEL).text();
            obj["doubanBookMeta"] = infos;
            obj["doubanCrawlDate"] = new Date();
            console.log(obj);
            upsertBook(obj);
            // closeMongoDB();
        }
        done();
    }
});

*/

async function parseAndSave(requestUrl, response) {
  const cheerio = require('cherio')
  const $ = cheerio.load(response.body);

  // console.log($(SEARCH_ISBN_RESULT_HREF_SEL).text());
  // console.log(searchUrl);
  // console.log(response.request.uri.href);
  var infos = ($(DETAIL_BOOK_INFO_BLOCK_SEL).text().replace(/\r?\n|\r/g, "").replace(/\s+/g,' ').split(" "));
  infos = removeSpaceElement(infos);
  var tags = $(DETAIL_TAGS_SEL2).text().replace(/\r?\n|\r/g, "").replace(/\s+/g,' ').split(" ");
  tags = removeSpaceElement(tags);
  /*
  doubanBookBrief: String,
  doubanAuthorBrief: String,
  doubanTags: Array,
  doubanRating : Number,
  doubanRatingUser : String,
  doubanBookMeta: Array,
  doubanUrl: String,
  doubanCrawlDate: Date
  */
  var obj = {};
  obj["doubanUrl"] = requestUrl;
  obj["doubanBookBrief"] = $(DETAIL_BRIEF_SEL).text();
  obj["doubanAuthorBrief"] = $(DETAIL_AUTHOR_BRIEF_SEL).text();
  obj["doubanTags"] = tags;
  obj["doubanRating"] = $(DETAIL_RATING_NUMBER_SEL).text();
  obj["doubanRatingUser"] = $(DETAIL_RATING_USER_NUMBER_SEL).text();
  obj["doubanBookMeta"] = infos;
  obj["doubanCrawlDate"] = new Date();
  console.log(obj);
  await upsertBook(obj);
  statCount++
}

// c.on('drain',function(){
//     // For example, release a connection to database.
//     // db.end();// close connection to MySQL
//     // mongoose.disconnect();
//     console.log("Drained..");
//     // mongoose.connection.close();
// });

function removeSpaceElement(array) {
  var a = [];
  for (var i = 0; i < array.length; i++) {
    var v = array[i];
    if(v != "" && v != null)
      a.push(v);
  }
  return a;
}

// // 如果你想以2000毫秒的间隔执行任务

const MAX_CRAWL_NUM = 200;

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
    mongoose.connect( Config.dbUrl);
  }
}

// function closeMongoDB() {
//   if (mongoose.connection.readyState != 0) {
//     mongoose.connection.close();
//   }
// }


async function assertBook() {
  assertMongoDB();
  const conditions = {$and :[
  {"doubanUrl":{"$exists":true}},
  {"doubanUrl":{"$ne":null}},
  {"doubanCrawlDate":{"$exists":false}}
  ]}
  const options = { limit:Config.crawlStep };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  return result;
}

// exports.run =
async function fakeMain(max_crawled_items)
{
    var tick = 0;
    Logger.trace("in douban Crawler");
    var r = await assertBook();
    Logger.info(r.length+" books to be detailed ...");
    Logger.info(r);
    for (var i = 0; i < r.length && tick < max_crawled_items; i++)
    {
      book = r[i];
      if(book.doubanUrl == null)
        continue;
      // c.queue(book.doubanUrl);
      let response = await request(book.doubanUrl);
      // console.log(request, response);
      await parseAndSave(book.doubanUrl, response);
    }
    StatsLogger.info("DetailCrawler Rate "+statCount+"/"+r.length);

}
/*
 main
*/
(async () => {
    try {
        Logger.info("Douban Detail Crawler Session START  PID@"+process.pid);
        await fakeMain(1000);
        mongoose.connection.close();
        Logger.info("Douban Detail Crawler Session END PID@"+process.pid);
    } catch (e) {
        throw(e);
    }
})();
