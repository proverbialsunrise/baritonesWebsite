var fs = require('fs');

exports.getRepertoire = getRepertoire;

//Get the events from the given file.  If the file does not exist, or is unparseable, return an error. 
function getRepertoire (filename, repertoireCallback) {
  var repertoire = [];
  fs.readFile(filename, function (err, data) {
    if(!err) {
      repertoire = JSON.parse(data);
      repertoire.sort(compareTitles);
      repertoireCallback(repertoire, err);
    } else {
      repertoireCallback(repertoire, err);
    }
  });
}

function compareTitles(rep1,rep2) {
  if (rep1.title < rep2.title)
    return -1;
  if (rep1.title > rep2.title)
    return 1;
  return 0;
}