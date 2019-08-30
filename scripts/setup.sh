git clone https://github.com/deepstreamIO/deepstream.io.git
cd deepstream.io
sed -i 's/git@github.com:/https:\/\/github.com\//' .gitmodules
git submodule update --init --recursive
npm i
npm run e2e:v3
