var fs = require('fs');
var moment = require('moment');


exports.getArrangements = getArrangements;

//Get the events from the given file.  If the file does not exist, or is unparseable, return an error. 
function getArrangements (filename, arrangementsCallback) {
  var arrangements = [];
  fs.readFile(filename, function (err, data) {
    if(!err) {
      arrangements = JSON.parse(data);
      var numArrangements = arrangements.length;
      for (var i = 0; i < numArrangements; i++) {
        arrangements[i].date = moment(arrangements[i].dateStr);
        arrangements[i].dateStr = arrangements[i].date.format("MMMM, YYYY");
      }
      arrangements.sort(sortBasedOnDateReversed);
      arrangementsCallback(arrangements, err);
    } else {
      arrangementsCallback(arrangements, err);
    }
  });
}

function sortBasedOnDateReversed(arrangement1, arrangement2) {
  //Helper function for sorting.  Return difference of dates. 
  return arrangement2.date - arrangement1.date;
}