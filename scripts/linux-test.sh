#!/bin/bash
set -e

if [ -z $1 ]; then echo "First param is distro ( centos | debian | ubuntu | ... )"; exit 1; fi
if [ -z $2 ]; then echo "Second param is version ( wheezy | 7 | ... )"; exit 1; fi

if [ -z $3 ]; then
  echo "No distribution version provided, so using the version from package.json"
  curl -o package.json https://raw.githubusercontent.com/deepstreamIO/deepstream.io/master/package.json
  VERSION="$( cat package.json | grep version | awk '{ print $2 }' | sed s/\"//g | sed s/,//g )"
else
  VERSION="$3"
fi

DISTRO=$1
DISTRO_NAME=$2
GIT_TAG_NAME=v$VERSION

if [ $DISTRO = "ubuntu" ] || [ $DISTRO = "debian" ]; then
  ENV="deb"
elif [ $DISTRO = "centos" ]; then
  ENV="rpm"
else
  echo "Unsupported distro: $DISTRO"
  exit 1;
fi

  cat >Dockerfile <<EOF
FROM $DISTRO:$DISTRO_NAME
EOF

if [ $ENV = 'deb' ]; then
  cat >>Dockerfile <<EOF
RUN echo "deb http://dl.bintray.com/deepstreamio/deb $DISTRO_NAME main" | tee -a /etc/apt/sources.list
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 379CE192D401AB61
RUN apt-get update
RUN apt-get install -y deepstream.io
EOF
else
  cat >>Dockerfile <<EOF
RUN yum install -y wget
RUN wget https://bintray.com/deepstreamio/rpm/rpm -O /etc/yum.repos.d/bintray-deepstreamio-rpm.repo
RUN yum install -y deepstream.io
EOF
fi

  cat >>Dockerfile <<EOF
RUN deepstream --version > version
RUN cat version
RUN grep -q ^$VERSION version
RUN deepstream install connector publishingtest
EOF


echo "Using Dockerfile:"
sed -e 's@^@  @g' Dockerfile

TAG="$DEBIAN_NAME_$GIT_TAG_NAME"
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
