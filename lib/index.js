#! /usr/bin/env node
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _blessed = require('blessed');

var blessed = _interopRequireWildcard(_blessed);

var _mobx = require('mobx');

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _child_process = require('child_process');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

if (!process.env.NOMAD_ADDR) {
  console.log('Missing NOMAD_ADDR in `env`.');
  process.exit(1);
}

var styles = {
  border: {
    type: 'line'
  },
  style: {
    selected: {
      fg: 'green'
    },
    focus: {
      selected: {
        fg: 'black',
        bg: 'green'
      }
    }
  }
};

var App = function () {
  function App() {
    var _this = this;

    _classCallCheck(this, App);

    this.screen = blessed.screen({
      smartCSR: true,
      dockBorders: false,
      fullUnicode: true,
      autoPadding: true,
      title: 'Nomad UI',
      debug: true
    });
    this.loader = blessed.box({
      border: 'line',
      height: 11,
      padding: 1,
      width: 50,
      top: 'center',
      left: 'center',
      align: 'center',
      valign: 'middle',
      tags: true,
      parent: this.screen,
      content: '{bold}{underline}NOMAD UI{/underline}{/bold}\n\n\nLoading data...\n\n\n{right}with <3 from Rafał{/right}'
    });
    this.jobs = blessed.list(_extends({
      top: '0',
      left: '0',
      bottom: '0',
      width: '25%',
      label: 'List',
      keys: true,
      mouse: true,
      parent: this.screen,
      hidden: true
    }, styles));
    this.allocs = blessed.list(_extends({
      top: 0,
      left: '25%',
      width: '25%',
      label: 'Allocs',
      content: 'Select job',
      parent: this.screen,
      keys: true,
      mouse: true,
      hidden: true
    }, styles));
    this.logs = blessed.list(_extends({
      scrollable: true,
      top: 0,
      left: '50%',
      width: '50%',
      label: 'Logs',
      mouse: true,
      keys: true,
      mouse: true,
      parent: this.screen,
      hidden: true
    }, styles));
    this.debug = blessed.box({
      bottom: 2,
      right: 2,
      width: '40%',
      height: 30,
      border: {
        type: 'line'
      },
      parent: this.screen,
      hidden: true
    });
    this.cmd = null;

    this.screen.on('keypress', function (ch, key) {
      if (key.name === 'return') {
        _this.searchValue = '';
      } else if (key.name === 'backspace') {
        _this.searchValue = _this.searchValue.substr(0, _this.searchValue.length - 1);
      } else if (ch) {
        _this.searchValue += ch;
      }
    });

    (0, _mobx.reaction)(function () {
      return _this.searchValue.length;
    }, function () {
      _this.debug.setContent(_this.searchValue);
      if (_this.searchValue.length > 0) {
        _this.screen.focused.select(_this.screen.focused.fuzzyFind(_this.searchValue));
        _this.screen.render();
      }
    });

    this.screen.key(['escape', 'C-c'], function () {
      return process.exit(0);
    });

    this.screen.key('left', function () {
      if (_this.screen.focused === _this.jobs) {
        _this.logs.focus();
      } else if (_this.screen.focused === _this.allocs) {
        _this.jobs.focus();
      } else if (_this.screen.focused === _this.logs) {
        _this.allocs.focus();
      }
      _this.searchValue = '';
      _this.screen.render();
    });

    this.screen.key('right', function () {
      if (_this.screen.focused === _this.jobs) {
        _this.allocs.focus();
      } else if (_this.screen.focused === _this.allocs) {
        _this.logs.focus();
      } else if (_this.screen.focused === _this.logs) {
        _this.jobs.focus();
      }
      _this.searchValue = '';
      _this.screen.render();
    });

    this.screen.on('');

    this.jobs.on('select', function (item) {
      _this.searchValue = '';
      _this.fetchAllocs(item);
      _this.allocs.focus();
    });

    this.allocs.on('select', function (item) {
      _this.searchValue = '';
      _this.streamLogs(item);
      _this.logs.focus();
    });

    (0, _mobx.reaction)(function () {
      return _this.data.jobs;
    }, function () {
      _this.jobs.clearItems();
      _this.jobs.setItems(_this.data.jobs.map(function (el) {
        return el.Name;
      }));
      _this.screen.render();
    }, true);

    (0, _mobx.reaction)(function () {
      return _this.data.allocs;
    }, function () {
      _this.allocs.clearItems();
      _this.allocs.setItems(_this.data.allocs.map(function (el) {
        return el.Name;
      }));
      _this.screen.render();
    }, true);

    this.init();
  }

  _createClass(App, [{
    key: 'init',
    value: function init() {
      var _this2 = this;

      this.fetchJobs().then(function () {
        _this2.loader.hide();
        _this2.jobs.show();
        _this2.allocs.show();
        _this2.logs.show();
        _this2.jobs.focus();
        _this2.screen.render();
      }, function (error) {
        console.log(error);
      });
    }
  }, {
    key: 'fetchJobs',
    value: function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var response;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return _axios2.default.get(process.env.NOMAD_ADDR + '/v1/jobs');

              case 2:
                response = _context.sent;

                this.data.jobs = response.data;

              case 4:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function fetchJobs() {
        return _ref.apply(this, arguments);
      }

      return fetchJobs;
    }()
  }, {
    key: 'fetchAllocs',
    value: function () {
      var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(item) {
        var response;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return _axios2.default.get(process.env.NOMAD_ADDR + '/v1/job/' + item.getText() + '/allocations');

              case 2:
                response = _context2.sent;

                this.data.allocs = response.data;

              case 4:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function fetchAllocs(_x) {
        return _ref2.apply(this, arguments);
      }

      return fetchAllocs;
    }()
  }, {
    key: 'streamLogs',
    value: function streamLogs(item) {
      var _this3 = this;

      if (this.cmd) {
        this.cmd.kill();
      }
      this.cmd = (0, _child_process.spawn)('nomad', ['logs', '-tail', '-f', this.data.allocs.find(function (el) {
        return el.Name === item.getText();
      }).ID]);
      this.logs.clearItems();
      this.cmd.stdout.on('data', function (data) {
        data.toString().split('\n').map(function (el) {
          return _this3.logs.pushItem(el);
        });
        _this3.screen.render();
      });
    }
  }]);

  return App;
}();

new App();