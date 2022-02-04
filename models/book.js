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
    ctdiskUrl2:String,
    ctdiskUrl2_code:String,
    ctdiskUrl3:String,
    ctdownloadUrl:String,
    downloaded:Boolean,  //the book has been downloaded from ctdisk
    ctdownloadTime:Date, //ctdisk download time
    ctdownloadValidTS:Number,
    bookSize:Number,
    overSized:Boolean,
    ext:String,
    hasMobi: Boolean,
    hasEpub: Boolean,
    savedToAliOSS: Boolean,
    doubanId: String,
    doubanBookBrief: String,
    doubanAuthorBrief: String,
    doubanTags: Array,
    doubanRating : Number,
    doubanRatingUser : String,
    doubanBookMeta: Array,
    doubanUrl: String,
    doubanCrawlDate: Date,
    doubanBookName: String,
    doubanBookCover: String,
    doubanISBN:String,
    ctdownloadFormats:Array,
    localPath:String,
    aliOSSPath: String,
    downloadedFromAliOSS: Boolean,
    addedToCalibre: Boolean,
    ctError: Number
});

let Book = mongoose.model('Book', bookSchema);

module.exports = Book;
