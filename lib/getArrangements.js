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
        arrangements[i].dateStr = moment(arrangements[i].dateStr)
      }
      arrangements.sort(sortBasedOnDate);
      arrangementsCallback(arrangements, err);
    } else {
      arrangementsCallback(arrangements, err);
    }
  });
}

function sortBasedOnDate(arrangement1, arrangement2) {
  //Helper function for sorting.  Return difference of dates. 
  return arrangement1.date - arrangement2.date;
}