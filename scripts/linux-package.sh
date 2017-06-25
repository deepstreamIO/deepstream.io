#!/bin/bash
set -e

if [ -z $1 ]; then echo "First param is distro ( centos | debian | ubuntu | ... )"; exit 1; fi
if [ -z $2 ]; then echo "Second param is version ( wheezy | 7 | ... )"; exit 1; fi

if [ -z $3 ]; then
  echo "No distribution version provided, so using the version from package.json"
  curl -O https://raw.githubusercontent.com/deepstreamIO/deepstream.io/master/package.json
  VERSION="$( cat package.json | grep version | awk '{ print $2 }' | sed s/\"//g | sed s/,//g )"
else
  VERSION="$3"
fi

DISTRO=$1
DISTRO_NAME=$2
GIT_TAG_NAME=v$VERSION

# RPM does not support dashes in versions
RPM_PACKAGE_VERSION=$( sed "s/-/_/" <<< ${VERSION} )

if [ $DISTRO = "ubuntu" ] || [ $DISTRO = "debian" ]; then
  ENV="deb"
elif [ $DISTRO = "centos" ] || [ $DISTRO = "fedora" ]; then
  ENV="rpm"
else
  echo "Unsupported distro: $DISTRO"
  exit 1;
fi

mkdir -p build
cd build

  cat >Dockerfile <<EOF
FROM $DISTRO:$DISTRO_NAME
EOF

if [ $ENV = 'deb' ]; then
  cat >>Dockerfile <<EOF
RUN apt-get update
RUN apt-get install -y curl build-essential git ruby ruby-dev rpm
RUN curl -sL https://deb.nodesource.com/setup_6.x | bash -
RUN apt-get install -y nodejs
EOF
else
  cat >>Dockerfile <<EOF
RUN yum update -y
RUN yum install -y git curl rpmbuild ruby ruby-devel rubygems rpm-build
RUN yum -y install gcc gcc-c++ make openssl-devel
RUN curl --silent --location https://rpm.nodesource.com/setup_6.x | bash -
RUN yum -y install nodejs
EOF
fi

if [ $DISTRO = 'ubuntu' ]; then
  cat >>Dockerfile <<EOF
RUN apt-get install -y python python2.7
EOF
fi

cat >>Dockerfile <<EOF
RUN gem install fpm  --conservative || echo "fpm install failed"

RUN echo "Start"

RUN git config --global http.sslverify false
RUN git clone https://github.com/deepstreamio/deepstream.io.git

WORKDIR deepstream.io
RUN mkdir build
RUN git checkout tags/$GIT_TAG_NAME
RUN npm install
RUN chmod 555 scripts/package.sh

RUN rm scripts/package.sh
RUN curl -s -L https://raw.githubusercontent.com/deepstreamIO/deepstream.io/master/scripts/package.sh -o scripts/package.sh
RUN chmod 555 scripts/package.sh
RUN ./scripts/package.sh true
EOF

if [ $ENV = 'deb' ]; then
    cat >>Dockerfile <<EOF
RUN curl \
-T "build/deepstream.io_${VERSION}_amd64.deb" \
-H "X-Bintray-Publish:1" \
-H "X-Bintray-Debian-Distribution:$DISTRO_NAME" \
-H "X-Bintray-Debian-Component:main" \
-H "X-Bintray-Debian-Architecture:amd64" \
-u yasserf:$BINTRAY_API_KEY \
"https://api.bintray.com/content/deepstreamio/deb/deepstream.io/${GIT_TAG_NAME}/deepstream.io_${DISTRO_NAME}_${GIT_TAG_NAME}_amd64.deb"
EOF
fi

if [ $ENV = 'rpm' ]; then
    cat >>Dockerfile <<EOF
RUN curl \
-T "build/deepstream.io-${RPM_PACKAGE_VERSION}-1.x86_64.rpm" \
-H "X-Bintray-Publish:1" \
-u "yasserf:$BINTRAY_API_KEY" \
"https://api.bintray.com/content/deepstreamio/rpm/deepstream.io/${GIT_TAG_NAME}/deepstream.io-${DISTRO_NAME}-${VERSION}-1.x86_64.rpm"
EOF
fi

echo "Using Dockerfile:"
sed -e 's@^@  @g' Dockerfile


TAG="${GIT_TAG_NAME}"
echo "Building Docker image ${TAG}"
docker build --tag=${TAG} .

echo "Removing Dockerfile"
rm -f Dockerfile

CIDFILE="cidfile"
ARGS="--cidfile=${CIDFILE}"
rm -f ${CIDFILE} # Cannot exist

echo "Running build"
docker run ${ARGS} ${TAG}

echo "Removing container"
docker rm "$(cat ${CIDFILE})" >/dev/null
rm -f "${CIDFILE}"

echo "Build successful"
