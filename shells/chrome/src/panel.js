/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */
'use strict';

/* global chrome */

var checkForReact = require('./checkForReact');
var inject = require('./inject');

import type {Props} from '../../../frontend/Panel';

// chrome.devtools.panels added in Chrome 18.
// chrome.devtools.panels.themeName added in Chrome 54.
const themeName = (chrome.devtools.panels : any).themeName === 'dark'
  ? 'ChromeDark'
  : 'ChromeDefault';

var config: Props = {
  reload,
  themeName,
  checkForReact,
  alreadyFoundReact: false,
  reloadSubscribe(reloadFn) {
    chrome.devtools.network.onNavigated.addListener(reloadFn);
    return () => {
      chrome.devtools.network.onNavigated.removeListener(reloadFn);
    };
  },
  getNewSelection(bridge) {
    chrome.devtools.inspectedWindow.eval('window.__REACT_DEVTOOLS_GLOBAL_HOOK__.$0 = $0');
    bridge.send('checkSelection');
  },
  selectElement(id, bridge) {
    bridge.send('putSelectedNode', id);
    setTimeout(() => {
      chrome.devtools.inspectedWindow.eval('inspect(window.__REACT_DEVTOOLS_GLOBAL_HOOK__.$node)');
    }, 100);
  },
  showComponentSource(globalPathToInst, globalPathToType) {
    var code = `
      if (
        window.${globalPathToType} &&
        window.${globalPathToType}.prototype &&
        window.${globalPathToType}.prototype.isReactComponent
      ) {
        inspect(window.${globalPathToInst}.render);
      } else {
        inspect(window.${globalPathToType});
      }
    `;
    chrome.devtools.inspectedWindow.eval(code, (res, err) => {
      if (err) {
        console.error('Failed to inspect component', err);
      }
    });
  },
  showAttrSource(path) {
    var attrs = '[' + path.map(m => JSON.stringify(m)).join('][') + ']';
    var code = 'inspect(window.$r' + attrs + ')';
    chrome.devtools.inspectedWindow.eval(code, (res, err) => {
      if (err) {
        console.error('Failed to inspect source', err);
      }
    });
  },
  executeFn(path) {
    var attrs = '[' + path.map(m => JSON.stringify(m)).join('][') + ']';
    var code = 'window.$r' + attrs + '()';
    chrome.devtools.inspectedWindow.eval(code, (res, err) => {
      if (err) {
        console.error('Failed to call function', err);
      }
    });
  },
  inject(done) {
    inject(chrome.runtime.getURL('build/backend.js'), () => {
      var port = chrome.runtime.connect({
        name: '' + chrome.devtools.inspectedWindow.tabId,
      });
      var disconnected = false;

      var wall = {
        listen(fn) {
          port.onMessage.addListener(message => fn(message));
        },
        send(data) {
          if (disconnected) {
            return;
          }
          port.postMessage(data);
        },
      };

      port.onDisconnect.addListener(() => {
        disconnected = true;
      });
      done(wall, () => port.disconnect());
    });
  },
};

var Panel = require('../../../frontend/Panel');
var React = require('react');
var ReactDOM = require('react-dom');

var node = document.getElementById('container');

function reload() {
  setTimeout(() => {
    ReactDOM.unmountComponentAtNode(node);
    node.innerHTML = '';
    ReactDOM.render(<Panel {...config} />, node);
  }, 100);
}

ReactDOM.render(<Panel alreadyFoundReact={true} {...config} />, node);
