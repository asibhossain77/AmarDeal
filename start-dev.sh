#!/bin/bash
cd /home/z/my-project
> dev.log
node node_modules/next/dist/bin/next dev -p 3000 >> dev.log 2>&1
