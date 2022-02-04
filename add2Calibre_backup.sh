#!/bin/bash
_base="./calibre_tmp/mobi"
_dfiles="${_base}/*.mobi"

for f in $_dfiles
do
    # add to calibre
    # convert to epub
    mobiName=`echo ${f} | sed 's/ /_/g'`  # update signature
    `cp "$f" $mobiName`
    epubName=`echo ${mobiName} | sed 's/mobi/epub/g'`  # update signature
    echo ${mobiName}
    echo ${epubName}
    `ebook-convert "${mobiName}" "${epubName}"`
    bookId=`calibredb add --library-path=~/mycalibre_lib/db "${epubName}" | sed 's/[^0-9]*//g'`
    echo ${bookId}
    `calibredb add_format --library-path=~/mycalibre_lib/db ${bookId} ${mobiName}`
    rm -f ${mobiName}
    # rm -f ${epubName}
done
