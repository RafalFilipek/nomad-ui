#! /usr/bin/env node

import * as blessed from 'blessed';
import { observable, reaction, extendObservable } from 'mobx';
import axios from 'axios';
import { spawn } from 'child_process';
import chalk from 'chalk';

if (!process.env.NOMAD_ADDR) {
  console.log('Missing NOMAD_ADDR in `env`.');
  process.exit(1);
}

const styles = {
  border: {
    type: 'line',
  },
  style: {
    selected: {
      fg: 'green',
    },
    item: {
      fg: 'white',
      focus: {
        fg: 'green',
      },
    },
  },
};

class App {
  screen = blessed.screen({
    smartCSR: true,
    dockBorders: false,
    fullUnicode: true,
    autoPadding: true,
    title: 'Nomad UI',
    debug: true,
  });

  loader = blessed.box({
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
    content:
      '{bold}{underline}NOMAD UI{/underline}{/bold}\n\n\nLoading data...\n\n\n{right}with <3 from Rafał{/right}',
  });

  jobs = blessed.list({
    top: '0',
    left: '0',
    bottom: '0',
    width: '25%',
    label: 'List',
    keys: true,
    mouse: true,
    parent: this.screen,
    hidden: true,
    ...styles,
  });

  allocs = blessed.list({
    top: 0,
    left: '25%',
    width: '25%',
    label: 'Allocs',
    content: 'Select job',
    parent: this.screen,
    keys: true,
    mouse: true,
    hidden: true,
    ...styles,
  });

  logs = blessed.list({
    scrollable: true,
    top: 0,
    left: '50%',
    bottom: 0,
    width: '50%',
    label: 'Logs',
    keys: true,
    mouse: true,
    parent: this.screen,
    hidden: true,
    ...styles,
  });

  autoscrollInfo = blessed.text({
    content: 'AutoScroll: OFF',
    top: 0,
    right: 1,
    parent: this.screen,
  });

  allocationInfo = blessed.box({
    content: 'Allocation info',
    bottom: 0,
    height: 3,
    left: '50%',
    width: '50%',
    parent: this.screen,
    border: {
      type: 'line',
    },
    hidden: true,
  });

  focusableElements = [this.jobs, this.allocs, this.logs];
  titles = ['Jobs', 'Allocations', 'Logs'];

  @observable autoscrollLogs = false;

  cmd = null;

  constructor() {
    extendObservable(this, {
      searchValue: '',
      data: {
        jobs: [],
        allocs: [],
      },
    });
    this.screen.on('keypress', (ch, key) => {
      if (key.name === 'return' || key.name === 'escape') {
        this.searchValue = '';
      } else if (key.name === 'backspace') {
        this.searchValue = this.searchValue.substr(
          0,
          this.searchValue.length - 1
        );
      } else if (key.shift && key.name === 't') {
        this.toggleAutoScroll();
      } else if (ch) {
        this.searchValue += ch;
      }
    });

    reaction(
      () => {
        return this.searchValue.length;
      },
      () => {
        if (this.searchValue.length > 0) {
          this.screen.focused.select(
            this.screen.focused.fuzzyFind(this.searchValue)
          );
        }
      }
    );

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

    reaction(
      () => this.data.jobs,
      () => {
        this.jobs.clearItems();
        this.jobs.setItems(this.data.jobs.map(el => el.Name));
      },
      true
    );

    reaction(
      () => this.data.allocs,
      () => {
        this.allocs.clearItems();
        this.allocs.setItems(this.data.allocs.map(el => el.Name));
      },
      true
    );

    this.init();
  }

  init() {
    this.fetchJobs().then(
      () => {
        this.loader.hide();
        this.jobs.show();
        this.allocs.show();
        this.logs.show();
        this.changeFocus(this.jobs);
        this.screen.render();
      },
      error => {
        console.log(error);
      }
    );
  }

  toggleAutoScroll() {
    this.autoscrollLogs = !this.autoscrollLogs;
    this.autoscrollInfo.setContent(
      'AutoScroll: ' + (this.autoscrollLogs ? 'ON' : 'OFF')
    );
    this.screen.render();
  }

  focusNext() {
    const index = this.focusableElements.indexOf(this.screen.focused);
    const element = this.focusableElements[
      (index + 1) % this.focusableElements.length
    ];
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
      return chalk.white.bgBlue(' ' + title + ' ');
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

  async fetchJobs() {
    const response = await axios.get(process.env.NOMAD_ADDR + '/v1/jobs');
    this.data.jobs = response.data;
  }

  async fetchAllocs(item) {
    const response = await axios.get(
      process.env.NOMAD_ADDR + '/v1/job/' + item.getText() + '/allocations'
    );
    this.data.allocs = response.data;
  }

  async fetchAllocStatus(id) {
    console.log(id);
    const response = await axios.get(
      process.env.NOMAD_ADDR + '/v1/allocation/' + id
    );

    const info = response.data.Job.TaskGroups;

    const content = [];

    info.forEach(group => {
      content.push(chalk.bold.underline('Group: ' + group.Name));
      group.Tasks.forEach(task => {
        content.push('Task: ' + chalk.bold(task.Name));
        content.push(
          `CPU: ${chalk.bold.inverse(
            ' ' + task.Resources.CPU + ' '
          )}\t Memory: ${chalk.bold.inverse(
            ' ' + task.Resources.MemoryMB + ' '
          )}\t Disk: ${chalk.bold.inverse(
            ' ' + task.Resources.DiskMB + ' '
          )}\t IOPS: ${chalk.bold.inverse(task.Resources.IOPS)}`
        );
      });
    });

    this.allocationInfo.height = content.length;
    this.allocationInfo.setContent(content.join('\n'));
    this.screen.render();
  }

  streamAllocationInfo(item) {
    if (this.cmd) {
      this.cmd.kill();
      clearTimeout(this.allocationInfoTimeoutId);
    }
    const id = this.data.allocs.find(el => el.Name === item.getText()).ID;
    this.cmd = spawn('nomad', ['logs', '-tail', '-f', id]);
    // @TODO: this
    // this.fetchAllocStatus(id).then(() => {
    //   this.allocationInfoTimeoutId = setTimeout(() => {
    //     this.fetchAllocStatus(id);
    //   }, 1000);
    // });
    this.logs.clearItems();
    this.cmd.stdout.on('data', data => {
      data
        .toString()
        .split('\n')
        .map(el => this.logs.pushItem(el));
      if (this.autoscrollLogs) {
        this.logs.setScrollPerc(100);
      }
    });
  }
}

new App();
