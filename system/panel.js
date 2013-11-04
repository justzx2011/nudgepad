/**
 * Creates new projects.
 */
var express = require('express'),
    exec = require('child_process').exec,
    fs = require('fs')

if (process.argv.length <3) {
  console.log('Enter a hostname to start panel on')
  process.exit(1)
}

var hostname = process.argv[2]

var dataPath = '/nudgepad/'
var panelPath = __dirname + '/panel/'
var logsPath = dataPath + 'logs/'
var projectsPath = dataPath + 'projects/'
var runningPath = dataPath + 'running/'
var portsPath = dataPath + 'ports/'
var tempPath = dataPath + 'temp/'
var systemPath = __dirname
var port = process.argv[3] || 4004
var panelRedirect = null
if (process.argv.length > 4)
  panelRedirect = process.argv[4]

var Domain = require(panelPath + '/Domain')
Domain.tld = '.' + hostname

process.title = 'nudgepadPanel'

var app = express()
app.use(express.bodyParser())

var logFile = fs.createWriteStream(logsPath + 'panelRequests.txt', {flags: 'a'})
app.use(express.logger({
  stream : logFile
}))

// If the serfer has no UI, launch panel with default NudgePad UI
if (!panelRedirect)
  app.use('/', express.static(panelPath, { maxAge: 31557600000 }))

// Else, redirect GET requests to the white labelled UI.
else {
  app.get('/', function (req, res) {
    res.redirect(panelRedirect)
  })
}

// http://stackoverflow.com/questions/46155/validate-email-address-in-javascript
function validateEmail(email) { 
  var re = /\S+@\S+\.\S+/
  return re.test(email)
}

// Generate a domain if one is not provided
app.generateDomain = function (req, res, next) {
  if (req.body.domain)
    return next()
  
  var max = 9999999
  var min = 1000000
  
  var random = Math.floor(Math.random() * (max - min + 1)) + min
  req.body.domain = 'project' + random.toString() + Domain.tld
  console.log('generated domain: %s', req.body.domain)
  return next()
}

app.validateDomain = function (req, res, next) {

  // Warning message if trying to access panel via IP and not hostname
  if (req.headers.host && req.headers.host.match('127.0.0.1'))
    return res.send('Try going to <a href="http://' + hostname + ':' + port + '/">http://' + hostname + ':' + port + '</a> instead of ' + req.headers.host, 400)
  
  var error = Domain.validate(req.body.domain, req.body.relaxed)
  
  if (error) {
    res.set('Content-Type', 'text/plain')
    return res.send(error, 400)
  }
  
  next()
}

app.isDomainAvailable = function (req, res, next) {
  
  var domain = req.body.domain
  fs.exists(projectsPath + domain, function (exists) {
    if (!exists)
      return next()
//    res.set('Content-Type', 'text/plain')
    var errorPage = req.body.errorPage || ''
    res.redirect(errorPage + '?taken=true')
//    res.send('Domain already exists. Try another.', 400)
  })
}

app.validateEmail = function (req, res, next) {
  
  var email = req.body.email
  
  if (!email) {
    res.set('Content-Type', 'text/plain')
    return res.send('No email entered', 400)
  }
  
  if (!validateEmail(email)) {
    res.set('Content-Type', 'text/plain')
    return res.send('Invalid email', 400)
  }
  next()
}

app.checkId = function (req, res, next) {
  next()
}

app.post('/isDomainAvailable', function (req, res) {
  var domain = req.body.domain
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
  fs.exists(projectsPath + domain, function (exists) {
    if (!exists)
      return res.send('yes')
    return res.send('no')
  })
})

// Create a project
// On success, message is the login link 
app.post('/create', app.checkId, app.generateDomain, app.validateDomain, app.isDomainAvailable, function(req, res, next){
  
  var domain = req.body.domain
  var email = req.body.email
  // Allow someone to pass a raw space file to create from
  var clone = req.body.clone
  // allow someone to create from a dir already on server. fastest method
  var dir = req.body.dir
  // A sharecode to verify you have permission to create this project
  var sharecode = req.body.sharecode
  
  // Allow someone to redirect them to a tool
  var tool = req.body.tool
  // todo: Allow someone to create from a zip file
  var zip = req.body.zip
  // todo: Allow someone to create from a git repo
  var git = req.body.git
  // todo: allow someont to create from a url
  var url = req.body.url
  
  var timestamp = req.body.timestamp || new Date().getTime()
  var requestTime = new Date().getTime()
  
  if (!email)
    email = 'owner@' + domain
  
  if (tool)
    tool = '&tool=' + tool
  
  else
    tool = ''
  
  
  // Save clone to file before calling command line
  // Todo: cleanup
  if (clone) {
    console.log('creating project from clone: %s', domain)
    var clonePath = tempPath + domain + '.space'
    fs.writeFile(clonePath, clone, 'utf8', function (err) {
      
      exec('sudo ' + systemPath + '/nudgepad.sh create ' + domain.toLowerCase() + ' ' + email + ' ' + clonePath, function (err, stdout, stderr) {
        if (err) {
          console.log('Error creating project %s: err:%s stderr:%s', domain, err, stderr)
          return res.send('Error creating project: ' + err, 400)
        }
        console.log(stderr)
        console.log('time to create %s: %sms', domain, new Date().getTime() - requestTime)
        if (req.body.ajax)
          res.send(stdout)
        else
          res.redirect(stdout + '&newProject=true&timestamp=' + timestamp + tool)
      })
      
    })
  } else {
    
    
    if (dir) {
      dir = ' ' + dir
      console.log('creating project %s from dir %s', domain, dir)
    }
    else {
      dir = ''
      console.log('creating project %s from blank', domain)
    }
    if (sharecode)
      sharecode = ' ' + sharecode
    else
      sharecode = ''
    exec('sudo ' + systemPath + '/nudgepad.sh create ' + domain.toLowerCase() + ' ' + email + dir + sharecode, function (err, stdout, stderr) {
      if (err) {
        console.log('Error creating project %s: err:%s stderr:%s', domain, err, stderr)
        return res.send('Error creating project: ' + err, 400)
      }
      console.log(stderr)
      console.log('time to create %s: %sms', domain, new Date().getTime() - requestTime)
      if (req.body.ajax)
        res.send(stdout)
      else
        res.redirect(stdout + '&newProject=true&timestamp=' + timestamp + tool)
    })
  }
  
  
})

app.listen(port)
fs.writeFileSync(runningPath + hostname, port, 'utf8')
fs.writeFileSync(portsPath + port, hostname, 'utf8')

// Write session stats to disk before process closes
process.on('SIGTERM', function () {
  fs.unlinkSync(runningPath + hostname)
  fs.unlinkSync(portsPath + port)
  process.exit(0)
})

