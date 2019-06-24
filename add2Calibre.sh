#!/bin/bash
_base="./calibre_tmp/mobi"
_dfiles="${_base}/*.mobi"

for f in $_dfiles
do
    # add to calibre
    # convert to epub
    epubName=`echo ${f} | sed 's/mobi/epub/g'`  # update signature
    echo ${f}
    echo ${epubName}
    `ebook-convert ${f} ${epubName}`
    bookId=`calibredb add --library-path=~/mycalibre_lib/db ${epubName}`
    echo ${bookId}
    # `calibredb add_format --library-path=~/mycalibre_lib/db ${bookId} ${f}`
    # rm -f ${f} ${epubName}
    # rm -f ${f}
    rm -f ${epubName}
done
