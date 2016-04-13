var moment = require('moment-timezone');
var gcal = require('public-google-calendar')

var BARITONES_TIMEZONE = "America/Toronto";

exports.getEvents = getEvents;

//Get the events from the given file.  If the file does not exist, or is unparseable, return an error. 
function getEvents (filename, eventsCallback) {
  var events = [];
  var baritonesCalendar = new gcal({calendarId: "bearded.baritones@gmail.com"})
  baritonesCalendar.getEvents({expandRecurring:false, earliestFirst:true}, function(err, unfilteredEvents) {
    if (err) {
      eventsCallback(events, err);
    }
    var filteredEvents = unfilteredEvents.filter(filterOutRehearsals).filter(filterOutPast)
    var numberOfEvents = filteredEvents.length;
    for (var i = 0; i < numberOfEvents; i++) {
      var event = filteredEvents[i]
      event.date = moment.tz(event.start, BARITONES_TIMEZONE);
      if(event.date) {
        event.dateString = event.date.format("dddd MMMM Do, YYYY - h:mma z");
      } else {
        event.dateString = '';
      }
      filteredEvents[i] = event;
    }
    eventsCallback(filteredEvents, err);
  });
}

function filterOutRehearsals(event, index, array) {
  //If the event is a rehearsal, do not include it. 
  if (event.summary.match('[Rr]ehearsal')) {
    return false;
  } else {
    return true;
  }
}

function filterOutPast(event, index, array) {
  var now = Date.now();
  if (event.start) {
    if (event.start.valueOf() - now < 0) {
      return false;
    }
  }
  return true;
}

