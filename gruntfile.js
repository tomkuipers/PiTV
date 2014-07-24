module.exports = function (grunt) {
  grunt.initConfig({
    uglify: {
      options: {
        compress: true
      },
      target: {
        files: {
          'static/js/tv.js': [ 'src/jQuery.js', 'src/riot.js', 'src/tv.js' ],
          'static/js/remote.js': [ 'src/jQuery.js', 'src/riot.js', 'src/remote.js' ]
        }
      }
    },
    sass: {
      dist: {
        options: {
          style: 'compressed'
        },
        files: [{
          expand: true,
          cwd: 'sass',
          src: ['*.scss'],
          dest: 'static/css',
          ext: '.css'
        }]
      }
    },
    watch: {
      uglify: {
        files: ['src/*.js'],
        tasks: ['uglify'],
        options: {
          spawn: false,
        },
      },
      sass: {
        files: ['sass/*.scss'],
        tasks: ['sass'],
        options: {
          spawn: false,
        },
      },
      coffee: {
        files: ['*.coffee'],
        tasks: ['coffee:compile'],
        options: {
          spawn: false,
        },
      }
    },
    coffee: {
      compile: {
        expand: true,
        flatten: true,
        cwd: '.',
        src: ['*.coffee'],
        dest: '.',
        ext: '.js'
      }
    },
    coffeelint: {
      tests: {
        files: {
          src: ['*.coffee']
        },
        options: {
          'no_trailing_whitespace': {
            'level': 'error'
          }
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-coffee');
  grunt.loadNpmTasks('grunt-coffeelint');

  grunt.registerTask('build', [ 'uglify', 'sass', 'coffee:compile' ]);
  grunt.registerTask('compile', ['coffee:compile']);
  grunt.registerTask('test', ['coffeelint:tests']);
};
