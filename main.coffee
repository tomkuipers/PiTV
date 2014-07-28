bodyParser = require 'body-parser'
methodOverride = require 'method-override'
omx = require 'omxcontrol'
readTorrent = require 'read-torrent'
peerflix = require 'peerflix'
uuid = require 'node-uuid'
path = require 'path'
http = require 'http'
urltool = require 'url'
tpb = require 'thepiratebay'
childProcess = require 'child_process'
fs = require 'fs'
rimraf = require 'rimraf'
fsstore = require 'fs-memory-store'
request = require 'request'
admzip = require 'adm-zip'
store = new fsstore(__dirname + '/store')
moviedb = require('moviedb')('c2c73ebd1e25cbc29cf61158c04ad78a')
tempDir = require('os').tmpdir()
express = require 'express'
app = express()
server = http.Server(app)
io = require('socket.io')(server)
torrentStream = null
statePlaying = false
titlePlaying = ""
settings = {}

server.listen 80

store.get 'settings', (err, val) ->
  if err is null
    settings = val

downloadSubtitle = (imdb_id, cb) ->
  lang = subtitleLanguage()
  request 'http://api.yifysubtitles.com/subs/' + imdb_id, (err, res, body) ->
    if err
      cb
        success: false
    else
      result = JSON.parse body
      if result.success
        if result.subs[imdb_id][lang]?
          subs = result.subs[imdb_id][lang]
          bestSub = null
          bestSubRating = -99
          for sub in subs
            if sub.rating > bestSubRating
              bestSub = sub
              bestSubRating = sub.rating
          if bestSub
            out = fs.createWriteStream __dirname + '/subtitles/subtitle.zip'
            req = request
              method: 'GET',
              uri: 'http://yifysubtitles.com' + bestSub.url.replace('\\','')
            req.pipe out
            req.on 'error', ->
              cb
                success: false
            req.on 'end', ->
              try
                zip = new admzip(__dirname + '/subtitles/subtitle.zip')
                zipEntries = zip.getEntries()
                e = null
                for entry in zipEntries
                  if entry.entryName.indexOf('.srt', entry.entryName.length - 4) isnt -1
                    e = entry
                if e?
                  zip.extractEntryTo e.entryName, __dirname + '/subtitles', false, true
                  cb
                    success: true
                    path: __dirname + '/subtitles/' + e.entryName
                else
                  cb
                    success: false
              catch
                cb
                  success: false
          else
            cb
              success: false
        else
          cb
            success: false
      else
        cb
          success: false

createTempFilename = ->
  path.join tempDir, 'torrentcast_' + uuid.v4()

clearTempFiles = ->
  fs.readdir tempDir, (err, files) ->
    unless err
      files.forEach (file) ->
        if file.substr 0, 11 is 'torrentcast'
          fs.rmdir path.join tempDir, file

isSubtitleEnabled = ->
  if settings.subtitles?
    settings.subtitles
  else
    false

subtitleLanguage = ->
  if settings.subtitleLanguage?
    settings.subtitleLanguage
  else
    ""

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
      omx.player.forward()
  socket.on 'backwardMedia', () ->
    if statePlaying
      omx.player.backward()
  socket.on 'stopMedia', () ->
    if torrentStream
      torrentStream.destroy()
      torrentStream = null
    statePlaying = false
    tv.emit 'main'
    omx.player.quit()
  socket.on 'pauseplayMedia', () ->
    if statePlaying
      statePlaying = false
      if torrentStream
        torrentStream.swarm.pause()
    else
      statePlaying = true
      if torrentStream
        torrentStream.swarm.resume()
    omx.player.pause()
  socket.on 'searchEpisodeTorrents', (string, fn) ->
    tpb.search string,
      category: '205'
    , (err, results) ->
      if err
        fn
          success: false
          error: 'No torrents found!'
      else
        fn
          success: true
          torrents: results
  socket.on 'searchMovieTorrents', (imdbid, fn) ->
    url = 'http://yts.re/api/listimdb.json?imdb_id=' + imdbid
    request url, (err, res, body) ->
      if err
        url = 'http://yts.im/api/listimdb.json?imdb_id=' + imdbid
        request url, (err, res, body) ->
          if err
            fn
              success: false
              error: 'Could not retrieve a list of torrents!'
          else
            result = JSON.parse body
            if result.MovieCount == 0
              fn
                success: false
                error: 'No torrents found!'
            else
              fn
                success: true
                torrents: result.MovieList
      else
        result = JSON.parse body
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
    url = 'http://eztvapi.re/show/' + id
    request url, (err, res, body) ->
      if err
        fn
          success: false
          error: 'Could not retrieve serie!'
      else
        try
          result = JSON.parse body
          fn
            success: true
            serie: result
        catch
          fn
            success: false
            error: 'Could not retrieve serie!'
  socket.on 'getPopularSeries', (page, fn) ->
    url = 'http://eztvapi.re/shows/' + page
    request url, (err, res, body) ->
      if err
        fn
          success: false
          error: 'Could not retrieve series!'
      else
        result = JSON.parse body
        fn
          success: true
          series: result
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
    query = encodeURIComponent(data.query).replace('%20', '+')
    url = 'http://eztvapi.re/shows/' + data.page + '?keywords=' + query
    request url, (err, res, body) ->
      if err
        fn
          success: false
          error: 'Could not retrieve series!'
      else
        try
          result = JSON.parse body
          fn
            success: true
            series: result
        catch
          fn
            success: false
            error: 'Could not retrieve series!'
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
  socket.on 'playTorrent', (data, fn) ->
    tv.emit 'loading'
    if data.magnet? and data.magnet.length > 0
      readTorrent data.magnet, (err, torrent) ->
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
            titlePlaying = data.title
            options = {}
            options.input = 'http://127.0.0.1:' + port + '/'

            if isSubtitleEnabled() and data.imdb_id?
              rimraf __dirname + '/subtitles', ->
                fs.mkdir __dirname + '/subtitles', ->
                  downloadSubtitle data.imdb_id, (data) ->
                    if data.success
                      options.subtitle = data.path
                      omx.player.start options
                      tv.emit 'black'
                    else
                      omx.player.start options
                      tv.emit 'black'
            else
              omx.player.start options
              tv.emit 'black'
          fn
            success: true
    else
      tv.emit 'main'
      fn
        success: false
        error: 'No magnet link received!'
  socket.on 'returnState', (fn) ->
    fn
      playing: statePlaying
      title: titlePlaying
  socket.on 'getSettings', (fn) ->
    store.get 'settings', (err, val) ->
      if err
        fn
          success: false
      else
        fn
          success: true
          settings: val
  socket.on 'setSettings', (data, fn) ->
    store.set 'settings', data, (err) ->
      if err
        fn
          success: false
      else
        settings = data
        fn
          success: true

omx.emitter.on 'stop', ->
  childProcess.exec 'xrefresh -display :0', (error, stdout, stderr) ->
    remote.emit 'stateStop'
    if error?
      console.log "Could not give PiTV the authority back!"

omx.emitter.on 'complete', ->
  remote.emit 'statePlaying', titlePlaying
