const puppeteer = require('puppeteer');
const fs = require('fs');
const mongoose = require('mongoose');
const Book = require('./models/book');
const Logger = require('./logger');
const CREDS = require('./creds');
const Config = require('./configs');
const MAX_CRAWL_NUM = 200;
const { DownloaderHelper } = require('node-downloader-helper');
var urlencode = require('urlencode');


function upsertBook(bookObj) {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
  }
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  Book.findOneAndUpdate(conditions, bookObj, options, (err, result) => {
    if (err) {
      throw err;
    }
  });
}

async function downloadBook(bookObj)
{
    var dl_url = bookObj.ctdownloadUrl;
    var bookUrl = bookObj.bookUrl;
    var bookname = bookObj.bookName;
    if(dl_url != null && dl_url !="")
    {
      console.log("starting "+bookname+dl_url);
      const dl = new DownloaderHelper(dl_url, '/home/steve/puppy/books/', {fileName:bookname+".mobi"});
      dl.on('end', () => {upsertBook({"bookUrl":bookObj.bookUrl, "downloaded":true});});
      dl.on('progress', (stats)=> {console.log(stats.progress+"%");});
      dl.start();
    }
}

function assertMongoDB() {

  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
  }
}

function decodeBookName(urlstring)
{
  var slashs = urlstring.split("/");
  console.log(slashs);
  var dots = slashs[5].split(".")[0];
  console.log(dots);
  var decoded = urlencode.decode(dots); // '苏千'
  console.log(decoded);
  console.log(urlencode.parse(urlstring));
  // .pop().split(".").shift();
  return decoded;
}

async function assertBook() {
  assertMongoDB();
  // const conditions = { "baiduUrl": {"$exists": false}} ;
  const conditions = { "$and":[
    {"downloaded": {"$exists": false}},{"ctdownloadUrl":{"$exists":true}}]} ;
  const options = { limit:14 , sort:{"bookSize": 1} };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  console.log(result);
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
  // while(r.length > 0 && tick < max_crawled_items){
    Logger.info(r.length+" books to be downloaded ...");
    // Logger.info(r);
    for (var i = 0; i < r.length; i++)
    {
      book = r[i];
      Logger.info("NO. "+i+" book: "+book.bookName);
      await downloadBook(book);
      // decodeBookName(book.ctdownloadUrl);
    }
    mongoose.connection.close();
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
    }
    // return;
    // retry(10, automate)
})();
