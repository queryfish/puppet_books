#!/bin/bash
    # add to calibre
    # convert to epub
    f=$1
    joinName=`echo ${f} | sed 's/ /_/g'`  # update signature
    `cp "$f" $joinName`
    epubName=`echo ${joinName} | sed 's/mobi/epub/g'`  # update signature
    echo ${joinName}
    echo ${epubName}
    `ebook-convert "${joinName}" "${epubName}"`
    bookId=`calibredb add --library-path=~/mycalibre_lib/db "${epubName}" | sed 's/[^0-9]*//g'`
    echo ${bookId}
    `calibredb add_format --library-path=~/mycalibre_lib/db ${bookId} ${joinName}`
    rm -f ${joinName}
    rm -f ${epubName}
