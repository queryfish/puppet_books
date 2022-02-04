#!/bin/sh
ts=`date '+%Y%m%d'`
dl=`cat logs/stats.$ts.log  | grep 'Downloaded.*[0-9]M$'| awk '{print $6}' > tmp1.tmp`
ct=`cat logs/stats.$ts.log  | grep 'catch:'| awk '{print $7}' > tmp2.tmp`
num_dl=`cat tmp1.tmp | wc -l`
num_ct=`cat tmp2.tmp | wc -l`
num_cross=`sort tmp1.tmp tmp2.tmp | uniq -d |wc -l`
echo Downloaded:$num_dl > ./logs/dailyreport.$ts.log
echo CTed:$num_ct >> ./logs/dailyreport.$ts.log
echo BOTH:$num_cross >> ./logs/dailyreport.$ts.log
echo ./dailyreport.$ts.log
cat ./logs/dailyreport.$ts.log
