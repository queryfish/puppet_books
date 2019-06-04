const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const Config = require('./configs');
const mongoose = require('mongoose');
const Book = require('./models/book');
const Logger = require('./logger');
const MAX_CRAWL_NUM = 200;

// const fs = require('fs');

async function upsertBook(bookObj) {
  assertMongoDB()
  // if this email exists, update the entry, don't insert
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  var query = Book.findOneAndUpdate(conditions, bookObj, options);
  const result = await query.exec();
  return ;
}

function assertMongoDB() {

  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
  }
}

async function assertBook() {
  assertMongoDB();
  const conditions = { "$and":[ {"bookUrl": {"$exists": true}},
                              {"cursorId":{"$exists":false}}
                      ]} ;
  const options = { sort:{"dateCrawled": -1} };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  return result;
}

//main
(async () => {
      let books = await assertBook();
      console.log(books.length + " books to go ...");
      // while(books.length > 0)
      {
        for (var i = 0; i < books.length; i++) {
          var b = books[i];
          var bookId = b.bookUrl.split("/").pop().split(".").shift();
          b["cursorId"] = Number(bookId);
          await upsertBook(b);
        }
        // books = await assertBook();
      }
      console.log(books.length + " books DONE ...");
      mongoose.connection.close();

})();
