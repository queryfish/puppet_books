const puppeteer = require('puppeteer');
const fs = require('fs');
const mongoose = require('mongoose');
const { DownloaderHelper } = require('node-downloader-helper');
var urlencode = require('urlencode');
const process = require('process');
const Book = require('./models/book');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;
const StatsLogger = LOG4JS.stats_logger;
const CREDS = require('./creds');
const Configs = require('./configs');
const OSSPut = require('./saveToAliOSS')
const MAX_CRAWL_NUM = 200;

var statCount = 0;
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

function assertMongoDB()
{
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl, { useNewUrlParser: true });
  }
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

var exec = require('child_process').exec;

async function downloadBook(bookObj)
{
    var dl_url = bookObj.ctdownloadUrl;
    var bookUrl = bookObj.bookUrl;
    var bookname = bookObj.bookName;
    if(dl_url != null && dl_url !="")
    {
      Logger.info("start downloading -> "+bookname);
      const dl = new DownloaderHelper(dl_url, Configs.workingPath+'books/', {fileName:bookname+".mobi", override:false});

      dl.on('end', async () => {
        var ossPath ='books/'+bookname+'.mobi'; //should turn the .mobi to other format
        var localPath = Configs.workingPath+ossPath;
        var movePath = Configs.workingPath+'calibre_tmp/'+bookname+'.mobi';
        console.log(localPath);
        console.log(movePath);
        let p = OSSPut.put(localPath, ossPath);
        // let p = OSSPut.put(Configs.workingPath+'books/'+bookname+'.mobi', 'books/'+bookname+'.mobi');
        if(p == 0)
        {
          var update = {downloaded:true, ctdownloadTime:new Date(), savedToAliOSS:true };
          fs.rename(localPath, movePath, function(e){
              console.log("file moved to "+movePath);
              if(e)
              {
                console.log(e);
                return;
              }
              var cmdStr = 'sh '+Configs.workingPath+'add2Calibre.sh '+movePath;
              console.log(cmdStr);
              exec(cmdStr, function(err,stdout,stderr){
                  if(err)
                      console.log('get calibre script error:'+stderr);
                  else
                      console.log(stdout);
              });

          });
        }
        else
          var update = {downloaded:true, ctdownloadTime:new Date()};

        var cond = {"ctdownloadUrl":dl_url};
        await updateBook(cond,update);
        // console.log("index"+r.length);
        // if(r.length == 0)
        //   mongoose.connection.close();
        statCount++;
        Logger.info("DONE downloading "+bookname);
        StatsLogger.info("Download "+bookname);
      });
      dl.on('error', (err) => {
        Logger.error("Error ...");
        Logger.error(err);
      });
      dl.on('stateChanged', (state) => {Logger.trace("Downloader State changed");Logger.trace(state);});
      dl.on('progress', (stats)=> {Logger.trace(bookname+" "+Math.floor(stats.progress)+"%");});
      try {
        await dl.start();
      } catch (e) {
        await unsetCTDownloadUrl(dl_url);
      }
    }
}



function decodeBookName(urlstring)
{
  var slashs = urlstring.split("/");
  var dots = slashs[5].split(".")[0];
  var decoded = urlencode.decode(dots); // '苏千'
  // console.log(urlencode.parse(urlstring));
  // .pop().split(".").shift();
  return decoded;
}

async function assertBook() {
  assertMongoDB();
  // const conditions = { "baiduUrl": {"$exists": false}} ;
  const conditions = { "$and":[
    {"downloaded": {"$exists": false}},{"ctdownloadUrl":{"$exists":true}}]} ;
  const options = { limit:Configs.crawlStep , sort:{"bookSize": 1} };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  // Logger.trace(JSON.stringify(result));
  return result;
}

var r = null;
async function automate()
{
    r = await assertBook();
    Logger.info(r.length+" books to be downloaded ...");
    // Logger.info(r);
    for (var i = 0; i < r.length; i++)
    {
      Logger.warn("start download "+i);
      // book = r.pop();
      book = r[i];
      Logger.info("NO. "+i+" book["+book.cursorId+"]: "+book.bookName);
      await downloadBook(book);
    }
    StatsLogger.info("CTDownloader Rate "+statCount+"/"+r.length);

}

/*
 main
*/

(async () => {
    try {
      Logger.info("CTDownloader Session START PID@"+process.pid);
      await automate();
      mongoose.connection.close();
      Logger.info("CTDownloader Session END PID@"+process.pid);
    } catch (e) {
      throw(e);
    }
})();
