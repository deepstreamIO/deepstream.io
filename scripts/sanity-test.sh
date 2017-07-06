#!/bin/bash
set -e

if [[ $1 == "deb" ]]; then
  source /etc/lsb-release && echo "deb http://dl.bintray.com/deepstreamio/deb ${DISTRIB_CODENAME} main" | sudo tee -a /etc/apt/sources.list
  sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 379CE192D401AB61
  sudo apt-get update
  sudo apt-get install -y deepstream.io
elif [[ $1 == "rpm" ]]; then
  sudo yum install -y wget
  sudo wget https://bintray.com/deepstreamio/rpm/rpm -O /etc/yum.repos.d/bintray-deepstreamio-rpm.repo
  sudo yum install -y deepstream.io
elif [[ $1 == "tar" ]]; then
  if [[ -z $2 ]]; then
    echo 'Missing version number when testing tar release'
    exit 1
  fi
  curl -OL https://github.com/deepstreamIO/deepstream.io/releases/download/v$2/deepstream.io-linux-$2.tar.gz
  tar xf deepstream.io-linux-$2.tar.gz
elif [[ $1 == "installed" ]]; then
  echo "Assuming deepstream installed"
else
  echo "use deb/rpm/tar/installed"
  exit 1
fi

sudo deepstream service add
sudo deepstream service start
sudo deepstream service status

sleep 2

curl localhost:6020/health-check

if [[ $? == 1 ]]; then
  echo 'Deepstream service not running';
  exit 1;
fi

sudo deepstream service stop
sudo deepstream service remove
