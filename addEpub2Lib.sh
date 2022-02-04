#!/bin/bash
    cd ./books/downloaded/
    `mkdir -p ../added2lib/`
    for f in ./*.zip; do
    	printf '%s\n' "${f}"
	`mkdir -p ./${f}.dir/ `
	cd ./${f}.dir/
	`jar xvf ../${f}`
        epub="$(ls  *.epub | sort -V | tail -n1)"
	echo ${epub}
       	bookId=`calibredb add --library-path=~/mycalibre_lib/db "${epub}" `
	cd ..
       ` rm -fr ./${f}.dir`
	`mv ${f}  ../added2lib/`      
    done
    for f in ./*.mobi; do
    	printf '%s\n' "${f}"
       	bookId=`calibredb add --library-path=~/mycalibre_lib/db "${f}" `
	`mv ${f}  ../added2lib/`      
    done
    for f in ./*.epub; do
    	printf '%s\n' "${f}"
       	bookId=`calibredb add --library-path=~/mycalibre_lib/db "${f}" `
	`mv ${f}  ../added2lib/`      
    done
    for f in ./*.azw3; do
    	printf '%s\n' "${f}"
       	bookId=`calibredb add --library-path=~/mycalibre_lib/db "${f}" `
	`mv ${f}  ../added2lib/`      
    done
