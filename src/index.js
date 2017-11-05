#! /usr/bin/env node

import * as blessed from 'blessed';
import { observable, reaction } from 'mobx';
import axios from 'axios';
import { spawn } from 'child_process';

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
    focus: {
      selected: {
        fg: 'black',
        bg: 'green',
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
    width: '50%',
    label: 'Logs',
    mouse: true,
    keys: true,
    mouse: true,
    parent: this.screen,
    hidden: true,
    ...styles,
  });

  debug = blessed.box({
    bottom: 2,
    right: 2,
    width: '40%',
    height: 30,
    border: {
      type: 'line',
    },
    parent: this.screen,
    hidden: true,
  });

  @observable
  data = {
    jobs: [],
    allocs: [],
  };

  cmd = null;

  @observable searchValue = '';

  constructor() {
    this.screen.on('keypress', (ch, key) => {
      if (key.name === 'return') {
        this.searchValue = '';
      } else if (key.name === 'backspace') {
        this.searchValue = this.searchValue.substr(
          0,
          this.searchValue.length - 1
        );
      } else if (ch) {
        this.searchValue += ch;
      }
    });

    reaction(
      () => this.searchValue.length,
      () => {
        this.debug.setContent(this.searchValue);
        if (this.searchValue.length > 0) {
          this.screen.focused.select(
            this.screen.focused.fuzzyFind(this.searchValue)
          );
          this.screen.render();
        }
      }
    );

    this.screen.key(['escape', 'C-c'], () => {
      return process.exit(0);
    });

    this.screen.key('left', () => {
      if (this.screen.focused === this.jobs) {
        this.logs.focus();
      } else if (this.screen.focused === this.allocs) {
        this.jobs.focus();
      } else if (this.screen.focused === this.logs) {
        this.allocs.focus();
      }
      this.searchValue = '';
      this.screen.render();
    });

    this.screen.key('right', () => {
      if (this.screen.focused === this.jobs) {
        this.allocs.focus();
      } else if (this.screen.focused === this.allocs) {
        this.logs.focus();
      } else if (this.screen.focused === this.logs) {
        this.jobs.focus();
      }
      this.searchValue = '';
      this.screen.render();
    });

    this.screen.on('');

    this.jobs.on('select', item => {
      this.searchValue = '';
      this.fetchAllocs(item);
      this.allocs.focus();
    });

    this.allocs.on('select', item => {
      this.searchValue = '';
      this.streamLogs(item);
      this.logs.focus();
    });

    reaction(
      () => this.data.jobs,
      () => {
        this.jobs.clearItems();
        this.jobs.setItems(this.data.jobs.map(el => el.Name));
        this.screen.render();
      },
      true
    );

    reaction(
      () => this.data.allocs,
      () => {
        this.allocs.clearItems();
        this.allocs.setItems(this.data.allocs.map(el => el.Name));
        this.screen.render();
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
        this.jobs.focus();
        this.screen.render();
      },
      error => {
        console.log(error);
      }
    );
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

  streamLogs(item) {
    if (this.cmd) {
      this.cmd.kill();
    }
    this.cmd = spawn('nomad', [
      'logs',
      '-tail',
      '-f',
      this.data.allocs.find(el => el.Name === item.getText()).ID,
    ]);
    this.logs.clearItems();
    this.cmd.stdout.on('data', data => {
      data
        .toString()
        .split('\n')
        .map(el => this.logs.pushItem(el));
      this.screen.render();
    });
  }
}

new App();
