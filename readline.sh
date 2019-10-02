#!/bin/bash
while IFS= read -r line; do
    # echo "Text read from file: $line"
    # echo $line | sed -n 's/.*upload file success,file:.*.mobi,size:/ \1 /gp'
    text=`echo $line | sed -n 's/\(.*upload file success,file:\)\(.*\)\(,size.*\)/\2/gp'`
    if [ ! -z "$text"];then
      echo $text
done < "$1"
