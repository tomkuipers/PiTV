bodyParser = require 'body-parser'
methodOverride = require 'method-override'
omx = require 'omxcontrol'
readTorrent = require 'read-torrent'
peerflix = require 'peerflix'
uuid = require 'node-uuid'
path = require 'path'
request = require 'request'
tpb = require 'thepiratebay'
fs = require 'fs'
moviedb = require('moviedb')('c2c73ebd1e25cbc29cf61158c04ad78a')
tempDir = require('os').tmpdir()
express = require 'express'
app = express()
server = require('http').Server(app)
io = require('socket.io')(server)
torrentStream = null
statePlaying = false

server.listen 80

createTempFilename = ->
  path.join tempDir, 'torrentcast_' + uuid.v4()

clearTempFiles = ->
  fs.readdir tempDir, (err, files) ->
    unless err
      files.forEach (file) ->
        if file.substr 0, 11 is 'torrentcast'
          fs.rmdir path.join tempDir, file

app.use bodyParser.urlencoded
  extended: true
app.use bodyParser.json()
app.use methodOverride()

app.set 'view engine', 'ejs'
app.set 'views', (__dirname + '/views')

app.use '/static', express.static(__dirname + '/static')

app.get '/', (req, res, next) ->
  res.render 'remote.ejs'

app.get '/tv', (req, res, next) ->
  res.render 'tv.ejs'

tv = io.of '/iotv'
tv.on 'connection', (socket) ->
  console.log "TV Connected!"

remote = io.of '/ioremote'
remote.on 'connection', (socket) ->
  socket.on 'forwardMedia', () ->
    if statePlaying
      omx.forward()
  socket.on 'backwardMedia', () ->
    if statePlaying
      omx.backward()
  socket.on 'stopMedia', () ->
    if torrentStream
      torrentStream.destroy()
      torrentStream = null
    statePlaying = false
    tv.emit 'main'
    omx.quit()
  socket.on 'pauseplayMedia', () ->
    if statePlaying
      statePlaying = false
      if torrentStream
        torrentStream.swarm.pause()
    else
      statePlaying = true
      if torrentStream
        torrentStream.swarm.resume()
    omx.pause()
  socket.on 'searchEpisodeTorrents', (string, fn) ->
    tpb.search string,
      category: '205'
    , (err, results) ->
      if (err)
        fn
          success: false
          error: 'No torrents found!'
      else
        fn
          success: true
          torrents: results
  socket.on 'searchMovieTorrents', (imdbid, fn) ->
    url = 'https://yts.re/api/listimdb.json?imdb_id=' + imdbid
    request url, (err, res, body) ->
      result = JSON.parse body
      if err or result == null
        fn
          success: false
          error: 'Could not retrieve a list of torrents!'
      else
        if result.MovieCount == 0
          fn
            success: false
            error: 'No torrents found!'
        else
          fn
            success: true
            torrents: result.MovieList
  socket.on 'getMovie', (id, fn) ->
    moviedb.movieInfo
      id: id
    , (err, res) ->
      if err
        fn
          success: false
          error: 'Could not retrieve the movie!'
      else
        fn
          success: true
          movie: res
  socket.on 'getSerie', (id, fn) ->
    moviedb.tvInfo
      id: id
    , (err, res) ->
      if err
        fn
          success: false
          error: 'Could not retrieve the series!'
      else
        fn
          success: true
          serie: res
  socket.on 'getSeason', (data, fn) ->
    moviedb.tvSeasonInfo
      id: data.id
      season_number: data.seasonNumber
    , (err, res) ->
      if err
        fn
          success: false
          error: 'Could not retrieve the season!'
      else
        fn
          success: true
          episodes: res.episodes
  socket.on 'getEpisode', (data, fn) ->
    moviedb.tvEpisodeInfo
      id: data.id
      season_number: data.seasonNumber
      episode_number: data.episodeNumber
    , (err, res) ->
      if err
        fn
          success: false
          error: 'Could not retrieve the episode!'
      else
        fn
          success: true
          episode: res
  socket.on 'getPopularSeries', (page, fn) ->
    moviedb.miscPopularTvs
      page: page
    ,(err, res) ->
      if err
        fn
          success: false
          error: 'Could not retrieve any series!'
      else
        fn
          success: true
          series: res.results
  socket.on 'getPopularMovies', (page, fn) ->
    moviedb.miscPopularMovies
      page: page
    ,(err, res) ->
      if err
        fn
          success: false
          error: 'Could not retrieve any movies!'
      else
        fn
          success: true
          movies: res.results
  socket.on 'searchSeries', (data, fn) ->
    moviedb.searchTv
      page: data.page
      query: data.query
      search_type: 'ngram'
    ,(err, res) ->
      if err
        fn
          success: false
          error: 'Could not retrieve any series!'
      else
        fn
          success: true
          series: res.results
  socket.on 'searchMovies', (data, fn) ->
    moviedb.searchMovie
      page: data.page
      query: data.query
      search_type: 'ngram'
    ,(err, res) ->
      if err
        fn
          success: false
          error: 'Could not retrieve any movies!'
      else
        fn
          success: true
          movies: res.results
  socket.on 'playTorrent', (magnet, fn) ->
    tv.emit 'loading'
    if magnet? and magnet.length > 0
      readTorrent magnet, (err, torrent) ->
        if err
          tv.emit 'main'
          fn
            success: false
            error: 'Failure while parsing the magnet link!'
        else
          if torrentStream
            torrentStream.destroy()
          torrentStream = null
          clearTempFiles()

          torrentStream = peerflix torrent,
            connections: 100
            path: createTempFilename()
            buffer: (1.5 * 1024 * 1024).toString()

          torrentStream.server.on 'listening', ->
            port = torrentStream.server.address().port
            statePlaying = true
            omx.start 'http://127.0.0.1:' + port + '/'
            tv.emit 'black'
          fn
            success: true
    else
      tv.emit 'main'
      fn
        success: false
        error: 'No magnet link received!'
