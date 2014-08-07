bodyParser = require 'body-parser'
methodOverride = require 'method-override'
omx = require './omxcontrol.js'
readTorrent = require 'read-torrent'
peerflix = require 'peerflix'
path = require 'path'
http = require 'http'
urltool = require 'url'
childProcess = require 'child_process'
fs = require 'fs'
rimraf = require 'rimraf'
fsstore = require 'fs-memory-store'
request = require 'request'
admzip = require 'adm-zip'
opensrt = require './opensrt.js'
store = new fsstore(__dirname + '/store')
moviedb = require('moviedb')('c2c73ebd1e25cbc29cf61158c04ad78a')
tempDir = require('os').tmpdir()
express = require 'express'
os = require 'os'
app = express()
server = http.Server(app)
io = require('socket.io')(server)
torrentStream = null
statePlaying = false
clientsConnected = 0
titlePlaying = ""
settings =
  subtitleLanguage: ''
  noSeeding: false
log = []
logType =
  0: 'NOTE'
  1: 'WARN'
  2: 'ERRO'

server.listen 80

store.get 'settings', (err, val) ->
  if err? or !val?
    store.set 'settings', settings, (err) ->
      saveLogEntry 0, 'No settings found! Set to standard settings.'
  else
    if val.subtitleLanguage?
      settings.subtitleLanguage = val.subtitleLanguage
    if val.noSeeding?
      settings.noSeeding = val.noSeeding

showIp = () ->
  interfaces = os.networkInterfaces()
  ip = 'pitv.local'
  if interfaces['wlan0']?
    inter = interfaces['wlan0']
    for t in inter
      if t.family is 'IPv4'
        ip = t.address
  if ip is 'pitv.local' and interfaces['eth1']?
    inter = interfaces['eth1']
    for t in inter
      if t.family is 'IPv4'
        ip = t.address
  if ip is 'pitv.local' and interfaces['en1']?
    inter = interfaces['en1']
    for t in inter
      if t.family is 'IPv4'
        ip = t.address
  if ip is 'pitv.local' and interfaces['eth0']?
    inter = interfaces['eth0']
    for t in inter
      if t.family is 'IPv4'
        ip = t.address
  if ip is 'pitv.local' and interfaces['en0']?
    inter = interfaces['en0']
    for t in inter
      if t.family is 'IPv4'
        ip = t.address
  tv.emit 'ip', ip

saveLogEntry = (type, msg) ->
  time = new Date()
  timestamp = time.getTime()
  log.push
    time: timestamp
    type: type
    msg: msg
  if type is 2
    remote.emit 'alert', msg
  console.log time.toLocaleDateString() + ' ' + time.toLocaleTimeString() + ' [' + logType[type] + '] ' + msg

convertLanguageCode = (input) ->
  switch input
    when "albanian" then "al"
    when "arabic" then "ar"
    when "bengali" then "bn"
    when "brazilian-portuguese" then "pt"
    when "bulgarian" then "bg"
    when "chinese" then "zh"
    when "croatian" then "hr"
    when "czech" then "cs"
    when "danish" then "da"
    when "dutch" then "nl"
    when "english" then "en"
    when "farsi-persian" then "fa"
    when "finnish" then "fi"
    when "french" then "fr"
    when "german" then "de"
    when "greek" then "el"
    when "hebrew" then "he"
    when "hungarian" then "hu"
    when "indonesian" then "id"
    when "italian" then "it"
    when "japanese" then "ja"
    when "korean" then "ko"
    when "lithuanian" then "lt"
    when "macedonian" then "mk"
    when "malay" then "ms"
    when "norwegian" then "no"
    when "polish" then "pl"
    when "portuguese" then "pt"
    when "romanian" then "ro"
    when "russian" then "ru"
    when "serbian" then "sr"
    when "slovenian" then "sl"
    when "spanish" then "es"
    when "swedish" then "sv"
    when "thai" then "th"
    when "turkish" then "tr"
    when"urdu" then "ur"
    when "vietnamese" then "vi"
    else null

downloadSeriesSubtitle = (query, cb) ->
  lang = subtitleLanguage()
  if !lang? or lang.length is 0
    cb
      success: false
  opensrt.searchEpisode query, (err, res) ->
    if err
      cb
        success: false
    else
      langcode = convertLanguageCode lang
      if langcode?
        subtitle = res[langcode]
        if subtitle?
          out = fs.createWriteStream __dirname + '/subtitles/subtitle.srt'
          req = request
            method: 'GET',
            uri: subtitle.url
          req.pipe out
          req.on 'error', ->
            cb
              success: false
          req.on 'end', ->
            cb
              success: true
              path: __dirname + '/subtitles/subtitle.srt'
        else
          cb
            success: false
      else
        cb
          success: false

downloadSubtitle = (imdb_id, baseurl, cb) ->
  lang = subtitleLanguage()
  if lang? and lang.length > 0
    request 'http://api.' + baseurl + '/subs/' + imdb_id, (err, res, body) ->
      if err or body is null
        saveLogEntry 2, 'Request returned odd error: ' + err.toString() + '.'
        cb
          success: false
      else
        try
          result = JSON.parse body
          if result? and result.success and result.subs?
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
                  uri: 'http://' + baseurl + bestSub.url.replace('\\','')
                req.pipe out
                req.on 'error', ->
                  saveLogEntry 2, 'Could not reach ' + baseurl + '.'
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
                      saveLogEntry 2, 'ZIP which should contain subtitles was empty!'
                      cb
                        success: false
                  catch
                    saveLogEntry 2, 'ZIP extraction threw an unexpected error!'
                    cb
                      success: false
              else
                cb
                  success: false
            else
              saveLogEntry 0, 'No subtitles in the preffered language found.'
              cb
                success: false
          else
            if result.subs? or result.subtitles > 0
              saveLogEntry 0, 'No subtitles found.'
            cb
              success: false
        catch
          saveLogEntry 2, 'Could not parse JSON!'
          cb
            success: false
  else
    saveLogEntry 1, 'Language setting empty.'
    cb
      success: false

createTempFilename = (title) ->
  name = title.toLowerCase()
  name = name.replace ' ', '_'
  path.join tempDir, 'torrentcast_' + name

clearTempFiles = ->
  fs.readdir tempDir, (err, files) ->
    unless err
      files.forEach (file) ->
        if file.substr 0, 11 is 'torrentcast'
          fs.rmdir path.join tempDir, file

subtitleLanguage = ->
  if settings.subtitleLanguage?
    settings.subtitleLanguage
  else
    ''

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
  saveLogEntry 0, 'Kiosk Browser connected.'
  showIp()

remote = io.of '/ioremote'
remote.on 'connection', (socket) ->
  clientsConnected++
  tv.emit 'main'
  socket.on 'disconnect', () ->
    clientsConnected--
    if clientsConnected is 0
      showIp()
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
  socket.on 'searchMovieTorrents', (imdbid, fn) ->
    url = 'http://yts.re/api/listimdb.json?imdb_id=' + imdbid
    request url, (err, res, body) ->
      if err
        saveLogEntry 1, 'Could not get torrents from yts.re! Trying yts.im...'
        url = 'http://yts.im/api/listimdb.json?imdb_id=' + imdbid
        request url, (err, res, body) ->
          if err
            saveLogEntry 2, 'Could not get torrents from yts.im!'
            fn
              success: false
              error: 'Could not retrieve a list of torrents!'
          else
            try
              result = JSON.parse body
              if result.MovieCount == 0
                saveLogEntry 1, 'No torrents found.'
                fn
                  success: false
                  error: 'No torrents found!'
              else
                fn
                  success: true
                  torrents: result.MovieList
            catch
              saveLogEntry 2, 'Invalid JSON retrieved!'
      else
        try
          result = JSON.parse body
          if result.MovieCount == 0
            saveLogEntry 1, 'No torrents found.'
            fn
              success: false
              error: 'No torrents found!'
          else
            fn
              success: true
              torrents: result.MovieList
        catch
          saveLogEntry 2, 'Invalid JSON retrieved!'
          url = 'http://yts.im/api/listimdb.json?imdb_id=' + imdbid
          request url, (err, res, body) ->
            if err
              saveLogEntry 2, 'Could not get torrents from yts.im!'
              fn
                success: false
                error: 'Could not retrieve a list of torrents!'
            else
              try
                result = JSON.parse body
                if result.MovieCount == 0
                  saveLogEntry 1, 'No torrents found.'
                  fn
                    success: false
                    error: 'No torrents found!'
                else
                  fn
                    success: true
                    torrents: result.MovieList
              catch
                saveLogEntry 2, 'Invalid JSON retrieved!'
  socket.on 'getMovie', (id, fn) ->
    moviedb.movieInfo
      id: id
    , (err, res) ->
      if err
        saveLogEntry 2, 'Could not retrieve the movie from The Movie DB!'
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
        saveLogEntry 2, 'Could not retrieve the serie.'
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
          saveLogEntry 2, 'Could not retrieve the serie. JSON parsing failed!'
          fn
            success: false
            error: 'Could not retrieve serie!'
  socket.on 'getPopularSeries', (page, fn) ->
    url = 'http://eztvapi.re/shows/' + page
    request url, (err, res, body) ->
      if err
        saveLogEntry 2, 'Could not retrieve series.'
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
          saveLogEntry 2, 'Could not retrieve series. JSON parsing failed!'
          fn
            success: false
            error: 'Could not retrieve series!'
  socket.on 'getPopularMovies', (page, fn) ->
    moviedb.miscPopularMovies
      page: page
    ,(err, res) ->
      if err
        saveLogEntry 2, 'Could not retrieve movies from The Movie DB!'
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
        saveLogEntry 2, 'Could not retrieve series.'
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
          saveLogEntry 2, 'Could not retrieve series. JSON parsing failed!'
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
        saveLogEntry 2, 'Could not retrieve movies from The Movie DB!'
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
          saveLogEntry 2, 'Could not parse the magnet link!'
          fn
            success: false
            error: 'Failure while parsing the magnet link!'
        else
          if torrentStream
            torrentStream.destroy()
          torrentStream = null
          clearTempFiles()

          seederSlots = 5
          if settings.noSeeding
            seederSlots = 0

          torrentStream = peerflix torrent,
            connections: 100
            path: createTempFilename data.title
            buffer: (1.5 * 1024 * 1024).toString()
            uploads: seederSlots

          torrentStream.server.on 'listening', ->
            port = torrentStream.server.address().port
            statePlaying = true
            titlePlaying = data.title
            options = {}
            options.input = 'http://127.0.0.1:' + port + '/'
            saveLogEntry 0, 'Torrent is playing on 127.0.0.1:' + port + '.'
            subtitleSetting = subtitleLanguage()
            if subtitleSetting? and subtitleSetting.length > 0 and data.movie?
              rimraf __dirname + '/subtitles', ->
                fs.mkdir __dirname + '/subtitles', 0o0777, ->
                  downloadSubtitle data.movie.imdb_id, 'yifysubtitles.com', (result) ->
                    if result.success
                      options.subtitle = result.path
                      omx.player.start options
                    else
                      downloadSubtitle data.movie.imdb_id, 'ysubs.com', (result) ->
                        if result.success
                          options.subtitle = result.path
                          omx.player.start options
                        else
                          saveLogEntry 1, 'Getting subtitles was unsuccessful!'
                          remote.emit 'alert', "No subtitles found! Playing without..."
                          omx.player.start options
            else if subtitleSetting? and subtitleSetting.length > 0 and data.episode?
              filenameReg = /.+&dn=([\w\.-]+)&tr=.+/ig
              query =
                imdbid: data.episode.imdb_id
                season: data.episode.season
                episode: data.episode.episode
              try
                match = filenameReg.exec data.magnet
                if match?
                  query.filename = match[1]
              catch
                saveLogEntry 1, 'Could not extract filename from the magnet link!'
              rimraf __dirname + '/subtitles', ->
                fs.mkdir __dirname + '/subtitles', ->
                  downloadSeriesSubtitle query, (result) ->
                    if result.success
                      options.subtitle = result.path
                      omx.player.start options
                    else
                      saveLogEntry 1, 'No subtitles found.'
                      remote.emit 'alert', "No subtitles found! Playing without..."
                      omx.player.start options
            else
              omx.player.start options
          fn
            success: true
    else
      tv.emit 'main'
      saveLogEntry 2, 'No magnet link received.'
      fn
        success: false
        error: 'No magnet link received!'
  socket.on 'getState', (fn) ->
    fn
      playing: statePlaying
      title: titlePlaying
  socket.on 'getLogs', (fn) ->
    if log?
      fn
        success: true
        logs: log
    else
      saveLogEntry 2, 'Could not get logs!'
      fn
        success: false
  socket.on 'getSettings', (fn) ->
    store.get 'settings', (err, val) ->
      if err
        saveLogEntry 2, 'Could not get settings!'
        fn
          success: false
      else
        fn
          success: true
          settings: val
  socket.on 'setSettings', (val, fn) ->
    if val.subtitleLanguage?
      settings.subtitleLanguage = val.subtitleLanguage
    if val.noSeeding?
      settings.noSeeding = val.noSeeding
    store.set 'settings', settings, (err) ->
      if err
        saveLogEntry 2, 'Could not save settings!'
        fn
          success: false
      else
        fn
          success: true
  socket.on 'shutdown', (data, fn) ->
    childProcess.exec 'poweroff', (error, stdout, stderr) ->
      saveLogEntry 0, 'Emitted power off command.'
  socket.on 'reboot', (data, fn) ->
    childProcess.exec 'reboot', (error, stdout, stderr) ->
      saveLogEntry 0, 'Emitted reboot command.'

omx.emitter.on 'stop', ->
  childProcess.exec 'xrefresh -display :0', (error, stdout, stderr) ->
    remote.emit 'stateStop'
    if error?
      saveLogEntry 1, 'X11 refresh was unsuccessful.'

omx.emitter.on 'complete', ->
  remote.emit 'statePlaying', titlePlaying

saveLogEntry 0, 'PiTV started.'
