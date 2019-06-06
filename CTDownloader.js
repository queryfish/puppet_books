const puppeteer = require('puppeteer');
const fs = require('fs');
const mongoose = require('mongoose');
const { DownloaderHelper } = require('node-downloader-helper');
var urlencode = require('urlencode');
const process = require('process');
const Book = require('./models/book');
const Logger = require('./logger');
const CREDS = require('./creds');
const Configs = require('./configs');
const MAX_CRAWL_NUM = 200;

function upsertBook(bookObj) {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  Book.findOneAndUpdate(conditions, bookObj, options, (err, result) => {
    if (err) {
      throw err;
    }
  });
}

async function updateBook(conditions, update) {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }
  const query = Book.update(conditions, update, {});
  let r = await query.exec();
  return r;
}


async function unsetAllCTDownloadUrl() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }
  const conditions = {};
  const options = {$unset:{ctdownloadUrl:1}};
  const query = Book.update(conditions, options);
  let r = await query.exec();
  return r;
}

async function unsetCTDownloadUrl(download_url) {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }
  const conditions = { ctdownloadUrl: download_url };
  const options = {$unset:{ctdownloadUrl:1}};
  const query = Book.updateOne(conditions, options);
  let r = await query.exec();
  return r;
}

// exports.downloadBook =
async function downloadBookFromUrl(dl_url)
{
    if(dl_url != null && dl_url !="")
    {
      assertMongoDB();
      var bookname = decodeBookName(dl_url);
      console.log("start downloading -> "+bookname);
      const dl = new DownloaderHelper(dl_url, Configs.workingPath+'/books/', {fileName:bookname+".mobi"});
      dl.on('end', () => {
        var cond = {"ctdownloadUrl":dl_url};
        var update = {downloaded:true};
        console.log(bookname, "DONE.");
        updateBook(cond,update);
      });
      dl.on('error', (err) => {console.log("Error ...");console.log(err);});
      dl.on('progress', (stats)=> {console.log(bookname, stats.progress+"%");});
      try {
        await dl.start();
      } catch (e) {
        await unsetCTDownloadUrl(dl_url);
        mongoose.connection.close();
      }
    }
}

async function downloadBook(bookObj)
{
    var dl_url = bookObj.ctdownloadUrl;
    var bookUrl = bookObj.bookUrl;
    var bookname = bookObj.bookName;
    if(dl_url != null && dl_url !="")
    {
      console.log("start downloading -> "+bookname);
      const dl = new DownloaderHelper(dl_url, Configs.workingPath+'books/', {fileName:bookname+".mobi", override:true});
      dl.on('end', () => {
        var cond = {"ctdownloadUrl":dl_url};
        var option = {$set:{downloaded:true}};
        console.log(bookname, "DONE.");
        updateBook(cond, option);
      });
      dl.on('error', (err) => {console.log("Error ...");console.log(err);});
      dl.on('stateChanged', (state) => {console.log("Downloader State changed");console.log(state);});
      dl.on('progress', (stats)=> {console.log(bookname, Math.floor(stats.progress)+"%");});
      try {
        await dl.start();
      } catch (e) {
        await unsetCTDownloadUrl(dl_url);
      }
    }
}

function assertMongoDB() {

  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
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
  // console.log(urlencode.parse(urlstring));
  // .pop().split(".").shift();
  return decoded;
}

async function assertBook() {
  assertMongoDB();
  // const conditions = { "baiduUrl": {"$exists": false}} ;
  const conditions = { "$and":[
    {"downloaded": {"$exists": false}},{"ctdownloadUrl":{"$exists":true}}]} ;
  const options = { limit:20 , sort:{"bookSize": 1} };
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
    // r = await assertBook();
  // }

}

// (async () => {
//     try {
//       // await retry(3, schedule)
//       // const fs = require('fs');
//       // var access = fs.createWriteStream(logfile);
//       // process.stdout.write = process.stderr.write = access.write.bind(access);
//       const target_url = process.argv[2];
//       console.log("downloader start dancing PID@", process.pid);
//       await downloadBookFromUrl(target_url);
//     } catch (e) {
//       throw(e);
//     }
//     mongoose.connection.close();
// })();
/*
 main
*/
(async () => {
    try {
      await automate();
      mongoose.connection.close();
    } catch (e) {
      throw(e);
    }
    // return;
    // retry(10, automate)
})();
