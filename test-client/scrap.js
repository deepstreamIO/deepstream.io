testString = 'abc|def\\|ghi';
splitter = '|';

split = function( testString, splitter ){
	var result = [],
		start = 0,
		escapeChar = '\\',
		i;

	for( i = 0; i < testString.length; i++ ) {
		if( testString[ i ] === escapeChar ) {
			i++;
			continue;
		}
		if( testString[ i ] === splitter ) {
			result.push( testString.substring( start, i ) );
			i++;
			start = i;
		}
	}

	result.push( testString.substring( start, i ) );

	return result;
};

split( testString, splitter );

server.on('connection', function(socket){
  socket.send('utf 8 string');
  socket.send(new Buffer([0, 1, 2, 3, 4, 5])); // binary data
});

!"#$%&()*+,-./{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿–—‘’‚“”„†‡•…‰€
!"#$%&()*+,-./{|}~Â¡Â¢Â£Â¤Â¥Â¦Â§Â¨Â©ÂªÂ«Â¬Â®Â¯Â°Â±Â²Â³Â´
ÂµÂ¶Â·Â¸Â¹ÂºÂ»Â¼Â½Â¾Â¿â€“â€”â€˜â€™â€šâ€œâ€â€žâ€ â€¡â€¢â€¦â€°â‚¬