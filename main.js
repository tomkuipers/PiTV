(function() {
  var app, bodyParser, clearTempFiles, createTempFilename, express, fs, io, methodOverride, moviedb, omx, path, peerflix, readTorrent, remote, request, server, statePlaying, tempDir, torrentStream, tpb, tv, uuid;

  bodyParser = require('body-parser');

  methodOverride = require('method-override');

  omx = require('omxcontrol');

  readTorrent = require('read-torrent');

  peerflix = require('peerflix');

  uuid = require('node-uuid');

  path = require('path');

  request = require('request');

  tpb = require('thepiratebay');

  fs = require('fs');

  moviedb = require('moviedb')('c2c73ebd1e25cbc29cf61158c04ad78a');

  tempDir = require('os').tmpdir();

  express = require('express');

  app = express();

  server = require('http').Server(app);

  io = require('socket.io')(server);

  torrentStream = null;

  statePlaying = false;

  server.listen(80);

  createTempFilename = function() {
    return path.join(tempDir, 'torrentcast_' + uuid.v4());
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
        return omx.forward();
      }
    });
    socket.on('backwardMedia', function() {
      if (statePlaying) {
        return omx.backward();
      }
    });
    socket.on('stopMedia', function() {
      if (torrentStream) {
        torrentStream.destroy();
        torrentStream = null;
      }
      statePlaying = false;
      tv.emit('main');
      return omx.quit();
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
      return omx.pause();
    });
    socket.on('searchEpisodeTorrents', function(string, fn) {
      return tpb.search(string, {
        category: '205'
      }, function(err, results) {
        if (err) {
          return fn({
            success: false,
            error: 'No torrents found!'
          });
        } else {
          return fn({
            success: true,
            torrents: results
          });
        }
      });
    });
    socket.on('searchMovieTorrents', function(imdbid, fn) {
      var url;
      url = 'https://yts.re/api/listimdb.json?imdb_id=' + imdbid;
      return request(url, function(err, res, body) {
        var result;
        result = JSON.parse(body);
        if (err || result === null) {
          return fn({
            success: false,
            error: 'Could not retrieve a list of torrents!'
          });
        } else {
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
      return moviedb.tvInfo({
        id: id
      }, function(err, res) {
        if (err) {
          return fn({
            success: false,
            error: 'Could not retrieve the series!'
          });
        } else {
          return fn({
            success: true,
            serie: res
          });
        }
      });
    });
    socket.on('getSeason', function(data, fn) {
      return moviedb.tvSeasonInfo({
        id: data.id,
        season_number: data.seasonNumber
      }, function(err, res) {
        if (err) {
          return fn({
            success: false,
            error: 'Could not retrieve the season!'
          });
        } else {
          return fn({
            success: true,
            episodes: res.episodes
          });
        }
      });
    });
    socket.on('getEpisode', function(data, fn) {
      return moviedb.tvEpisodeInfo({
        id: data.id,
        season_number: data.seasonNumber,
        episode_number: data.episodeNumber
      }, function(err, res) {
        if (err) {
          return fn({
            success: false,
            error: 'Could not retrieve the episode!'
          });
        } else {
          return fn({
            success: true,
            episode: res
          });
        }
      });
    });
    socket.on('getPopularSeries', function(page, fn) {
      return moviedb.miscPopularTvs({
        page: page
      }, function(err, res) {
        if (err) {
          return fn({
            success: false,
            error: 'Could not retrieve any series!'
          });
        } else {
          return fn({
            success: true,
            series: res.results
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
      return moviedb.searchTv({
        page: data.page,
        query: data.query,
        search_type: 'ngram'
      }, function(err, res) {
        if (err) {
          return fn({
            success: false,
            error: 'Could not retrieve any series!'
          });
        } else {
          return fn({
            success: true,
            series: res.results
          });
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
    return socket.on('playTorrent', function(magnet, fn) {
      tv.emit('loading');
      if ((magnet != null) && magnet.length > 0) {
        return readTorrent(magnet, function(err, torrent) {
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
            torrentStream = peerflix(torrent, {
              connections: 100,
              path: createTempFilename(),
              buffer: (1.5 * 1024 * 1024).toString()
            });
            torrentStream.server.on('listening', function() {
              var port;
              port = torrentStream.server.address().port;
              statePlaying = true;
              omx.start('http://127.0.0.1:' + port + '/');
              return tv.emit('black');
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
  });

}).call(this);
