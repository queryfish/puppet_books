#!/bin/bash
# while IFS= read -r line; do
#     echo "Text read from file: $line"
#     echo $line | sed -n 's/.*upload file success,file:.*.mobi,size:/ \1 /gp'
# done < "$1"

text="2019/10/02 06:42:36 [info]upload file success,file:源氏物语（全译彩插绝美版）.mobi,size:61767000,speed:210.14(KB/s),cost:293936(ms)"
echo $text | sed 's/^upload file success.*size$/\1/g'
text2=`echo $text | sed -n '/^upload file success/,/size$/p'`
echo $text2
