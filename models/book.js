const mongoose = require('mongoose');

let bookSchema = new mongoose.Schema({
    bookId: String,
    bookName: String,
    bookUrl: String,
    isBookUrlValid: Boolean,
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
    cursorId: Number, // Actually we use this as bookId in sobooks site
    ctdiskUrl:String,
    ctdownloadUrl:String,
    downloaded:Boolean,  //the book has been downloaded from ctdisk
    ctdownloadTime:Date, //ctdisk download time
    bookSize:Number,
    hasMobi: Boolean,
    hasEpub: Boolean,
    savedToAliOSS: Boolean

});

let Book = mongoose.model('Book', bookSchema);

module.exports = Book;
