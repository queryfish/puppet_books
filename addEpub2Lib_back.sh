#!/bin/bash
    cd ./books/
    `mkdir -p ./tmp ./unzipped ./epub`
    for f in ./*.zip; do
    	printf '%s\n' "${f}"
    	`unzip ${f} -d ./tmp/${f}/`
    done
    `cd ./tmp/`
    for f in *.epub; do
	re=`echo ${f} | sed 's/ /_/g'`
	`mv "${f}" "${re}"`
	printf 'add book %s to lib\n' "${re}"
    	bookId=`calibredb add --library-path=~/mycalibre_lib/db "${re}" `
	printf 'add book result %s\n' "${bookId}"
	`mv "${re}" ../epub/`
    done 
   # ` rm ./* `
