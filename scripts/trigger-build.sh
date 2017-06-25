if [ -z $1 ]; then
  echo "Missing branch name as first arguments"
  exit 1
fi

body="{
  \"request\": {
  \"branch\":\"$1\",
  \"message\": \"Tag ${TRAVIS_TAG}\"
}}"

echo $body
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Travis-API-Version: 3" \
  -H "Authorization: token ${TRAVIS_TOKEN}" \
  -d "$body" \
  https://api.travis-ci.org/repo/deepstreamIO%2Fdeepstream.io/requests
