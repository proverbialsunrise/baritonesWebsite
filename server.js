//setup Dependencies
var express  = require('express'),
bodyParser   = require('body-parser'),
cookieParser = require('cookie-parser'),
csrf         = require('csurf'),
session      = require('express-session'),
state        = require('express-state'),
flash        = require('express-flash'),
cluster      = require('express-cluster'),
compression  = require('compression'),
hbs          = require('./lib/exphbs'),
routes       = require('./routes'),
middleware   = require('./middleware'),
config       = require('./config'),
utils        = require('./lib/utils'),
getEvents    = require('./lib/getEvents'),
getArrangements = require('./lib/getArrangements'),
getRepertoire = require('./lib/getRepertoire'),
port         = (process.env.BariPORT || 4952);


//Comment out the line below if you want to enable cluster support.
setupServer();

//Uncomment the line below if you want to enable cluster support.
//cluster(setupServer);


function setupServer (worker) {
    var app = express(),
        server = app.listen(port, function () {
            console.log("Baritones website is running on:" + server.address().port);
        }),
        router;

    //Setup Express App
    state.extend(app);
    app.engine(hbs.extname, hbs.engine);
    app.set('view engine', hbs.extname);
    app.enable('view cache');

    //Uncomment this if you want strict routing (ie: /foo will not resolve to /foo/)
    //app.enable('strict routing');

    app.set('state namespace', 'BBs');

    //Create an empty Data object and expose it to the client. This
    //will be available on the client under App.Data.
    //This is just an example, so feel free to remove this.
    app.expose({}, 'Data');

    if (app.get('env') === 'development') {
      app.use(middleware.logger('tiny'));
    }

    // Set default views directory. 
    app.set('views', config.dirs.views);

    router = express.Router({
        caseSensitive: app.get('case sensitive routing'),
        strict       : app.get('strict routing')
    });

    // Parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: false }));

    // Parse application/json
    app.use(bodyParser.json());

    // Parse cookies.
    app.use(cookieParser());

    // Session Handling
    app.use(session({secret: 'keyboard cat', resave: true, saveUninitialized: true}));


    // Flash Message Support
    app.use(flash());

    //GZip Support
    app.use(compression()); 

    // Specify the public directory.
    app.use(express.static(config.dirs.pub));

    app.use(csrf({cookie: true}));
    app.use(function(req, res, next) {
        var token = req.csrfToken();
        res.cookie('XSRF-TOKEN', token);
        res.locals._csrf = token;
        next();
    });

    app.use(function (err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);
      console.log(err.code);
      // handle CSRF token errors here
      res.status(403);
      res.send('form tampered with');
    });

    // Use the router.
    app.use(router);


    ///////////////////////////////////////////
    //              Routes                   //
    ///////////////////////////////////////////

    /////// ADD ALL YOUR ROUTES HERE  /////////

    // The exposeTemplates() method makes the Handlebars templates that are inside /shared/templates/
    // available to the client.
    router.get('/', function (req, res) {
      res.locals.title = "Bearded Baritones";
      res.render('home');
    });

    router.get('/about', function (req, res) {
      res.locals.title = "About | Bearded Baritones";
      res.render('about');
    });

    router.get('/videos', function (req, res) {
      res.locals.title = "Videos | Bearded Baritones";
      res.render('videos');
    });

    router.get('/arrangements', function (req, res) {
      res.locals.title = "Arrangements | Bearded Baritones";
      getArrangements.getArrangements('data/arrangements.json', function (arrangements,err) {
        if (!err) {
          res.locals.arrangements = arrangements;
          res.render('arrangements');
        } else {
          res.render('500', {
            status: err.status || 500,
            error: err
          });
        }
      });
    });

   router.get('/repertoire', function (req, res) {
      res.locals.title = "Arrangements | Bearded Baritones";
      getRepertoire.getRepertoire('data/repertoire.json', function (songs, err) {
        if (!err) {
          res.locals.songs = songs;
          res.render('repertoire');
        } else {
          res.render('500', {
            status: err.status || 500,
            error: err
          });
        }
      });
    });

    router.get('/appearances', function (req, res) {
      res.locals.title = "Appearances | Bearded Baritones";
      getEvents.getEvents('data' + '/appearances.xml', function (events, err) {
        if (!err) {
          res.locals.events = events;
          res.render('appearances');
        } else {
          res.render('500', {
            status: err.status || 500,
            error: err
          });
        }
      });
    });


    router.get('/photos', function (req, res) {
      utils.getImagesForPhotosPage(function(images, err) {
          if (!err) {
            res.locals.photos=images;
            res.locals.title = "Photos | Bearded Baritones";
            res.render('photos');
          } else {
            res.render('500', {
              status: err.status || 500,
              error: err
            });
          }
      });
    });

    router.get('/contact', function (req, res) {
      res.locals.title = "Contact | Bearded Baritones";
      res.render('contact');
    });

    // Error handling middleware
    app.use(function(req, res, next){
        res.render('404', { status: 404, url: req.url });
    });

    app.use(function(err, req, res, next){
        res.render('500', {
            status: err.status || 500,
            error: err
        });
    });

    return server;
}

