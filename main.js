(function() {
  var admzip, app, bodyParser, childProcess, clearTempFiles, convertLanguageCode, createTempFilename, downloadSeriesSubtitle, downloadSubtitle, express, fs, fsstore, http, io, methodOverride, moviedb, omx, opensrt, path, peerflix, readTorrent, remote, request, rimraf, server, settings, statePlaying, store, subtitleLanguage, tempDir, titlePlaying, torrentStream, tv, urltool;

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

  app = express();

  server = http.Server(app);

  io = require('socket.io')(server);

  torrentStream = null;

  statePlaying = false;

  titlePlaying = "";

  settings = {};

  server.listen(80);

  store.get('settings', function(err, val) {
    if (err != null) {
      settings = {
        subtitleLanguage: '',
        noSeeding: false
      };
      return store.set('settings', settings(function(err) {
        return console.log('Set to standard settings');
      }));
    } else {
      return settings = val;
    }
  });

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
    if (lang === null) {
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
    return request('http://api.' + baseurl + '/subs/' + imdb_id, function(err, res, body) {
      var bestSub, bestSubRating, out, req, result, sub, subs, _i, _len;
      if (err || body === null) {
        return cb({
          success: false,
          requesterr: true
        });
      } else {
        result = JSON.parse(body);
        if (result.success && (result.subs != null) && result.subtitles > 0) {
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
                uri: 'http://' + baseurl + '.com' + bestSub.url.replace('\\', '')
              });
              req.pipe(out);
              req.on('error', function() {
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
                    return cb({
                      success: false
                    });
                  }
                } catch (_error) {
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
      return null;
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
    return console.log("TV Connected!");
  });

  remote = io.of('/ioremote');

  remote.on('connection', function(socket) {
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
          url = 'http://yts.im/api/listimdb.json?imdb_id=' + imdbid;
          return request(url, function(err, res, body) {
            var result;
            if (err) {
              return fn({
                success: false,
                error: 'Could not retrieve a list of torrents!'
              });
            } else {
              result = JSON.parse(body);
              if (result.MovieCount === 0) {
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
            }
          });
        } else {
          result = JSON.parse(body);
          if (result.MovieCount === 0) {
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
        }
      });
    });
    socket.on('getMovie', function(id, fn) {
      return moviedb.movieInfo({
        id: id
      }, function(err, res) {
        if (err) {
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
          return fn({
            success: false,
            error: 'Could not retrieve series!'
          });
        } else {
          result = JSON.parse(body);
          return fn({
            success: true,
            series: result
          });
        }
      });
    });
    socket.on('getPopularMovies', function(page, fn) {
      return moviedb.miscPopularMovies({
        page: page
      }, function(err, res) {
        if (err) {
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
              subtitleSetting = subtitleLanguage();
              if ((subtitleSetting != null) && subtitleSetting.length > 0 && (data.movie != null)) {
                return rimraf(__dirname + '/subtitles', function() {
                  return fs.mkdir(__dirname + '/subtitles', function() {
                    return downloadSubtitle(data.imdb_id, 'yifysubtitles.com', function(result) {
                      if (result.success) {
                        options.subtitle = result.path;
                        return omx.player.start(options);
                      } else {
                        if (result.requesterr) {
                          return downloadSubtitle(data.imdb_id, 'ysubs.com', function(result) {
                            if (result.success) {
                              options.subtitle = result.path;
                              return omx.player.start(options);
                            } else {
                              return downloadSubtitle(data.imdb_id, 'ysubs.com', function(result) {
                                if (result.success) {
                                  options.subtitle = result.path;
                                  return omx.player.start(options);
                                } else {
                                  remote.emit('error', "No subtitles found! Playing without...");
                                  return omx.player.start(options);
                                }
                              });
                            }
                          });
                        } else {
                          return downloadSubtitle(data.imdb_id, 'yifysubtitles.com', function(result) {
                            if (result.success) {
                              options.subtitle = result.path;
                              return omx.player.start(options);
                            } else {
                              remote.emit('error', "No subtitles found! Playing without...");
                              return omx.player.start(options);
                            }
                          });
                        }
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
                  console.log('Could not extract filename!');
                }
                return rimraf(__dirname + '/subtitles', function() {
                  return fs.mkdir(__dirname + '/subtitles', function() {
                    return downloadSeriesSubtitle(query, function(result) {
                      if (result.success) {
                        options.subtitle = result.path;
                        return omx.player.start(options);
                      } else {
                        remote.emit('error', "No subtitles found! Playing without...");
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
    socket.on('getSettings', function(fn) {
      return store.get('settings', function(err, val) {
        if (err) {
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
    socket.on('setSettings', function(data, fn) {
      return store.set('settings', data, function(err) {
        if (err) {
          return fn({
            success: false
          });
        } else {
          settings = data;
          return fn({
            success: true
          });
        }
      });
    });
    socket.on('shutdown', function(data, fn) {
      return childProcess.exec('poweroff', function(error, stdout, stderr) {
        return console.log('Bye!');
      });
    });
    return socket.on('reboot', function(data, fn) {
      return childProcess.exec('reboot', function(error, stdout, stderr) {
        return console.log('Bye!');
      });
    });
  });

  omx.emitter.on('stop', function() {
    return childProcess.exec('xrefresh -display :0', function(error, stdout, stderr) {
      remote.emit('stateStop');
      if (error != null) {
        return console.log("Could not give PiTV the authority back!");
      }
    });
  });

  omx.emitter.on('complete', function() {
    return remote.emit('statePlaying', titlePlaying);
  });

}).call(this);
