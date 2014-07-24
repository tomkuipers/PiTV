var height = isNaN(window.innerHeight) ? window.clientHeight : window.innerHeight;
var width = isNaN(window.innerWidth) ? window.clientWidth : window.innerWidth;

var movies = [];
var movie = {};
var movieTorrents = [];

var series = [];
var serie = {};

var season = {};

var episodes = [];
var episode = {};
var episodeTorrents = [];

var seriesPage = 0;
var moviesPage = 0;

var seriesSearchPage = 0;
var moviesSearchPage = 0;

var searchSeriesString = "";
var searchMoviesString = "";

var moviesSearch = [];
var seriesSearch = [];

$(window).scroll(function() {
  if ($(window).scrollTop() >= $(document).height() - $(window).height()) {
    if ($('#loadingRemote').css('display') === 'none' || $('#loadingRemote').css('display') === 'hidden') {
      loadMore();
    }
  }
});

$('#searchMovies input').keypress(function(e) {
  if (e.which == 13) {
    $('#searchMovies').submit();
    return false;
  }
});

$('#searchSeries input').keypress(function(e) {
  if (e.which == 13) {
    $('#searchSeries').submit();
    return false;
  }
});

$('#searchSeries').submit(function(e) {
  e.preventDefault();
  if ($('#loadingRemote').css('display') === 'none' || $('#loadingRemote').css('display') === 'hidden') {
    searchSeriesString = $('#searchSeries input').val();
    $('#seriesList').html('');
    if (searchSeriesString === "") {
      for(var i = 0; i < series.length; i++) {
        if (series[i].backdrop_path != null) {
          $('#seriesList').append('<li>' +
            '<div class="card" onclick="openSeries(' + series[i].id.toString() + ')" style="background-image:url(\'http://image.tmdb.org/t/p/w500' + series[i].backdrop_path + '\')">' +
            '<span>' + series[i].name + '</span>' +
            '</div></li>');
        }
      }
    } else {
      seriesSearchPage = 0;
      seriesSearch = [];
      $('#loadingRemote').show();
      socket.emit('searchSeries', {
        query: searchSeriesString,
        page: (seriesSearchPage + 1)
      }, function(result) {
        $('#loadingRemote').hide();
        if (result.success) {
          seriesSearchPage = 1;
          seriesSearch = result.series;
          for(var i = 0; i < searchSeries.length; i++) {
            if (seriesSearch[i].backdrop_path != null) {
              $('#seriesList').append('<li>' +
                '<div class="card" onclick="openSeries(' + seriesSearch[i].id.toString() + ')" style="background-image:url(\'http://image.tmdb.org/t/p/w500' + seriesSearch[i].backdrop_path + '\')">' +
                '<span>' + seriesSearch[i].name + '</span>' +
                '</div></li>');
            }
          }
        }
      });
    }
  }
});

$('#searchMovies').submit(function (e) {
  e.preventDefault();
  if ($('#loadingRemote').css('display') === 'none' || $('#loadingRemote').css('display') === 'hidden') {
    searchMoviesString = $('#searchMovies input').val();
    $('#moviesList').html('');
    if (searchMoviesString === "") {
      for(var i = 0; i < movies.length; i++) {
        if (movies[i].backdrop_path != null) {
          $('#moviesList').append('<li>' +
            '<div class="card" onclick="openSeries(' + movies[i].id.toString() + ')" style="background-image:url(\'http://image.tmdb.org/t/p/w500' + movies[i].backdrop_path + '\')">' +
            '<span>' + movies[i].original_title + '</span>' +
            '</div></li>');
        }
      }
    } else {
      moviesSearchPage = 0;
      moviesSearch = [];
      $('#loadingRemote').show();
      socket.emit('searchMovies', {
        query: searchMoviesString,
        page: (moviesSearchPage + 1)
      }, function(result) {
        $('#loadingRemote').hide();
        if (result.success) {
          moviesSearchPage = 1;
          moviesSearch = result.movies;
          for(var i = 0; i < searchMovies.length; i++) {
            if (moviesSearch[i].backdrop_path != null) {
              $('#moviesList').append('<li>' +
                '<div class="card" onclick="openMovies(' + moviesSearch[i].id.toString() + ')" style="background-image:url(\'http://image.tmdb.org/t/p/w500' + moviesSearch[i].backdrop_path + '\')">' +
                '<span>' + moviesSearch[i].original_title + '</span>' +
                '</div></li>');
            }
          }
        }
      });
    }
  }
});

function loadMore() {
  var hash = window.location.hash.split('/');
  if (hash[1] === 'movies' && hash.length == 2) {
    if (searchMoviesString === "") {
      $('#loadingRemote').show();
      socket.emit('getPopularMovies', (moviesPage + 1), function(result) {
        $('#loadingRemote').hide();
        if (result.success) {
          moviesPage++;
          for(var i = 0; i < result.movies.length; i++) {
            movies.push(result.movies[i]);
            if (result.movies[i].backdrop_path != null) {
              $('#moviesList').append('<li>' +
                '<div class="card" onclick="openMovies(' + result.movies[i].id.toString() + ')" style="background-image:url(\'http://image.tmdb.org/t/p/w500' + result.movies[i].backdrop_path + '\')">' +
                '<span>' + result.movies[i].original_title + '</span>' +
                '</div></li>');
            }
          }
        }
      });
    } else {
      $('#loadingRemote').show();
      socket.emit('searchMovies', {
        query: searchMoviesString,
        page: (moviesSearchPage + 1)
      }, function(result) {
        $('#loadingRemote').hide();
        if (result.success) {
          moviesSearchPage++;
          for(var i = 0; i < result.movies.length; i++) {
            moviesSearch.push(result.movies[i]);
            if (result.movies[i].backdrop_path != null) {
              $('#moviesList').append('<li>' +
                '<div class="card" onclick="openMovies(' + result.movies[i].id.toString() + ')" style="background-image:url(\'http://image.tmdb.org/t/p/w500' + result.movies[i].backdrop_path + '\')">' +
                '<span>' + result.movies[i].original_title + '</span>' +
                '</div></li>');
            }
          }
        }
      });
    }
  } else if (hash[1] === 'series' && hash.length == 2) {
    if (searchSeriesString === "") {
      $('#loadingRemote').show();
      socket.emit('getPopularSeries', (seriesPage + 1), function(result) {
        $('#loadingRemote').hide();
        if (result.success) {
          seriesPage++;
          for(var i = 0; i < result.series.length; i++) {
            series.push(result.series[i]);
            if (result.series[i].backdrop_path != null) {
              $('#seriesList').append('<li>' +
                '<div class="card" onclick="openSeries(' + result.series[i].id.toString() + ')" style="background-image:url(\'http://image.tmdb.org/t/p/w500' + result.series[i].backdrop_path + '\')">' +
                '<span>' + result.series[i].name + '</span>' +
                '</div></li>');
            }
          }
        }
      });
    } else {
      $('#loadingRemote').show();
      socket.emit('searchSeries', {
        query: searchSeriesString,
        page: (seriesSearchPage + 1)
      }, function(result) {
        $('#loadingRemote').hide();
        if (result.success) {
          seriesSearchPage++;
          for(var i = 0; i < result.series.length; i++) {
            seriesSearch.push(result.series[i]);
            if (result.series[i].backdrop_path != null) {
              $('#seriesList').append('<li>' +
                '<div class="card" onclick="openSeries(' + result.series[i].id.toString() + ')" style="background-image:url(\'http://image.tmdb.org/t/p/w500' + result.series[i].backdrop_path + '\')">' +
                '<span>' + result.series[i].name + '</span>' +
                '</div></li>');
            }
          }
        }
      });
    }
  }
}

function toggleNavigation() {
  $('#navigation').toggle();
}

function stop() {
  socket.emit('stopMedia');
  $('#media-title').html('');
}

function play() {
  socket.emit('pauseplayMedia');
}

function forward() {
  socket.emit('forwardMedia');
}

function backward() {
  socket.emit('backwardMedia');
}

function openMovies(id) {
  window.location.hash = '#/movies/' + id;
}

function openSeries(id) {
  window.location.hash = '#/series/' + id;
}

function openSeason(serieId, seasonNumber) {
  window.location.hash = '#/series/' + serieId + '/' + seasonNumber;
}

function openEpisode(serieId, seasonNumber, episodeNumber) {
  window.location.hash = '#/series/' + serieId + '/' + seasonNumber + '/' + episodeNumber;
}

function playMovieTorrent(i) {
  var magnet = movieTorrents[i].TorrentMagnetUrl;
  socket.emit('playTorrent', magnet, function(result) {
    if (result.success) {
      $('#media-title').html(movie.original_title);
    }
  });
}

function playEpisodeTorrent(serieName, seasonNumber, episodeNumber, magnet) {
  socket.emit('playTorrent', magnet, function(result) {
    if (result.success) {
      $('#media-title').html(serieName + ' S' + seasonNumber + ' E' + episodeNumber);
    }
  });
}

riot.route(function(hash) {
  hash = hash.split('/');
  $('article').hide();
  $('form').hide();
  $('#loadingRemote').hide();

  if (hash[1] !== 'movies') {
    moviesSearchPage = "";
  }

  if (hash[1] !== 'series') {
    seriesSearchPage = "";
  }

  if (hash[1] === 'movies') {
    if (hash.length == 2) {
      $('#searchMovies').show();
    }
    if (hash[2] != null) {
      var id = parseInt(hash[2]);
      $('#loadingRemote').show();
      socket.emit('getMovie', id, function(result) {
        movie = result.movie;
        if (result.success) {
          $('#movieTitle').html(movie.original_title);
          $('#movieDescription').html(movie.overview);
          $('#moviePoster').attr('src', 'http://image.tmdb.org/t/p/w780' + movie.backdrop_path);
          $('#movieStatus').html('');
          $('#movieStatus').append('<i class="stamp">' + movie.runtime + ' min' + '</i>');
          for (var i = 0; i < movie.genres.length; i++) {
            $('#movieStatus').append('<i class="stamp">' + movie.genres[i].name + '</i>');
          }
          $('#moviePlayButtons').html('');
          $('#movie').show();
          $('#loadingRemote').hide();
          socket.emit('searchMovieTorrents', movie.imdb_id, function(result) {
            movieTorrents = result.torrents;
            if (result.success) {
              for(var i = 0; i < movieTorrents.length; i++) {
                var torrent = movieTorrents[i];
                $('#moviePlayButtons').append('<a href="javascript:playMovieTorrent(' + i + ')">Play in ' + torrent.Quality + '</a>');
              }
            }
          });
        }
      });
    } else {
      if (movies.length > 0) {
        $('#movies').show();
      } else {
        $('#moviesList').html('');
        $('#movies').show();
        $('#loadingRemote').show();
        moviesPage = 0;
        socket.emit('getPopularMovies', (moviesPage + 1), function(result) {
          $('#loadingRemote').hide();
          if (result.success) {
            moviesPage = 1;
            movies = result.movies;
            $('#movies').show();
            for(var i = 0; i < movies.length; i++) {
              if (movies[i].backdrop_path != null) {
                $('#moviesList').append('<li>' +
                  '<div class="card" onclick="openMovies(' + movies[i].id.toString() + ')" style="background-image:url(\'http://image.tmdb.org/t/p/w500' + movies[i].backdrop_path + '\')">' +
                  '<span>' + movies[i].original_title + '</span>' +
                  '</div></li>');
              }
            }
          }
        });
      }
    }
  } else if (hash[1] === 'series') {
    if (hash.length == 2) {
      $('#searchSeries').show();
    }
    if (hash[2] != null) {
      if (hash[3] != null) {
        if (hash[4] != null) {
          var serieId = parseInt(hash[2]);
          var seasonNumber = parseInt(hash[3]);
          var episodeNumber = parseInt(hash[4]);
          $('#loadingRemote').show();
          socket.emit('getEpisode', {
            id: serieId,
            seasonNumber: seasonNumber,
            episodeNumber: episodeNumber,
          }, function(result) {
            episode = result.episode;
            if (result.success) {
              if (serie == null || serie.id !== serieId) {
                socket.emit('getSerie', serieId, function(result) {
                  serie = result.serie;
                  if (result.success) {
                    $('#episodeTitle').html(episode.name);
                    $('#episodeDescription').html(episode.overview);
                    $('#episodePoster').attr('src', 'http://image.tmdb.org/t/p/w780' + episode.still_path);
                    $('#episodeCode').html('S' + seasonNumber + ' E' + episodeNumber);
                    $('#episodePlayButtons').html('');
                    $('#episode').show();
                    $('#loadingRemote').hide();
                    socket.emit('searchEpisodeTorrents', serie.name + ' S' + ('0' + seasonNumber).slice(-2) + 'E' + ('0' + episodeNumber).slice(-2), function(result) {
                      episodeTorrents = result.torrents;
                      console.log(episodeTorrents);
                      if (result.success) {
                        if (episodeTorrents.length > 0) {
                          highestSeedersNumber = 0;
                          highestSeeders = null;
                          for(var i = 0; i < episodeTorrents.length; i++) {
                            var seeders = parseInt(episodeTorrents[i].seeders);
                            if (seeders > highestSeedersNumber) {
                              highestSeeders = episodeTorrents[i];
                              highestSeedersNumber = seeders;
                            }
                          }
                          $('#episodePlayButtons').append('<a href="javascript:playEpisodeTorrent(\''+ serie.name +'\', \''+ seasonNumber + '\', \''+ episodeNumber +'\',\'' + highestSeeders.magnetLink + '\')">Play Episode (' + highestSeedersNumber + ')</a>');
                        }
                      }
                    });
                  }
                });
              } else {
                $('#episodeTitle').html(episode.name);
                $('#episodeDescription').html(episode.overview);
                $('#episodePoster').attr('src', 'http://image.tmdb.org/t/p/w780' + episode.still_path);
                $('#episodeCode').html('S' + seasonNumber + ' E' + episodeNumber);
                $('#episodePlayButtons').html('');
                $('#episode').show();
                $('#loadingRemote').hide();
                socket.emit('searchEpisodeTorrents', serie.name + ' S' + ('0' + seasonNumber).slice(-2) + 'E' + ('0' + episodeNumber).slice(-2), function(result) {
                  episodeTorrents = result.torrents;
                  console.log(episodeTorrents);
                  if (result.success) {
                    if (episodeTorrents.length > 0) {
                      highestSeedersNumber = 0;
                      highestSeeders = null;
                      for(var i = 0; i < episodeTorrents.length; i++) {
                        var seeders = parseInt(episodeTorrents[i].seeders);
                        if (seeders > highestSeedersNumber) {
                          highestSeeders = episodeTorrents[i];
                          highestSeedersNumber = seeders;
                        }
                      }
                      $('#episodePlayButtons').append('<a href="javascript:playEpisodeTorrent(\''+ serie.name +'\', \''+ seasonNumber + '\', \''+ episodeNumber +'\',\'' + highestSeeders.magnetLink + '\')">Play Episode (' + highestSeedersNumber + ')</a>');
                    }
                  }
                });
              }
            }
          });
        } else {
          episodes = [];
          episode = {};
          episodeTorrents = [];
          var serieId = parseInt(hash[2]);
          var seasonNumber = parseInt(hash[3]);
          $('#loadingRemote').show();
          if (serie == null || serie.id !== serieId) {
            socket.emit('getSerie', serieId, function(result) {
              serie = result.serie;
              if (result.success) {
                socket.emit('getSeason', {
                  id: serieId,
                  seasonNumber: seasonNumber
                }, function(result) {
                  if (result.success) {
                    episodes = result.episodes;
                    $('#episodesList').html('');
                    for (var i = 0; i < episodes.length; i++) {
                      $('#episodesList').append('<li>' +
                        '<div class="card" onclick="openEpisode(' + serieId + ',' + seasonNumber + ',' + episodes[i].episode_number + ')">' +
                        '<span>' + episodes[i].name + '<br><small>' + episodes[i].episode_number + '</small></span>' +
                        '</div></li>');
                    }
                    $('#season').show();
                    $('#loadingRemote').hide();
                  }
                });
              }
            });
          } else {
            season = serie.seasons[seasonNumber];
            socket.emit('getSeason', {
              id: serieId,
              seasonNumber: seasonNumber
            }, function(result) {
              if (result.success) {
                episodes = result.episodes;
                $('#episodesList').html('');
                for (var i = 0; i < episodes.length; i++) {
                  $('#episodesList').append('<li>' +
                    '<div class="card" onclick="openEpisode(' + serieId + ',' + seasonNumber + ',' + episodes[i].episode_number + ')">' +
                    '<span>' + episodes[i].name + '</span>' +
                    '</div></li>');
                }
                $('#season').show();
                $('#loadingRemote').hide();
              }
            });
          }
        }
      } else {
        season = {};
        episodes = [];
        episode = {};
        episodeTorrents = [];
        var id = parseInt(hash[2]);
        $('#loadingRemote').show();
        socket.emit('getSerie', id, function(result) {
          serie = result.serie;
          if (result.success) {
            $('#serieTitle').html(serie.name);
            $('#serieDescription').html(serie.overview);
            $('#seriePoster').attr('src', 'http://image.tmdb.org/t/p/w780' + serie.backdrop_path);
            $('#serieStatus').html('');
            $('#serieStatus').append('<i class="stamp">' + serie.status + '</i>');
            for (var i = 0; i < serie.genres.length; i++) {
              $('#serieStatus').append('<i class="stamp">' + serie.genres[i].name + '</i>');
            }
            $('#serieSeasonButtons').html('');
            $('#serie').show();
            $('#loadingRemote').hide();
            for(var i = 1; i < serie.seasons.length; i++) {
              $('#serieSeasonButtons').append('<a href="javascript:openSeason(' + id + ',' + serie.seasons[i].season_number + ')">Season ' + serie.seasons[i].season_number + '</a>');
            }
          }
        });
      }
    } else {
      serie = {};
      season = {};
      episodes = [];
      episode = {};
      episodeTorrents = [];
      if (series.length > 0) {
        $('#series').show();
      } else {
        $('#seriesList').html('');
        $('#series').show();
        $('#loadingRemote').show();
        seriesPage = 0;
        socket.emit('getPopularSeries', (seriesPage + 1), function(result) {
          $('#loadingRemote').hide();
          if (result.success) {
            seriesPage = 1;
            series = result.series;
            $('#series').show();
            for(var i = 0; i < series.length; i++) {
              if (series[i].backdrop_path != null) {
                $('#seriesList').append('<li>' +
                  '<div class="card" onclick="openSeries(' + series[i].id.toString() + ')" style="background-image:url(\'http://image.tmdb.org/t/p/w500' + series[i].backdrop_path + '\')">' +
                  '<span>' + series[i].name + '</span>' +
                  '</div></li>');
              }
            }
          }
        });
      }
    }
  } else if (hash[1] === 'youtube') {

  } else if (hash[1] === 'gaming') {

  } else if (hash[1] === 'homecontrol') {

  } else {
    $('#start').show();
  }
  $('#navigation').hide();
});

var socket = io('/ioremote');
