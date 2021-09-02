yarn build
cp -R build/* deploy/public/
cd deploy || exit
npm pack
