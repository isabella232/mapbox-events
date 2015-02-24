var xhr = require('xhr');
var clone = require('lodash-compat').cloneDeep;
var hat = require('hat');

var shims = require('./lib/shims.js')();

module.exports = Events;

function Events(options) {
    if (!(this instanceof Events)) return new Events(options);
    this.queue = [];
    this.flushAt = Math.max(options.flushAt, 1) || 20;
    this.flushAfter = Math.max(options.flushAfter, 0) || 10000;
    this.api = options.api || 'https://api.tiles.mapbox.com';
    this.token = options.token;
    this._xhr = xhr;
    this._xdr = (window && !('withCredentials' in new window.XMLHttpRequest())) ? XDomainRequest : null;
    this.instance = hat();
    this.anonid = anonid();
}

Events.prototype.push = function(obj) {
    obj = clone(obj);
    obj.version = 1;
    obj.created = (new Date()).toISOString();
    obj.instance = this.instance;
    obj.anonid = this.anonid;
    this.queue.push(obj);
    if (this.queue.length >= this.flushAt) this.flush();
    if (this.timer) clearTimeout(this.timer);
    if (this.flushAfter) this.timer = setTimeout(this.flush.bind(this), this.flushAfter);
};

Events.prototype.flush = function() {
    if (!this.queue.length) return;
    if (this._xdr) this._compatabilityPost(this.queue.splice(0, this.flushAt));
    else this._post(this.queue.splice(0, this.flushAt));
};

Events.prototype._post = function(events, callback) {
    callback = callback || function() {};

    this._xhr({
        method: 'POST',
        body: JSON.stringify(events),
        uri: this.api + '/events/v1?access_token=' + this.token,
        headers: {
            // Avoid CORS pre-flight OPTIONS request by smuggling
            // application/json in as text/plain.
            'Content-Type': 'text/plain'
        }
    }, callback);
};

// Use XDomainRequest to support CORS in IE 8/9.
// Will send 'text/plain' but without a content-type header.
Events.prototype._compatabilityPost = function(events, callback) {
    // XDomainRequest doesn't support cross-protocol requests
    var protocol = this.api.match(/^(https?:)?/);
    if (document && document.location.protocol != protocol[0]) return callback();

    callback = callback || function() {};

    xdr = new this._xdr();
    var url = this.api + '/events/v1?access_token=' + this.token;

    xdr.onload = function() { callback(xdr) };
    xdr.onerror = function() {};
    xdr.onprogress = function() {};

    xdr.open('post', url);
    xdr.send(JSON.stringify(events));
};

function anonid() {
    try {
        'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
        return null;
    }

    var id = window.localStorage.getItem('anonid') || hat();
    window.localStorage.setItem('anonid', id);
    return id;
}
