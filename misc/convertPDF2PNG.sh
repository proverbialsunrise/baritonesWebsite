#!/bin/bash

shopt -s nullglob
for pdf in *{pdf,PDF} ; do
    convert -background white -flatten -density 150 "$pdf[0]" "${pdf%%.*}.png"
done
