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
  // console.log(response.body);
  // console.log($(SEARCH_ISBN_RESULT_HREF_SEL).text());
  // console.log(searchUrl);
  // console.log(response.request.uri.href);
  var infos = ($(DETAIL_BOOK_INFO_BLOCK_SEL).text().replace(/\r?\n|\r/g, "").replace(/\s+/g,' ').split(" "));
  infos = removeSpaceElement(infos);
  var doubanISBN = getDoubanISBN(infos);
  var tags = $(DETAIL_TAGS_SEL2).text().replace(/\r?\n|\r/g, "").replace(/\s+/g,' ').split(" ");
  tags = removeSpaceElement(tags);
  var recommends = $(REC_SECTION_SEL).map(function(x){
    // console.log($(this).text());
    var recommend_href = ($(this).find('dt > a').attr('href'));
    return recommend_href;
    // console.log("recommends:"+x);
  }).toArray();
  // Logger.trace(recommends);
  var bookName = $(TITLE_SEL).text();
  if(bookName == null || bookName == "")
  {
    Logger.warn("something wrong with the crawlers");
    Logger.warn(response.body);
    return ;
  }
  var obj = {};
  obj["doubanBookName"] = bookName;
  obj["doubanBookCover"] = $(COVER_SEL).attr("src");
  obj["doubanUrl"] = requestUrl;
  obj["doubanBookBrief"] = $(DETAIL_BRIEF_SEL).text();
  obj["doubanAuthorBrief"] = $(DETAIL_AUTHOR_BRIEF_SEL).text();
  obj["doubanTags"] = tags;
  obj["doubanRating"] = $(DETAIL_RATING_NUMBER_SEL).text();
  obj["doubanRatingUser"] = $(DETAIL_RATING_USER_NUMBER_SEL).text();
  obj["doubanBookMeta"] = infos;
  obj["doubanCrawlDate"] = new Date();
  obj["doubanISBN"] = doubanISBN;

  Logger.trace("-> "+obj.doubanBookName+"("+obj.doubanUrl+")");
  await upsertBook(obj);
  for (var i = 0; i < recommends.length; i++) {
    var doubanUrl = recommends[i];
    await upsertBook({"doubanUrl":doubanUrl});
  }
  // recommends.map(async function(x){
  //   // console.log(x);
  //   // console.log(this);
  //   await upsertBook({"doubanUrl":x});
  // });
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
    mongoose.connect( Config.dbUrl, {useNewUrlParser: true, poolSize:4});
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
  var query = Book.find(conditions ,null ,null);
  const result = await query.exec();
  return result;
}

// exports.run =
async function fakeMain()
{
    var tick = 0;
    Logger.trace("in douban Crawler");
    var r = await assertBook();
    Logger.info(r.length+" books to be detailed ...");
    for (var i = 0; i < r.length /*&& tick < max_crawled_items*/; i++, tick++)
    {
      // var rand = Math.floor(Math.random() * Math.floor(r.length));
      book = r[i];
      if(book.doubanUrl == null)
        continue;
      // c.queue(book.doubanUrl);
      // try
      {
        Logger.trace(i);
        var PROXIES =
        // # '193.112.128.212:8118',
        // "218.108.175.15:80",
        // '202.183.32.182:80',
        // '183.129.244.16:11161',
        // '60.13.42.34:9999',
        // '119.254.94.71:39053',
        // '175.44.158.15:9000',
        // '112.111.98.176:9000',
        // '27.203.142.151:8060',
        // '27.188.65.244:8060',
        // '183.129.207.80:12608',
        // '114.234.83.79:9000',
        // '117.87.178.88:9000',
        // '117.90.137.65:9999',
        // '117.90.252.143:9000',
        // '183.129.207.86:13974',
        // '121.232.194.251:9000',
        // # '1.85.220.195:8118',
        ["125.78.154.132:16853", "113.121.47.13:22869", "119.138.195.92:18670", "113.121.74.105:17367", "182.46.100.52:20931", "121.230.211.219:20460", "121.235.230.133:20557", "119.162.183.186:20438", "49.84.38.99:16390", "111.224.100.250:21430"]
        // # '60.255.186.169:8888',
        // # '118.187.58.34:53281',
        // # '116.224.191.141:8118',
        // # '120.27.5.62:9090',
        // # '119.132.250.156:53281',
        // # '139.129.166.68:3128'

        //218.108.175.15	80
        var prox = PROXIES[Math.floor(Math.random()*PROXIES.length)];
        let response = await request(book.doubanUrl, {proxy:prox});
        // let response = await request(book.doubanUrl);
        await parseAndSave(book.doubanUrl, response);
      }
      // catch (e)
      // {
      //   Logger.error(e);
      //   // throw(e);
      // }
      // console.log(request, response);

    }
    Logger.info("DOUBAN DetailCrawler Rate "+statCount+"/"+r.length);

}

async function retry(maxRetries, fn) {
  Logger.info("retry time "+maxRetries);
  return await fn().catch(function(err) {
    if (maxRetries <= 0) {
      // throw err;
    }
    return retry(maxRetries - 1, fn);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
/*
 main
*/
(async () => {
    // try {
        Logger.info("Douban Detail Crawler Session START  PID@"+process.pid);
        while(1){
          await retry(10, fakeMain);
          // await fakeMain(100000);
          // await sleep(3000);
        }
        mongoose.connection.close();
        Logger.info("Douban Detail Crawler Session END PID@"+process.pid);
    // } catch (e) {
    //     throw(e);
    // }
})();
