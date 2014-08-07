(function() {
  var admzip, app, bodyParser, childProcess, clearTempFiles, clientsConnected, convertLanguageCode, createTempFilename, downloadSeriesSubtitle, downloadSubtitle, express, fs, fsstore, http, io, log, logType, methodOverride, moviedb, omx, opensrt, os, path, peerflix, readTorrent, remote, request, rimraf, saveLogEntry, server, settings, showIp, statePlaying, store, subtitleLanguage, tempDir, titlePlaying, torrentStream, tv, urltool;

  bodyParser = require('body-parser');

  methodOverride = require('method-override');

  omx = require('./omxcontrol.js');

  readTorrent = require('read-torrent');

  peerflix = require('peerflix');

  path = require('path');

  http = require('http');

  urltool = require('url');

  childProcess = require('child_process');

  fs = require('fs');

  rimraf = require('rimraf');

  fsstore = require('fs-memory-store');

  request = require('request');

  admzip = require('adm-zip');

  opensrt = require('./opensrt.js');

  store = new fsstore(__dirname + '/store');

  moviedb = require('moviedb')('c2c73ebd1e25cbc29cf61158c04ad78a');

  tempDir = require('os').tmpdir();

  express = require('express');

  os = require('os');

  app = express();

  server = http.Server(app);

  io = require('socket.io')(server);

  torrentStream = null;

  statePlaying = false;

  clientsConnected = 0;

  titlePlaying = "";

  settings = {
    subtitleLanguage: '',
    noSeeding: false
  };

  log = [];

  logType = {
    0: 'NOTE',
    1: 'WARN',
    2: 'ERRO'
  };

  server.listen(80);

  store.get('settings', function(err, val) {
    if ((err != null) || (val == null)) {
      return store.set('settings', settings, function(err) {
        return saveLogEntry(0, 'No settings found! Set to standard settings.');
      });
    } else {
      if (val.subtitleLanguage != null) {
        settings.subtitleLanguage = val.subtitleLanguage;
      }
      if (val.noSeeding != null) {
        return settings.noSeeding = val.noSeeding;
      }
    }
  });

  showIp = function() {
    var inter, interfaces, ip, t, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _m;
    interfaces = os.networkInterfaces();
    ip = 'pitv.local';
    if (interfaces['wlan0'] != null) {
      inter = interfaces['wlan0'];
      for (_i = 0, _len = inter.length; _i < _len; _i++) {
        t = inter[_i];
        if (t.family === 'IPv4') {
          ip = t.address;
        }
      }
    }
    if (ip === 'pitv.local' && (interfaces['eth1'] != null)) {
      inter = interfaces['eth1'];
      for (_j = 0, _len1 = inter.length; _j < _len1; _j++) {
        t = inter[_j];
        if (t.family === 'IPv4') {
          ip = t.address;
        }
      }
    }
    if (ip === 'pitv.local' && (interfaces['en1'] != null)) {
      inter = interfaces['en1'];
      for (_k = 0, _len2 = inter.length; _k < _len2; _k++) {
        t = inter[_k];
        if (t.family === 'IPv4') {
          ip = t.address;
        }
      }
    }
    if (ip === 'pitv.local' && (interfaces['eth0'] != null)) {
      inter = interfaces['eth0'];
      for (_l = 0, _len3 = inter.length; _l < _len3; _l++) {
        t = inter[_l];
        if (t.family === 'IPv4') {
          ip = t.address;
        }
      }
    }
    if (ip === 'pitv.local' && (interfaces['en0'] != null)) {
      inter = interfaces['en0'];
      for (_m = 0, _len4 = inter.length; _m < _len4; _m++) {
        t = inter[_m];
        if (t.family === 'IPv4') {
          ip = t.address;
        }
      }
    }
    return tv.emit('ip', ip);
  };

  saveLogEntry = function(type, msg) {
    var time, timestamp;
    time = new Date();
    timestamp = time.getTime();
    log.push({
      time: timestamp,
      type: type,
      msg: msg
    });
    if (type === 2) {
      remote.emit('alert', msg);
    }
    return console.log(time.toLocaleDateString() + ' ' + time.toLocaleTimeString() + ' [' + logType[type] + '] ' + msg);
  };

  convertLanguageCode = function(input) {
    switch (input) {
      case "albanian":
        return "al";
      case "arabic":
        return "ar";
      case "bengali":
        return "bn";
      case "brazilian-portuguese":
        return "pt";
      case "bulgarian":
        return "bg";
      case "chinese":
        return "zh";
      case "croatian":
        return "hr";
      case "czech":
        return "cs";
      case "danish":
        return "da";
      case "dutch":
        return "nl";
      case "english":
        return "en";
      case "farsi-persian":
        return "fa";
      case "finnish":
        return "fi";
      case "french":
        return "fr";
      case "german":
        return "de";
      case "greek":
        return "el";
      case "hebrew":
        return "he";
      case "hungarian":
        return "hu";
      case "indonesian":
        return "id";
      case "italian":
        return "it";
      case "japanese":
        return "ja";
      case "korean":
        return "ko";
      case "lithuanian":
        return "lt";
      case "macedonian":
        return "mk";
      case "malay":
        return "ms";
      case "norwegian":
        return "no";
      case "polish":
        return "pl";
      case "portuguese":
        return "pt";
      case "romanian":
        return "ro";
      case "russian":
        return "ru";
      case "serbian":
        return "sr";
      case "slovenian":
        return "sl";
      case "spanish":
        return "es";
      case "swedish":
        return "sv";
      case "thai":
        return "th";
      case "turkish":
        return "tr";
      case "urdu":
        return "ur";
      case "vietnamese":
        return "vi";
      default:
        return null;
    }
  };

  downloadSeriesSubtitle = function(query, cb) {
    var lang;
    lang = subtitleLanguage();
    if ((lang == null) || lang.length === 0) {
      cb({
        success: false
      });
    }
    return opensrt.searchEpisode(query, function(err, res) {
      var langcode, out, req, subtitle;
      if (err) {
        return cb({
          success: false
        });
      } else {
        langcode = convertLanguageCode(lang);
        if (langcode != null) {
          subtitle = res[langcode];
          if (subtitle != null) {
            out = fs.createWriteStream(__dirname + '/subtitles/subtitle.srt');
            req = request({
              method: 'GET',
              uri: subtitle.url
            });
            req.pipe(out);
            req.on('error', function() {
              return cb({
                success: false
              });
            });
            return req.on('end', function() {
              return cb({
                success: true,
                path: __dirname + '/subtitles/subtitle.srt'
              });
            });
          } else {
            return cb({
              success: false
            });
          }
        } else {
          return cb({
            success: false
          });
        }
      }
    });
  };

  downloadSubtitle = function(imdb_id, baseurl, cb) {
    var lang;
    lang = subtitleLanguage();
    if ((lang != null) && lang.length > 0) {
      return request('http://api.' + baseurl + '/subs/' + imdb_id, function(err, res, body) {
        var bestSub, bestSubRating, out, req, result, sub, subs, _i, _len;
        if (err || body === null) {
          saveLogEntry(2, 'Request returned odd error: ' + err.toString() + '.');
          return cb({
            success: false
          });
        } else {
          try {
            result = JSON.parse(body);
            if ((result != null) && result.success && (result.subs != null)) {
              if (result.subs[imdb_id][lang] != null) {
                subs = result.subs[imdb_id][lang];
                bestSub = null;
                bestSubRating = -99;
                for (_i = 0, _len = subs.length; _i < _len; _i++) {
                  sub = subs[_i];
                  if (sub.rating > bestSubRating) {
                    bestSub = sub;
                    bestSubRating = sub.rating;
                  }
                }
                if (bestSub) {
                  out = fs.createWriteStream(__dirname + '/subtitles/subtitle.zip');
                  req = request({
                    method: 'GET',
                    uri: 'http://' + baseurl + bestSub.url.replace('\\', '')
                  });
                  req.pipe(out);
                  req.on('error', function() {
                    saveLogEntry(2, 'Could not reach ' + baseurl + '.');
                    return cb({
                      success: false
                    });
                  });
                  return req.on('end', function() {
                    var e, entry, zip, zipEntries, _j, _len1;
                    try {
                      zip = new admzip(__dirname + '/subtitles/subtitle.zip');
                      zipEntries = zip.getEntries();
                      e = null;
                      for (_j = 0, _len1 = zipEntries.length; _j < _len1; _j++) {
                        entry = zipEntries[_j];
                        if (entry.entryName.indexOf('.srt', entry.entryName.length - 4) !== -1) {
                          e = entry;
                        }
                      }
                      if (e != null) {
                        zip.extractEntryTo(e.entryName, __dirname + '/subtitles', false, true);
                        return cb({
                          success: true,
                          path: __dirname + '/subtitles/' + e.entryName
                        });
                      } else {
                        saveLogEntry(2, 'ZIP which should contain subtitles was empty!');
                        return cb({
                          success: false
                        });
                      }
                    } catch (_error) {
                      saveLogEntry(2, 'ZIP extraction threw an unexpected error!');
                      return cb({
                        success: false
                      });
                    }
                  });
                } else {
                  return cb({
                    success: false
                  });
                }
              } else {
                saveLogEntry(0, 'No subtitles in the preffered language found.');
                return cb({
                  success: false
                });
              }
            } else {
              if ((result.subs != null) || result.subtitles > 0) {
                saveLogEntry(0, 'No subtitles found.');
              }
              return cb({
                success: false
              });
            }
          } catch (_error) {
            saveLogEntry(2, 'Could not parse JSON!');
            return cb({
              success: false
            });
          }
        }
      });
    } else {
      saveLogEntry(1, 'Language setting empty.');
      return cb({
        success: false
      });
    }
  };

  createTempFilename = function(title) {
    var name;
    name = title.toLowerCase();
    name = name.replace(' ', '_');
    return path.join(tempDir, 'torrentcast_' + name);
  };

  clearTempFiles = function() {
    return fs.readdir(tempDir, function(err, files) {
      if (!err) {
        return files.forEach(function(file) {
          if (file.substr(0, 11 === 'torrentcast')) {
            return fs.rmdir(path.join(tempDir, file));
          }
        });
      }
    });
  };

  subtitleLanguage = function() {
    if (settings.subtitleLanguage != null) {
      return settings.subtitleLanguage;
    } else {
      return '';
    }
  };

  app.use(bodyParser.urlencoded({
    extended: true
  }));

  app.use(bodyParser.json());

  app.use(methodOverride());

  app.set('view engine', 'ejs');

  app.set('views', __dirname + '/views');

  app.use('/static', express["static"](__dirname + '/static'));

  app.get('/', function(req, res, next) {
    return res.render('remote.ejs');
  });

  app.get('/tv', function(req, res, next) {
    return res.render('tv.ejs');
  });

  tv = io.of('/iotv');

  tv.on('connection', function(socket) {
    saveLogEntry(0, 'Kiosk Browser connected.');
    return showIp();
  });

  remote = io.of('/ioremote');

  remote.on('connection', function(socket) {
    clientsConnected++;
    tv.emit('main');
    socket.on('disconnect', function() {
      clientsConnected--;
      if (clientsConnected === 0) {
        return showIp();
      }
    });
    socket.on('forwardMedia', function() {
      if (statePlaying) {
        return omx.player.forward();
      }
    });
    socket.on('backwardMedia', function() {
      if (statePlaying) {
        return omx.player.backward();
      }
    });
    socket.on('stopMedia', function() {
      if (torrentStream) {
        torrentStream.destroy();
        torrentStream = null;
      }
      statePlaying = false;
      tv.emit('main');
      return omx.player.quit();
    });
    socket.on('pauseplayMedia', function() {
      if (statePlaying) {
        statePlaying = false;
        if (torrentStream) {
          torrentStream.swarm.pause();
        }
      } else {
        statePlaying = true;
        if (torrentStream) {
          torrentStream.swarm.resume();
        }
      }
      return omx.player.pause();
    });
    socket.on('searchMovieTorrents', function(imdbid, fn) {
      var url;
      url = 'http://yts.re/api/listimdb.json?imdb_id=' + imdbid;
      return request(url, function(err, res, body) {
        var result;
        if (err) {
          saveLogEntry(1, 'Could not get torrents from yts.re! Trying yts.im...');
          url = 'http://yts.im/api/listimdb.json?imdb_id=' + imdbid;
          return request(url, function(err, res, body) {
            var result;
            if (err) {
              saveLogEntry(2, 'Could not get torrents from yts.im!');
              return fn({
                success: false,
                error: 'Could not retrieve a list of torrents!'
              });
            } else {
              try {
                result = JSON.parse(body);
                if (result.MovieCount === 0) {
                  saveLogEntry(1, 'No torrents found.');
                  return fn({
                    success: false,
                    error: 'No torrents found!'
                  });
                } else {
                  return fn({
                    success: true,
                    torrents: result.MovieList
                  });
                }
              } catch (_error) {
                return saveLogEntry(2, 'Invalid JSON retrieved!');
              }
            }
          });
        } else {
          try {
            result = JSON.parse(body);
            if (result.MovieCount === 0) {
              saveLogEntry(1, 'No torrents found.');
              return fn({
                success: false,
                error: 'No torrents found!'
              });
            } else {
              return fn({
                success: true,
                torrents: result.MovieList
              });
            }
          } catch (_error) {
            saveLogEntry(2, 'Invalid JSON retrieved!');
            url = 'http://yts.im/api/listimdb.json?imdb_id=' + imdbid;
            return request(url, function(err, res, body) {
              if (err) {
                saveLogEntry(2, 'Could not get torrents from yts.im!');
                return fn({
                  success: false,
                  error: 'Could not retrieve a list of torrents!'
                });
              } else {
                try {
                  result = JSON.parse(body);
                  if (result.MovieCount === 0) {
                    saveLogEntry(1, 'No torrents found.');
                    return fn({
                      success: false,
                      error: 'No torrents found!'
                    });
                  } else {
                    return fn({
                      success: true,
                      torrents: result.MovieList
                    });
                  }
                } catch (_error) {
                  return saveLogEntry(2, 'Invalid JSON retrieved!');
                }
              }
            });
          }
        }
      });
    });
    socket.on('getMovie', function(id, fn) {
      return moviedb.movieInfo({
        id: id
      }, function(err, res) {
        if (err) {
          saveLogEntry(2, 'Could not retrieve the movie from The Movie DB!');
          return fn({
            success: false,
            error: 'Could not retrieve the movie!'
          });
        } else {
          return fn({
            success: true,
            movie: res
          });
        }
      });
    });
    socket.on('getSerie', function(id, fn) {
      var url;
      url = 'http://eztvapi.re/show/' + id;
      return request(url, function(err, res, body) {
        var result;
        if (err) {
          saveLogEntry(2, 'Could not retrieve the serie.');
          return fn({
            success: false,
            error: 'Could not retrieve serie!'
          });
        } else {
          try {
            result = JSON.parse(body);
            return fn({
              success: true,
              serie: result
            });
          } catch (_error) {
            saveLogEntry(2, 'Could not retrieve the serie. JSON parsing failed!');
            return fn({
              success: false,
              error: 'Could not retrieve serie!'
            });
          }
        }
      });
    });
    socket.on('getPopularSeries', function(page, fn) {
      var url;
      url = 'http://eztvapi.re/shows/' + page;
      return request(url, function(err, res, body) {
        var result;
        if (err) {
          saveLogEntry(2, 'Could not retrieve series.');
          return fn({
            success: false,
            error: 'Could not retrieve series!'
          });
        } else {
          try {
            result = JSON.parse(body);
            return fn({
              success: true,
              series: result
            });
          } catch (_error) {
            saveLogEntry(2, 'Could not retrieve series. JSON parsing failed!');
            return fn({
              success: false,
              error: 'Could not retrieve series!'
            });
          }
        }
      });
    });
    socket.on('getPopularMovies', function(page, fn) {
      return moviedb.miscPopularMovies({
        page: page
      }, function(err, res) {
        if (err) {
          saveLogEntry(2, 'Could not retrieve movies from The Movie DB!');
          return fn({
            success: false,
            error: 'Could not retrieve any movies!'
          });
        } else {
          return fn({
            success: true,
            movies: res.results
          });
        }
      });
    });
    socket.on('searchSeries', function(data, fn) {
      var query, url;
      query = encodeURIComponent(data.query).replace('%20', '+');
      url = 'http://eztvapi.re/shows/' + data.page + '?keywords=' + query;
      return request(url, function(err, res, body) {
        var result;
        if (err) {
          saveLogEntry(2, 'Could not retrieve series.');
          return fn({
            success: false,
            error: 'Could not retrieve series!'
          });
        } else {
          try {
            result = JSON.parse(body);
            return fn({
              success: true,
              series: result
            });
          } catch (_error) {
            saveLogEntry(2, 'Could not retrieve series. JSON parsing failed!');
            return fn({
              success: false,
              error: 'Could not retrieve series!'
            });
          }
        }
      });
    });
    socket.on('searchMovies', function(data, fn) {
      return moviedb.searchMovie({
        page: data.page,
        query: data.query,
        search_type: 'ngram'
      }, function(err, res) {
        if (err) {
          saveLogEntry(2, 'Could not retrieve movies from The Movie DB!');
          return fn({
            success: false,
            error: 'Could not retrieve any movies!'
          });
        } else {
          return fn({
            success: true,
            movies: res.results
          });
        }
      });
    });
    socket.on('playTorrent', function(data, fn) {
      tv.emit('loading');
      if ((data.magnet != null) && data.magnet.length > 0) {
        return readTorrent(data.magnet, function(err, torrent) {
          var seederSlots;
          if (err) {
            tv.emit('main');
            saveLogEntry(2, 'Could not parse the magnet link!');
            return fn({
              success: false,
              error: 'Failure while parsing the magnet link!'
            });
          } else {
            if (torrentStream) {
              torrentStream.destroy();
            }
            torrentStream = null;
            clearTempFiles();
            seederSlots = 5;
            if (settings.noSeeding) {
              seederSlots = 0;
            }
            torrentStream = peerflix(torrent, {
              connections: 100,
              path: createTempFilename(data.title),
              buffer: (1.5 * 1024 * 1024).toString(),
              uploads: seederSlots
            });
            torrentStream.server.on('listening', function() {
              var filenameReg, match, options, port, query, subtitleSetting;
              port = torrentStream.server.address().port;
              statePlaying = true;
              titlePlaying = data.title;
              options = {};
              options.input = 'http://127.0.0.1:' + port + '/';
              saveLogEntry(0, 'Torrent is playing on 127.0.0.1:' + port + '.');
              subtitleSetting = subtitleLanguage();
              if ((subtitleSetting != null) && subtitleSetting.length > 0 && (data.movie != null)) {
                return rimraf(__dirname + '/subtitles', function() {
                  return fs.mkdir(__dirname + '/subtitles', 0x1ff, function() {
                    return downloadSubtitle(data.movie.imdb_id, 'yifysubtitles.com', function(result) {
                      if (result.success) {
                        options.subtitle = result.path;
                        return omx.player.start(options);
                      } else {
                        return downloadSubtitle(data.movie.imdb_id, 'ysubs.com', function(result) {
                          if (result.success) {
                            options.subtitle = result.path;
                            return omx.player.start(options);
                          } else {
                            saveLogEntry(1, 'Getting subtitles was unsuccessful!');
                            remote.emit('alert', "No subtitles found! Playing without...");
                            return omx.player.start(options);
                          }
                        });
                      }
                    });
                  });
                });
              } else if ((subtitleSetting != null) && subtitleSetting.length > 0 && (data.episode != null)) {
                filenameReg = /.+&dn=([\w\.-]+)&tr=.+/ig;
                query = {
                  imdbid: data.episode.imdb_id,
                  season: data.episode.season,
                  episode: data.episode.episode
                };
                try {
                  match = filenameReg.exec(data.magnet);
                  if (match != null) {
                    query.filename = match[1];
                  }
                } catch (_error) {
                  saveLogEntry(1, 'Could not extract filename from the magnet link!');
                }
                return rimraf(__dirname + '/subtitles', function() {
                  return fs.mkdir(__dirname + '/subtitles', function() {
                    return downloadSeriesSubtitle(query, function(result) {
                      if (result.success) {
                        options.subtitle = result.path;
                        return omx.player.start(options);
                      } else {
                        saveLogEntry(1, 'No subtitles found.');
                        remote.emit('alert', "No subtitles found! Playing without...");
                        return omx.player.start(options);
                      }
                    });
                  });
                });
              } else {
                return omx.player.start(options);
              }
            });
            return fn({
              success: true
            });
          }
        });
      } else {
        tv.emit('main');
        saveLogEntry(2, 'No magnet link received.');
        return fn({
          success: false,
          error: 'No magnet link received!'
        });
      }
    });
    socket.on('getState', function(fn) {
      return fn({
        playing: statePlaying,
        title: titlePlaying
      });
    });
    socket.on('getLogs', function(fn) {
      if (log != null) {
        return fn({
          success: true,
          logs: log
        });
      } else {
        saveLogEntry(2, 'Could not get logs!');
        return fn({
          success: false
        });
      }
    });
    socket.on('getSettings', function(fn) {
      return store.get('settings', function(err, val) {
        if (err) {
          saveLogEntry(2, 'Could not get settings!');
          return fn({
            success: false
          });
        } else {
          return fn({
            success: true,
            settings: val
          });
        }
      });
    });
    socket.on('setSettings', function(val, fn) {
      if (val.subtitleLanguage != null) {
        settings.subtitleLanguage = val.subtitleLanguage;
      }
      if (val.noSeeding != null) {
        settings.noSeeding = val.noSeeding;
      }
      return store.set('settings', settings, function(err) {
        if (err) {
          saveLogEntry(2, 'Could not save settings!');
          return fn({
            success: false
          });
        } else {
          return fn({
            success: true
          });
        }
      });
    });
    socket.on('shutdown', function(data, fn) {
      return childProcess.exec('poweroff', function(error, stdout, stderr) {
        return saveLogEntry(0, 'Emitted power off command.');
      });
    });
    return socket.on('reboot', function(data, fn) {
      return childProcess.exec('reboot', function(error, stdout, stderr) {
        return saveLogEntry(0, 'Emitted reboot command.');
      });
    });
  });

  omx.emitter.on('stop', function() {
    return childProcess.exec('xrefresh -display :0', function(error, stdout, stderr) {
      remote.emit('stateStop');
      if (error != null) {
        return saveLogEntry(1, 'X11 refresh was unsuccessful.');
      }
    });
  });

  omx.emitter.on('complete', function() {
    return remote.emit('statePlaying', titlePlaying);
  });

  saveLogEntry(0, 'PiTV started.');

}).call(this);
