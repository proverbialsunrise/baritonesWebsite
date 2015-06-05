var fs = require('fs');
var moment = require('moment');
var parseString = require('xml2js').parseString;

exports.getEvents = getEvents;

//Get the events from the given file.  If the file does not exist, or is unparseable, return an error. 
function getEvents (filename, eventsCallback) {
  var events = [];
  fs.readFile(filename, function (err, data) {
    if(!err) {
      parseString(data, function (err, result) {
      if(!err) {
        var unparsedEvents = result.feed.entry.filter(filterOutRehearsals);
        var numberOfEvents = unparsedEvents.length;
        for (var i = 0; i < numberOfEvents; i++) {
          var event = {};
          var summary = unparsedEvents[i].summary[0]._;
          event.title = unparsedEvents[i].title[0]._;
          event.date = getDateFromSummary(summary);
          event.dateString = event.date.format("dddd MMMM Do, YYYY - h:mm a");
          event.location = getLocationFromSummary(summary);
          events[i] = event;
        }
          events = events.sort(sortBasedOnDate);
          events = events.filter(filterOutPast);
          eventsCallback(events, err);
      } else {
        eventsCallback(events, err);
      }
      });
    } else {
      eventsCallback(events, err);
    }
  });
}

function filterOutRehearsals(event, index, array) {
  //If the event is a rehearsal, do not include it. 
  if (event.title[0]._.match('[Rr]ehearsal')) {
    return false;
  } else {
    return true;
  }
}

function filterOutPast(event, index, array) {
  var now = Date.now();
  if (event.date.valueOf() - now < 0) {
    return false;
  } else {
    return true;
  }
}

function sortBasedOnDate(event1, event2) {
  //Helper function for sorting events.  Return difference of dates. 
  return event1.date - event2.date;
}

function getDateFromSummary(summary) {
  //Get the Date of the event using regex.
  var re = /When: \w{3} (.*?[\d:]*.*) to/; 
  var match;
  console.dir(summary);
  if ((match = re.exec(summary)) !== null) {
    if (match.index === re.lastIndex) {
        re.lastIndex++;
    }
    var dateString = match[1];
    console.dir(dateString);
    var theDate = moment(dateString, 'MMM DD, YYYY ha', true);
    if (theDate.isValid()) {
      return theDate;
    } else {
      theDate = moment(dateString, 'D MMM YYYY hh:mm');
      if (theDate.isValid()) {
        return theDate;
      }
    }    
    console.dir(moment);
    return null;
  }
  return '';
}

function getLocationFromSummary(summary) {
  //get the Location of the event using regex.
  var re = /Where: (.*?)\n/;
  var match;
 
  if ((match = re.exec(summary)) !== null) {
    if (match.index === re.lastIndex) {
        re.lastIndex++;
    }
    var locationString = match[1];
    return locationString;
  }
  return '';
}


