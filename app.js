import express from 'express';
import { engine } from 'express-handlebars';
import helmet from 'helmet';
import path from 'node:path';
import { getArrangements } from './lib/getArrangements.js';
import { getEvents as defaultGetEvents } from './lib/getEvents.js';
import { getRepertoire } from './lib/getRepertoire.js';
import { getImagesForPhotosPage } from './lib/utils.js';

const ROOT_DIR = import.meta.dirname;

export function createApp({
  dataDir = path.join(ROOT_DIR, 'data'),
  publicDir = path.join(ROOT_DIR, 'public'),
  viewsDir = path.join(ROOT_DIR, 'views'),
  pureCssDir = path.join(ROOT_DIR, 'node_modules', 'purecss', 'build'),
  calendarId = process.env.CALENDAR_ID,
  timeZone = process.env.TIMEZONE,
  getEvents = defaultGetEvents,
  isProduction = process.env.NODE_ENV === 'production',
} = {}) {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          frameSrc: ['https://www.youtube.com', 'https://www.youtube-nocookie.com'],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
    }),
  );

  app.engine(
    '.handlebars',
    engine({
      extname: '.handlebars',
      defaultLayout: 'main',
      layoutsDir: path.join(viewsDir, 'layouts'),
      partialsDir: path.join(viewsDir, 'partials'),
    }),
  );
  app.set('view engine', '.handlebars');
  app.set('views', viewsDir);

  if (isProduction) {
    app.enable('view cache');
  }

  app.use(
    '/vendor/purecss',
    express.static(pureCssDir, { maxAge: isProduction ? '7d' : 0 }),
  );
  app.use(express.static(publicDir, { maxAge: isProduction ? '1d' : 0 }));

  app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/', (req, res) => {
    res.render('home', { title: 'Bearded Baritones' });
  });

  app.get('/about', (req, res) => {
    res.render('about', { title: 'About | Bearded Baritones' });
  });

  app.get('/videos', (req, res) => {
    res.render('videos', { title: 'Videos | Bearded Baritones' });
  });

  app.get('/arrangements', async (req, res) => {
    const arrangements = await getArrangements(path.join(dataDir, 'arrangements.json'));
    res.render('arrangements', {
      title: 'Arrangements | Bearded Baritones',
      arrangements,
    });
  });

  app.get('/repertoire', async (req, res) => {
    const songs = await getRepertoire(path.join(dataDir, 'repertoire.json'));
    res.render('repertoire', {
      title: 'Repertoire | Bearded Baritones',
      songs,
    });
  });

  app.get('/appearances', async (req, res) => {
    const events = await getEvents({ calendarId, timeZone });
    res.render('appearances', {
      title: 'Appearances | Bearded Baritones',
      events,
    });
  });

  app.get('/photos', async (req, res) => {
    const photos = await getImagesForPhotosPage(path.join(publicDir, 'img', 'perform'));
    res.render('photos', {
      title: 'Photos | Bearded Baritones',
      photos,
    });
  });

  app.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact | Bearded Baritones' });
  });

  app.use((req, res) => {
    res.status(404).render('404', {
      title: 'Page Not Found | Bearded Baritones',
      url: req.url,
    });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).render('500', {
      title: 'Server Error | Bearded Baritones',
      status,
      error: isProduction ? null : err.message,
    });
  });

  return app;
}
