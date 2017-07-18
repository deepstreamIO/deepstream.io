echo '1) Setting up submodules'
git submodule init
git submodule update
npm i
echo '4) Running tests'
npm run test-e2e
