/* jshint esversion: 6, node: true */

// TODO: Document (and implement) channel APIs letting ping messages through
// (without any impact on connections). This will let us implement a
// `discoverProtocol` method.

'use strict';

const {NettyClientBridge, NettyServerBridge} = require('./netty');
const {channelService} = require('../call');
const {SystemError} = require('../types');

const {EventEmitter} = require('events');

/**
 * Router between channels for multiple distinct services.
 *
 * Calls are routed using services' qualified name, so they must be distinct
 * across the routed channels.
 */
class Router extends EventEmitter {
  constructor(chans) {
    super();
    this._channels = new Map();

    // Delay processing such that event listeners can be added first.
    process.nextTick(() => {
      chans.forEach((chan) => {
        channelService(chan, (err, svc) => {
          if (err) {
            this.emit('error', err);
            return;
          }
          if (this._channels.has(svc.name)) {
            this.emit('error', new Error(`duplicate service: ${svc.name}`));
            return;
          }
          this._channels.set(svc.name, chan);
          if (this._channels.size === chans.length) {
            this.emit('ready', this.channel);
          }
        });
      });
    });
  }

  get channel() {
    return (preq, cb) => {
      const name = preq.clientService.name;
      const chan = this._channels.get(name);
      if (!chan) {
        const cause = new Error(`no such service: ${name}`);
        cause.serviceName = name;
        cb(new SystemError('ERR_AVRO_SERVICE_NOT_FOUND', cause));
        return;
      }
      chan(preq, cb);
    };
  }
}

module.exports = {
  NettyClientBridge,
  NettyServerBridge,
  Router,
};
