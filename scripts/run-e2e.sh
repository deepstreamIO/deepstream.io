echo '1) Setting up submodules'
git submodule init
git submodule update
npm i
echo '2) Running tests'
npm run e2e
