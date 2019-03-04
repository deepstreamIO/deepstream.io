#!/usr/bin/env bash
echo '1) Setting up submodules'
git submodule update --init --recursive
echo '2) Installing dependencies'
npm i
echo '2) Running tests'
npm run e2e
