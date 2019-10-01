#!/bin/bash
while IFS= read -r line; do
    echo "Text read from file: $line"
    echo $line | sed -n 's/.*upload file success,file:.*.mobi,size:/ \1 /gp'
done < "$1"
