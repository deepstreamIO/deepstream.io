if [ -z $1 ]; then echo "First param is distro ( centos | debian | ubuntu | ... )"; exit 1; fi
if [ -z $2 ]; then echo "Second param is version ( wheezy | 7 | ... )"; exit 1; fi
if [ -z $3 ]; then echo "Third param is type ( rpm | deb )"; exit 1; fi
if [ -z $4 ]; then echo "Fourth param is tag ( vX.X.X )"; exit 1; fi

DISTRO=$1
DISTRO_NAME=$2
ENV=$3
GIT_TAG_NAME=$4

TAG=$DEBIAN_NAME_$GIT_TAG_NAME

mkdir build
cd build

	cat >Dockerfile <<EOF
FROM $DISTRO:$DISTRO_NAME
EOF

if [ $ENV = 'deb' ]; then
	eco $ENV
	cat >>Dockerfile <<EOF
RUN apt-get update
RUN apt-get install --yes curl build-essential git ruby
RUN curl -sL https://deb.nodesource.com/setup_4.x | bash -
RUN apt-get install -y nodejs
EOF
else
	cat >>Dockerfile <<EOF
RUN yum update
RUN yum -y install git curl gcc gcc-c++ make openssl-devel ruby
RUN curl --silent --location https://rpm.nodesource.com/setup_4.x | bash -
RUN yum -y install nodejs
EOF
fi

cat >>Dockerfile <<EOF
RUN git config --global http.sslverify false
RUN git clone https://github.com/yasserf/deepstream.io.git

WORKDIR deepstream.io
RUN mkdir build
RUN git checkout tags/$GIT_TAG_NAME
RUN npm install
RUN chmod 555 scripts/package.sh
RUN ./scripts/package.sh
EOF

echo "Using Dockerfile:"
sed -e 's@^@  @g' Dockerfile

echo "Building Docker image ${TAG}"
docker build --tag=${TAG} .

echo "Removing Dockerfile"
rm -f Dockerfile

CIDFILE="cidfile"
ARGS="--cidfile=${CIDFILE}"
rm -f ${CIDFILE} # Cannot exist

echo "Running build"
docker run ${ARGS} ${TAG}

echo "Copying build artifacts"
mkdir -p $DISTRO/$DISTRO_NAME
docker cp "$(cat ${CIDFILE}):/deepstream.io/build/"/ "./$DISTRO/$DISTRO_NAME/" \

echo "Removing container"
docker rm "$(cat ${CIDFILE})" >/dev/null
rm -f "${CIDFILE}"

echo "Build successful"