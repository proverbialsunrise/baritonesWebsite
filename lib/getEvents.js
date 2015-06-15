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
          if (event.date) { 
            if (event.date.hasTime)
            {
              event.dateString = event.date.format("dddd MMMM Do, YYYY - h:mm a");
            } else {
              event.dateString = event.date.format("dddd MMMM Do, YYYY");
            }
          } else {
            event.dateString = '';
          }
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
  if (event.date) {
    if (event.date.valueOf() - now < 0) {
      return false;
    }
  }
  return true;
}

function sortBasedOnDate(event1, event2) {
  //Helper function for sorting events.  Return difference of dates. 
  
  return event1.date - event2.date;
}

function getDateStringForEventWithTime(summary) {
  /*This regular expression will search for the date string after the Word 'When:' followed by the day of the week,
  and then capture the date afterwards up to the word 'to'.  This works when the events have a defined time. */
  var re = /When: \w{3} (.*?[\d:]*.*) to/; 
  var match;
  if ((match = re.exec(summary)) !== null) {
    if (match.index === re.lastIndex) {
        re.lastIndex++;
    }
    var dateString = match[1];
    return dateString;
  }
  return null;
}

function getDateStringForEventWithoutTime(summary) {
  /*This regular expression searches for the date string after the word 'When: ' followed by a three letter day of the week.
  It then captures up to the four digit year that indicates the end of the date when there is no associated time.*/
  var re = /When: \w{3} (.*\d{4})/; 
  var match;
  if ((match = re.exec(summary)) !== null) {
    if (match.index === re.lastIndex) {
        re.lastIndex++;
    }
    var dateString = match[1];
    return dateString;
  }
  return null;
}

/*Google Calendar XML has date formats in three different ways (so far).  One function to handle each format.  We'll try each one in turn
And then if none are correct return null.*/

/*Date format one.  The event has a time and the time is formatted as 'MMM DD, YYYY ha'.*/
function dateFormatOne(summary) {
  var dateString = getDateStringForEventWithTime(summary);
  if (dateString) {
    var theDate = moment(dateString, 'MMM DD, YYYY ha', true);
    if (theDate.isValid()) {
      theDate.hasTime = true;
      return theDate;
    }
  }
  return null;
}

/*Date format two.  The event has a time and the time is formatted as 'D MMM YYYY hh:mm' */
function dateFormatTwo(summary) {
  var dateString = getDateStringForEventWithTime(summary);
  if (dateString) {
    var theDate = moment(dateString, 'D MMM YYYY hh:mm');
    if (theDate.isValid()) {
      theDate.hasTime = true;
      return theDate;
    }
  }
  return null;
}

/* Date format three. The event does not have a time.  Is formattted as 'D MMM, YYYY */
function dateFormatThree(summary) {
  var dateString = getDateStringForEventWithoutTime(summary);
  if (dateString) {
    var theDate = moment(dateString, 'D MMM YYYY');
    if (theDate.isValid()) {
      theDate.hasTime = false;
      return theDate;
    }
  }
  return null;
}

function getDateFromSummary(summary) {
  var getDateFormats = [dateFormatOne, dateFormatTwo, dateFormatThree];
  var numFormats = getDateFormats.length;
  var date = null;
  for (var i = 0; i < numFormats; i++) {
    date = getDateFormats[i](summary)
    if (date)
    {
      return date;
    }
  }
  return null;
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


