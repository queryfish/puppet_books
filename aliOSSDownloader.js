const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const Book = require('./models/book');
const CREDS = require('./creds');
const Config = require('./configs');
const LOG4JS = require('./logger');
const OSS = require('ali-oss');
const Logger = LOG4JS.download_logger;
const StatsLogger = LOG4JS.stats_logger;
const MAX_CRAWL_NUM = 200;
// const fs = require('fs');
var statCount = 0;

const client = new OSS({
  region: 'oss-cn-beijing',
  //云账号AccessKey有所有API访问权限，建议遵循阿里云安全最佳实践，部署在服务端使用RAM子账号或STS，部署在客户端使用STS。
  accessKeyId: 'LTAIiSA7Yhhu4fCZ',
  accessKeySecret: 'YTmzNXyhnPZKdGl1ZBcXcAKuGs4IUW',
  bucket: 'stephen-s-bookstore'
});

async function downloadlist()
{
    var my_marker = "";
    var should_break = false;
    var max_loop = 0;
    while (max_loop < 20)
    {

        let result = await
        client.list({
          "prefix": 'books/',
          "max-keys":2,
          "marker":my_marker
        });
            if(result.objects == null || result.objects.length == 0)
            {
                console.log('not found book :');
                console.log(result.res.requestUrls)
                console.log(decodeURI(result.res.requestUrls[0]))
                return ;
            }

            if(result.nextMarker == null || result.nextMarker == undefined)
              break;
            else
            {
              my_marker = result.nextMarker;
              console.log('nextMaker : '+my_marker);
              max_loop++;
            }
            console.log('objects: '+ result.objects.length);
            for (var i = 0; i < result.objects.length; i++) {
               var b  = result.objects[i];
               var path = b.name;
               var spliti = path.split('/');
               var filename = spliti[1];
               if(spliti.length <= 1 || spliti[1] == '')
                    continue;
               else {
                 var ossPath = path;
                 var localPath = './tmp/'+filename;
                 console.log('getting file +'+filename);
                 let r = await client.get(ossPath,localPath);
                 console.log('DONE with -> ', filename);
               }
            }
    }
}

async function upsertBook(bookObj)
{
  assertMongoDB();
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  const query = Book.findOneAndUpdate(conditions, bookObj, options);
  await query.exec();
}

function assertMongoDB() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
  }
}

async function assertBook(max) {
  assertMongoDB();
  // const matchSample = [{"$match":{"localPath":{"$ne":null}}},{"$sample":{"size":10}}];
  const conditions = {"localPath":{"$ne":null}};
  const options = { limit:10 };
  var query = Book.find(conditions ,null ,options);
  // var query = Book.aggregate(matchSample);
  const result = await query.exec();
  return result;
}

async function getBookFromOSS(bookPath)
{
      var path = bookPath;
      var spliti = path.split('/');
      var filename = spliti[spliti.length-1];
      var ossPath = 'books/'+filename;
      var localPath = './tmp/'+filename;
      console.log('getting file +'+filename);
      let r = await client.get(ossPath,localPath);
      console.log('DONE with -> ', filename);
      const { execSync } = require('child_process');
      var command = './addFile2Calibre.sh '+localPath;
      const add2Calibre = execSync(command);

}

// exports.run =
async function fakeMain(max)
{
    var tick = 0;
    Logger.trace("in fakeMain");
    var r = await assertBook(max);
    Logger.info(r.length+" books to be downloaded ...");
    // Logger.info(r);
    for (var i = 0; i < r.length && tick < max; i++, tick++)
    {
      var bookPath = r[i];
      Logger.trace("NO. "+i+" book: "+bookPath.bookName);
      await getBookFromOSS(bookPath.localPath);
      tick ++;
    }
    // StatsLogger.info("DetailCrawler Rate "+statCount+"/"+r.length);
}
/*
 main
*/
(async () => {
    try {
        Logger.info("detailCrawler Session START  PID@"+process.pid);
        await fakeMain(1);
        mongoose.connection.close();
        Logger.info("detailCrawler Session END PID@"+process.pid);
    } catch (e) {
        throw(e);
    }
})();
