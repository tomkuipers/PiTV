var socket = io('/iotv');
$('#main').show();
socket.on('main', function() {
  $('section').hide();
  $('#main').show();
});
socket.on('loading', function() {
  $('section').hide();
  $('#loading').show();
});
socket.on('black', function() {
  $('section').hide();
  $('#black').show();
});
socket.on('ip', function(ip) {
  $('section').hide();
  $('#ipText').html('Go to ' + ip);
  $('#ip').show();
});
