const puppeteer = require('puppeteer');
const fs = require('fs');
const Book = require('./models/book');
const Logger = require('./logger');
const CREDS = require('./creds');
const Config = require('./configs');
const MAX_CRAWL_NUM = 200;


async function getSelectorHref(page, selector) {
  let tc = await page.evaluate((sel) => {
    if(document.querySelector(sel) != null){
      let baidu_url = document.querySelector(sel).getAttribute("href");
      return baidu_url;
    }
    else
      return null;
  }, selector);
  return tc;
}

async function fetchBook(page, bookUrl)
{

  const client = await page.target().createCDPSession();

// intercept request when response headers was received
await client.send('Network.setRequestInterception', {
  patterns: [{
      urlPattern: '*',
      resourceType: 'Document',
      interceptionStage: 'HeadersReceived'
  }],
});

await client.on('Network.requestIntercepted', async e => {
    let headers = e.responseHeaders || {};
    let contentType = headers['content-type'] || headers['Content-Type'] || '';
    let obj = {interceptionId: e.interceptionId};
    if (contentType.indexOf('application/zip') > -1) {
        obj['errorReason'] = 'BlockedByClient';
    }

    await client.send('Network.continueInterceptedRequest', obj);
});

  page.on('response', response => {
      // If response has a file on it
      if (response._headers['content-disposition'] === 'attachment') {
         // Get the size
         // console.log(response);
         console.log('Size del header: ', response._headers['content-length']);
         console.log('Download url :', response._url);
         // save url to DB for later download workers.

         // call the browser to stop
         page.close();

          // Watch event on download folder or file
          //  fs.watchFile(dir, function (curr, prev) {
          //    // If current size eq to size from response then close
          //     if (parseInt(curr.size) === parseInt(response._headers['content-length'])) {
          //         browser.close();
          //         this.close();
          //     }
          // });
      }
  });

  const BOOK_SEL = '#table_files > tbody > tr:nth-child(1) > td:nth-child(2) > a';
  // const BOOK_SEL = '#table_files > tbody > tr.even > td:nth-child(2) > a';
  const DL_BUTTON = '#free_down_link';
  await page.goto(bookUrl, {waitUntil: 'networkidle2'});
  await page.waitFor(5*1000);//会有找不到输入框的异常，加上一个弱等待试试
  if (await page.$(BOOK_SEL) == null)
  {
      Logger.info('checkcode input invalid');
      return;
  }
  let download_href = await getSelectorHref(page, BOOK_SEL);
  var site = "https://sobooks.ctfile.com";
  Logger.info(download_href);
  download_href = site + download_href;
  await page._client.send('Page.setDownloadBehavior', {
        behavior: 'deny'
    });
  // page.click(BOOK_SEL);
  await page.goto(download_href, {waitUntil: 'networkidle2'});
  // await page.waitFor(5*1000);//会有找不到输入框的异常，加上一个弱等待试试
  await page.click(DL_BUTTON);
  await page.waitFor(10*1000);//会有找不到输入框的异常，加上一个弱等待试试
  return ;

}

async function crawl(page) {
   /*
   1- query from mongodb for impartial entry to be further crawl for detail
   2- use the crawl func and save it to db
   3- stop when MAX_CRAWL_NUM exceed or the db is out of candidate
   */
   var resultArray = await assertBook();
   Logger.info(resultArray.length+" books to copy ...");
   for (var i = 0; i < resultArray.length; i++) {
       var book = resultArray[i];
       Logger.info("NO."+i+": "+book.bookName+" -> "+book.bookUrl);
       if(book.baiduUrl.startsWith("https://pan.baidu.com"))
       {
         await grabABook_BDY(page, book);
       }
       else
       {
         //we do the check here and we save it backup to mongodb for further filter
         book["badApple"] = true;
         upsertBook(book);
       }
    }
}

async function automate() {
  /*
  1- query from mongodb for impartial entry to be further crawl for detail
  2- use the crawl func and save it to db
  3- stop when MAX_CRAWL_NUM exceed or the db is out of candidate
  */
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });

  // Download and wait for download
  const page = await browser.newPage();
  // await injectCookiesFromFile(page, Config.cookieFile);
  // await page.waitFor(5 * 1000);
  await fetchBook(page, "https://sobooks.ctfile.com/dir/14804066-34361831-50081d/");
  await browser.close();

}

async function retry(maxRetries, fn) {
  Logger.info("retry time "+maxRetries);
  return await fn().catch(function(err) {
    if (maxRetries <= 0) {
      throw err;
    }
    return retry(maxRetries - 1, fn);
  });
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
