const mongoose = require('mongoose');

let bookSchema = new mongoose.Schema({
    bookId: String,
    bookName: String,
    bookUrl: String,
    bookMeta: String,
    author: String,
    bookSerial: String,
    bookBrief: String,
    doubanUrl: String,
    baiduUrl: String,
    baiduCode: String,
    savedBaidu: Boolean,
    dateCrawled: Date,
    uploadDate: Date,
    lastCrawlCopyTime : Date, //baiduyun copy time
    lastCrawlCopyResultMessage : String,
    category : String,
    tags :String,
    badApple: Boolean,
    cursorId: Number,
    ctdiskUrl:String,
    ctdownloadUrl:String,
    downloaded:Boolean,
    ctdownloadTime:Date, //ctdisk download time
    bookSize:Number
});

let Book = mongoose.model('Book', bookSchema);

module.exports = Book;
