#!/bin/bash

f=$1
# add to calibre
# convert to epub
epubName=`echo ${f} | sed 's/mobi/epub/g'`  # update signature
echo ${f}
echo ${epubName}
`ebook-convert ${f} ${epubName}`
bookId=`calibredb add --library-path=~/mycalibre_lib/db ${epubName} | sed 's/[^0-9]*//g'`
echo ${bookId}
`calibredb add_format --library-path=~/mycalibre_lib/db ${bookId} ${f}`
# rm -f ${f} ${epubName}
rm -f ${f}
rm -f ${epubName}
