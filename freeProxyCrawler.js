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


async function parseAndSave(response) {
  const cheerio = require('cherio')
  const $ = cheerio.load(response.body);
  const ROW_SEL= '#list > table > tbody > tr:nth-child(1) ';
  const ROW_SEL2 = 'div.col-md-10 > div.table-responsive > table > tbody > tr';
  const ROW_SEL3 = '#content > section > div.container > table > tbody > tr:nth-child(1)';
  const ROW_SEL4 = '#ip_list > tbody > tr:nth-child(2)';
  const ROW_SEL5 = '#ip_list > tbody > tr';
  // var row = $(ROW_SEL5).text();
  // console.log(row);
  var fs = require('fs')
  var logger = fs.createWriteStream('./iptable.txt', {
    flags: 'w' // 'a' means appending (old data will be preserved)
  })

  var row = $(ROW_SEL5).map(function(x){
    var r = $(this).text().replace(/\r?\n|\r/g, "").replace(/\s+/g,' ').split(" ");
    var ip_port = r[1]+':'+r[2];
    // logger.write(ip_port)
    return ip_port
    // console.log(r);
  }).toArray();

  for (var i = 1; i < row.length; i++) {
    logger.write(row[i])
    logger.write('\n')
  }
  console.log(row.length -1);
  // map(function(x){
  //   // console.log($(this).text());
  //   var recommend_href = $(this).find('tbody > tr').text();
  //   return recommend_href;
  //   console.log("proxy"+recommend_href);
  // }).toArray();

  logger.end()
  // console.log($(table).text());

  // var infos = ($(DETAIL_BOOK_INFO_BLOCK_SEL).text().replace(/\r?\n|\r/g, "").replace(/\s+/g,' ').split(" "));
  // infos = removeSpaceElement(infos);
  // var doubanISBN = getDoubanISBN(infos);
  // var tags = $(DETAIL_TAGS_SEL2).text().replace(/\r?\n|\r/g, "").replace(/\s+/g,' ').split(" ");
  // tags = removeSpaceElement(tags);
  // var recommends = $(REC_SECTION_SEL).map(function(x){
  //   // console.log($(this).text());
  //   var recommend_href = ($(this).find('dt > a').attr('href'));
  //   return recommend_href;
  //   // console.log("recommends:"+x);
  // }).toArray();
  // // Logger.trace(recommends);
  // var bookName = $(TITLE_SEL).text();


}

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


async function getAndParseProxyPage()
{
    // const freeProxyPageUrl = 'https://www.kuaidaili.com/free/';
    const freeProxyPageUrl = 'https://www.xicidaili.com/wn/';
    // const freeProxyPageUrl = 'http://www.qydaili.com/free/';
    // const freeProxyPageUrl = "http://www.89ip.cn/tqdl.html?api=1&num=30&port=&address=北京&isp=";
    // let response = await request(freeProxyPageUrl, {proxy:prox});
    let response = await request(freeProxyPageUrl);
    await parseAndSave(response);
    // console.log(response);
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
        // while(1){
          // await retry(10, fakeMain);
          await getAndParseProxyPage();
        // }
        mongoose.connection.close();
        Logger.info("Douban Detail Crawler Session END PID@"+process.pid);
    // } catch (e) {
    //     throw(e);
    // }
})();
