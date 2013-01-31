/*!
 * Semaphore CLI-wrapper web service Worker node.
 * The worker node process the job collected and queued by the manager node.
 * All communications with the manager node are performed using HTTP RESTful API.
 */

var path = require('path');
var fs = require('fs');
var request = require('request');
var fsx = require('jsx').fsx;
var logger = require('jsx').Logger(module);
var conf = require('./conf');
var Manager = require('./methods/'+conf.transportMethod);
var manager = new Manager();

var uid;
var workingDir, workingDirPre, workingDirPost, jobPath;
var job, executor;
var shutdownRequested = false;

var PROGRESS = {
  1: {fn:fetchInputs, message: 'fetching inputs'}, //job received
  2: {fn:setupPostDir, message: 'preparing environment'}, //input files received in `pre` dir
  3: {fn:execute, message: 'running external commands'}, //files from `pre` copied to `post` dir
  4: {fn:storeOutputs, message: 'storing outputs'}, //commands finished, output files are available
  5: {fn:cleanup, message: 'finished'} //temp working dir deleted
};

logger.debug("worker pid:"+process.pid);

function shutdown() {
  logger.debug('Worker' + uid + ': shutdown()');
  shutdownRequested = true;
  manager.disconnect();
}

process.on('disconnect', function() { logger.debug('Worker' + uid + ': disconnect'); shutdown(); });
process.on('SIGTERM', function() { logger.debug('Worker' + uid + ': SIGTERM'); shutdown(); });
process.on('SIGINT', function() { logger.debug('Worker' + uid + ': SIGINT'); shutdown(); });
process.on('uncaughtException', function(err) { logger.error(err); });

process.on('message', function(msg) {
  logger.debug("worker starting: uid="+msg);
  uid = msg;
  //Start processing after receiving uid
  process.nextTick(start);
});


// Retrieve a previous interrupted job or request a new one from the job queue
function start() {
  workingDir = path.join(conf.tempWorkingDir, ''+uid);
  workingDirPre = path.join(workingDir, 'pre');
  workingDirPost = path.join(workingDir, 'post');
  jobPath = path.join(workingDir,'job.json');

  // Check temp working dir
  if (fs.existsSync(workingDir)) {
    logger.debug('start(): '+workingDir + ' exists');
    // Retrieve interrupted job, read from json
    if (fs.existsSync(jobPath)) {
      job = fsx.sync.readJson(jobPath);
    } else {
      //job corrupted, ignore and continue
      logger.error('start(): job.json file does not exist.');
      fsx.sync.remove(workingDir);
    }
  }
  manager.connect();
  if (job) {
    executor = conf.executors[job.type];
    if (job.runStatus) PROGRESS[job.runStatus.code].fn();
  } else {
    // Signal that the worker is ready to accept new job from the manager
    manager.accept(startNewJob);
  }
}

function updateJobStatus(statusCode, nextStepCb) {
  logger.debug('job progress status updated: ' + statusCode);
  job.runStatus = {code: statusCode, message: PROGRESS[statusCode].message};
  fsx.async.writeJson(jobPath, job, function(err) {
    if (err) {
      logger.fatal('Error saving job info as JSON.');
      process.exit;
    } else {
      process.nextTick(nextStepCb);
    }
  });
}

function startNewJob(newJob){
  logger.debug('Creating working dir: ' + workingDir);
  // Create temp working dir based on the uid
  fs.mkdirSync(workingDir);
  logger.debug('startNewJob()');
  job = newJob;
  executor = conf.executors[job.type];
  updateJobStatus(1, function() {
    manager.confirm(job.id, fetchInputs);
  });
}

// Download the supplied remote input files to the working dir
function fetchInputs() {
  logger.debug('STEP 1 - fetchInputs()');
  // Use fresh directory
  fsx.sync.createDir(workingDirPre);
  
  // Download to workingDirPre
  var count = 0;
  for (var fname in job.data.inputFiles) {
    ++count;
    var ws = fs.createWriteStream(path.join(workingDirPre, fname));
    ws.once('close', downloadComplete);
    logger.debug('requesting file: ' + fname + ' - ' + job.data.inputFiles[fname]);
    request(job.data.inputFiles[fname]).pipe(ws);
  }
  function downloadComplete() { 
    --count;
    logger.debug('Download completed. count=' + count);
    if (count == 0) updateJobStatus(2, setupPostDir);
  }

  if (count === 0)  updateJobStatus(2, setupPostDir);
}

function setupPostDir() {
  logger.debug('STEP 2 - setupPostDir()');

  // Use fresh directory
  fsx.sync.createDir(workingDirPost);
  
  var params = {inputDir: executor.defaultInputPath, preDir:workingDirPre, postDir:workingDirPost};
  conf.copyExecutor.run(params, function(err, stdout, stderr){
    if (err) {
      logger.error('Error in setting up post temp dir.');
      logger.error(err);
      updateJobStatus(5, cleanup);
    } else {
      updateJobStatus(3, execute);
    }
  });
  //var cpe = exec('copy ', options, cb1);
  /*
  // Copy (link) files from default inputs and pre dir
  fu.forEachFileInDir(workingDirPre, function(file) {
    //change this for linux
    //fs.symlinkSync(file.fullpath, path.join(workingDirPost, file.name));
    fs.copyFileSync(file.fullpath, path.join(workingDirPost, file.name));
  });
  var defInputPath  = conf.jobTypes.daycent.paths.defaultInput;
  fu.forEachFileInDir(model.paths.defaultInput, function(file) {
    //change this for linux
    //fs.symlinkSync(file.fullpath, path.join(workingDirPost, file.name));
    fs.copyFileSync(file.fullpath, path.join(workingDirPost, file.name));
  });
   */
}

function execute() {
  logger.debug('STEP 3 - execute()');
  var params = {
    workDir: workingDirPost, 
    data: job.data
    //prevOutputName
  };
  executor.run(params, function(err, stdout, stderr){
    if (err) {
      logger.error('Error in executing external commands.');
      updateJobStatus(5, cleanup);
    } else {
      updateJobStatus(4, storeOutputs);
    }
  });
}

function storeOutputs() {
  logger.debug('STEP 4 - storeOutputs()');
  // Compare with pre and default input dirs
  var inputFiles = fs.readdirSync(workingDirPre);
  fsx.sync.forEachFile(executor.defaultInputPath, function(f) {
    if (inputFiles.indexOf(f.name) < 0) inputFiles.push(f.name);
  });
  var count = 0;
  var files = {};
  function uploadFile(f) {
    // upload/save/store output file to external storage
    logger.debug('Uploading output file: ' + f.path);
    var url = conf.manager.url.upload + '/'+job.id+'/'+f.name;
    var urldl = conf.downloadBaseUrl + '/' + job.id + '/' + f.name;
    var headers = {"content-length": f.stat.size};
    logger.debug(url);
    var rs = fs.createReadStream(f.path);
    rs.pipe(request.put({url:url, headers: headers}, uploadComplete));
    function uploadComplete(error, response, body) {
      if (!error && response.statusCode == 200) {
        logger.debug('Upload completed: ' + f.path);
        files[f.name] = urldl;
        --count;
        if (count === 0) {
          job.data.outputFiles = files;
          // Notify manager that job is done
          logger.debug('All uploads completed, report back to manager.');
          updateJobStatus(5, function() {
            manager.done(job, cleanup);
          });
        }
      } else {
        //TODO: robust upload
        logger.error('Upload failed: ' + f.path);
        // Upload failed, try again later
        setTimeout(function(){ uploadFile(f); }, conf.repeatInterval);
      }
    }
  }
  fsx.sync.forEachFile(workingDirPost, function(f){
    if (inputFiles.indexOf(f.name) < 0) {
      ++count;
      uploadFile(f);
    }
  });
}

function cleanup() {
  logger.debug('STEP 5 - start cleanup()');
  //remove working dir
  fsx.async.remove(workingDir, function(err) {
    logger.debug('cleanup() finished');
    logger.debug('worker is idle');
    // Ready to accept another job
    if (!shutdownRequested) manager.accept(startNewJob);
  });
}
