var parseXlsx = require('excel');

parseXlsx('Protocoll.xlsx', function(err, data) {
  if(err) throw err;
  console.log( data );
});