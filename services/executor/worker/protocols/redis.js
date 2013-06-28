"use strict";

var JobQueue = require('redis-jobq');
var logger = require('jsx').createLogger(module);
var protocol = Object.create(require('./base.js'));
var jqOptions;
var isNew = true;
var doneCb;
var processJob;
var isDone = true;

logger.debug('redis protocol');
protocol.validate = function(cb) {
  if (protocol.jobs) return cb(true);
  else {
    var jq = new JobQueue(jqOptions, function(err){
      if (err) {
        cb(false, err);
      } else {
        protocol.jobs = jq;
        cb(true);
      }
    });
  }
};

protocol.connect = function(cb) {
  if (!protocol.jobs) {
    protocol.jobs = new JobQueue(jqOptions, cb);
  } else {
    process.nextTick(cb);
  }
};

protocol.disconnect = function() {
  protocol.jobs.quit();
  delete protocol.jobs;
  isNew = true;
};

protocol.accept = function(cb) {
  processJob = cb;
  if (isNew) {
    protocol.jobs.process(function(err, job, done) {
      if (!err && job) {
        doneCb = done;
        isDone = false;
        processJob(job);
      }
    });
    isNew = false;
  } else {
    if (isDone) process.nextTick(doneCb);
    else throw new Error('Cannot accept new job, the current one has not been done.');
  }
};

protocol.done = function(job, cb) {
  protocol.jobs.save(job, function() {
    protocol.jobs.finish(job, function(){
      isDone = true;
      process.nextTick(cb);
    });
  });
};

module.exports = function(options) {
  jqOptions = options.manager;
  return protocol;
};

