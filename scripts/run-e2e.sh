echo '1) Linking deepstream'
npm link
echo '2) Creating temp e2e test directory'
mkdir -p temp-e2e-test
cd temp-e2e-test
echo '3) Getting deepstream.io-client-js'
git clone https://github.com/deepstreamIO/deepstream.io-client-js.git
cd deepstream.io-client-js
echo '4) Setting up submodules'
git submodule init
git submodule update
npm i
npm link deepstream.io
echo '4) Running tests'
npm run e2e
