#! /usr/bin/env node
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _blessed = require('blessed');

var blessed = _interopRequireWildcard(_blessed);

var _mobx = require('mobx');

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _child_process = require('child_process');

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

if (!process.env.NOMAD_ADDR) {
  console.log('Missing NOMAD_ADDR in `env`.');
  process.exit(1);
}

const styles = {
  border: {
    type: 'line'
  },
  style: {
    selected: {
      fg: 'green'
    },
    item: {
      fg: 'white',
      focus: {
        fg: 'green'
      }
    }
  }
};

let App = class App {

  constructor() {
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
      bottom: 0,
      width: '50%',
      label: 'Logs',
      keys: true,
      mouse: true,
      parent: this.screen,
      hidden: true
    }, styles));
    this.autoscrollInfo = blessed.text({
      content: 'AutoScroll: OFF',
      top: 0,
      right: 1,
      parent: this.screen
    });
    this.allocationInfo = blessed.box({
      content: 'Allocation info',
      bottom: 0,
      height: 3,
      left: '50%',
      width: '50%',
      parent: this.screen,
      border: {
        type: 'line'
      },
      hidden: true
    });
    this.focusableElements = [this.jobs, this.allocs, this.logs];
    this.titles = ['Jobs', 'Allocations', 'Logs'];
    this.cmd = null;

    (0, _mobx.extendObservable)(this, {
      searchValue: '',
      data: {
        jobs: [],
        allocs: []
      }
    });
    this.screen.on('keypress', (ch, key) => {
      if (key.name === 'return' || key.name === 'escape') {
        this.searchValue = '';
      } else if (key.name === 'backspace') {
        this.searchValue = this.searchValue.substr(0, this.searchValue.length - 1);
      } else if (key.shift && key.name === 't') {
        this.toggleAutoScroll();
      } else if (ch) {
        this.searchValue += ch;
      }
    });

    (0, _mobx.reaction)(() => {
      return this.searchValue.length;
    }, () => {
      if (this.searchValue.length > 0) {
        this.screen.focused.select(this.screen.focused.fuzzyFind(this.searchValue));
      }
    });

    this.screen.key(['C-c'], () => {
      return process.exit(0);
    });

    this.screen.key('left', () => {
      this.focusPrev();
    });

    this.screen.key('right', () => {
      this.focusNext();
      this.jobs.select;
    });

    this.jobs.on('select', item => {
      this.fetchAllocs(item).then(() => this.changeFocus(this.allocs));
    });

    this.allocs.on('select', item => {
      this.streamAllocationInfo(item);
      this.changeFocus(this.logs);
    });

    (0, _mobx.reaction)(() => this.data.jobs, () => {
      this.jobs.clearItems();
      this.jobs.setItems(this.data.jobs.map(el => el.Name));
    }, true);

    (0, _mobx.reaction)(() => this.data.allocs, () => {
      this.allocs.clearItems();
      this.allocs.setItems(this.data.allocs.map(el => el.Name));
    }, true);

    this.init();
  }

  init() {
    this.fetchJobs().then(() => {
      this.loader.hide();
      this.jobs.show();
      this.allocs.show();
      this.logs.show();
      this.changeFocus(this.jobs);
      this.screen.render();
    }, error => {
      console.log(error);
    });
  }

  toggleAutoScroll() {
    this.autoscrollLogs = !this.autoscrollLogs;
    this.autoscrollInfo.setContent('AutoScroll: ' + (this.autoscrollLogs ? 'ON' : 'OFF'));
    this.screen.render();
  }

  focusNext() {
    const index = this.focusableElements.indexOf(this.screen.focused);
    const element = this.focusableElements[(index + 1) % this.focusableElements.length];
    this.changeFocus(element);
    this.screen.fo;
  }

  focusPrev() {
    const index = this.focusableElements.indexOf(this.screen.focused) - 1;
    const element = this.focusableElements[index === -1 ? 2 : index];
    this.changeFocus(element);
  }

  getElementTitle(element, active) {
    const title = this.titles[this.focusableElements.indexOf(element)];
    if (active) {
      return _chalk2.default.white.bgBlue(' ' + title + ' ');
    }
    return title;
  }

  changeFocus(element) {
    this.screen.focused.setLabel(this.getElementTitle(element, false));
    const newElement = element;
    element.focus();
    newElement.setLabel(this.getElementTitle(newElement, true));
    this.searchValue = '';
    this.screen.render();
    this.jobs.set;
  }

  fetchJobs() {
    var _this = this;

    return _asyncToGenerator(function* () {
      const response = yield _axios2.default.get(process.env.NOMAD_ADDR + '/v1/jobs');
      _this.data.jobs = response.data;
    })();
  }

  fetchAllocs(item) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      const response = yield _axios2.default.get(process.env.NOMAD_ADDR + '/v1/job/' + item.getText() + '/allocations');
      _this2.data.allocs = response.data;
    })();
  }

  fetchAllocStatus(id) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      console.log(id);
      const response = yield _axios2.default.get(process.env.NOMAD_ADDR + '/v1/allocation/' + id);

      const info = response.data.Job.TaskGroups;

      const content = [];

      info.forEach(function (group) {
        content.push(_chalk2.default.bold.underline('Group: ' + group.Name));
        group.Tasks.forEach(function (task) {
          content.push('Task: ' + _chalk2.default.bold(task.Name));
          content.push(`CPU: ${_chalk2.default.bold.inverse(' ' + task.Resources.CPU + ' ')}\t Memory: ${_chalk2.default.bold.inverse(' ' + task.Resources.MemoryMB + ' ')}\t Disk: ${_chalk2.default.bold.inverse(' ' + task.Resources.DiskMB + ' ')}\t IOPS: ${_chalk2.default.bold.inverse(task.Resources.IOPS)}`);
        });
      });

      _this3.allocationInfo.height = content.length;
      _this3.allocationInfo.setContent(content.join('\n'));
      _this3.screen.render();
    })();
  }

  streamAllocationInfo(item) {
    if (this.cmd) {
      this.cmd.kill();
      clearTimeout(this.allocationInfoTimeoutId);
    }
    const id = this.data.allocs.find(el => el.Name === item.getText()).ID;
    this.cmd = (0, _child_process.spawn)('nomad', ['logs', '-tail', '-f', id]);
    // @TODO: this
    // this.fetchAllocStatus(id).then(() => {
    //   this.allocationInfoTimeoutId = setTimeout(() => {
    //     this.fetchAllocStatus(id);
    //   }, 1000);
    // });
    this.logs.clearItems();
    this.cmd.stdout.on('data', data => {
      data.toString().split('\n').map(el => this.logs.pushItem(el));
      if (this.autoscrollLogs) {
        this.logs.setScrollPerc(100);
      }
    });
  }
};


new App();