var speedcoach = require('speedcoach')
speedcoach('start')

if (process.argv.length < 3) {
  console.log('Specify a domain when starting')
  process.exit()
}

if (process.argv.length < 4) {
  console.log('Specify a port when starting')
  process.exit()
}

var httpServer,
    io

var fs = require('fs'),
    express = require('express'),
    dns = require('dns'),
    https = require('https'),
    http = require('http'),
    crypto = require('crypto'),
    exec = require('child_process').exec,
    _ = require('underscore'),
    async = require('async'),
    Space = require('space'),
    Page = require('scraps'),
    socketio = require('socket.io'),
    nodemailer = require("nodemailer")

var app = express()
app.pathPrefix = '/nudgepad.'

// http://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format
//first, checks if it isn't implemented yet
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

/*** PATHS ****/

var dataPath = '/nudgepad/'
var projectsPath = dataPath + 'projects/'
var clientPath = __dirname + '/../client/'
var runningPath = dataPath + 'running/'
var portsPath = dataPath + 'ports/'

/********* CREATE MAIN NUDGE NAMESPACE SINGLETON OBJECT *********/

/**
 * Nudge is a singleton.
 */

app.domain = process.argv[2]
app.port = process.argv[3]

// Change the process title for easier debugging & monitoring
process.title = app.domain

if (!fs.existsSync(projectsPath + app.domain + '/')) {
  console.log('Project does not exist...')
  process.exit()
}

// Development always occurs on macs
app.isMac = process.env.HOME.match(/Users/)
app.development = !!app.isMac
// Set IP Address.
app.ip = process.env.IPADDRESS

require('./paths.js')(app, projectsPath, clientPath)

// Run install script in case its not installed
require('./install.js')(app)

app.Screens = new Space()

app.team = {}
app.team.cache = new Space()
app.team.get = function (email, callback) {
  if (app.team.cache.get(email))
    return callback(null, app.team.cache.get(email))
  var filename = app.paths.team + email + '.space'
  fs.readFile(filename, 'utf8', function (err, data) {
    if (err)
      console.log(err)
    if (err)
      return callback(err)
    app.team.cache.set(email, new Space(data))
    return callback(null, new Space(data))
  })
}

// Load the HTML file and add mtimes as query string so the
// maker always get the latest version of the nudgepad.js and nudgepad.css
// todo: remove this?
app.nudgepadCssVersion = fs.statSync(clientPath + 'production/nudgepad.min.css').mtime.getTime()
app.nudgepadJsVersion = fs.statSync(clientPath + 'production/nudgepad.min.js').mtime.getTime()
app.nudgepadHtmlVersion = fs.readFileSync(clientPath + 'production/nudgepad.min.html', 'utf8')
  .replace(/JSV/, app.nudgepadJsVersion)
  .replace(/CSSV/, app.nudgepadCssVersion)


// todo: remove this?
app.started = new Date().getTime()

/**
 * @param {string}
 * @return {string}
 */
app.hashString = function (string) {
  return crypto.createHash('sha256').update(string).digest("hex")
}

app.email = function (to, from, subject, message, htmlMessage, callback) {
  
  // We use the sendmail binary to send mail.
  // In the future we can add the option to use a 3rd party service or smtp service.
  var transport = nodemailer.createTransport("sendmail")
  
  /*
  var smtpTransport = nodemailer.createTransport("SMTP", {
      host: "localhost", // hostname
      port: 25
  })
  */
  var mailOptions = {
    from: from, // sender address
    to: to, // list of receivers
    subject: subject, // Subject line
    text: message // plaintext body
  //  html: "<b>Hello world ✔</b>" // html body
  }
  
  if (htmlMessage)
    mailOptions.htmlMessage = htmlMessage

  // send mail with defined transport object
  transport.sendMail(mailOptions, function(error, response){
    
    if (error)
      console.log('sendmail error: %s', error)
    
    // If not callback return true
    if (!callback)
      return true
    
    if (error)
      return callback(error)
    else
      return callback(null)
    // if you don't want to use this transport object anymore, uncomment following line
    //smtpTransport.close() // shut down the connection pool, no more messages
  })
  
  
}

require('./checkId.js')(app)

//********************** INITIALIZE THE SERVER OBJECT ******************************


if (app.development)
  console.log('Development mode started...')
else
  console.log('Production mode started...')

app.use(express.bodyParser())
app.use(express.cookieParser())
app.use(express.compress())
// server.use(express.staticCache())

// http://www.dmuth.org/node/1401/logging-non-proxy-ip-addresses-heroku-and-express-nodejs
//
// Create an IP token for the logging system that lists the original IP, 
// if there was a proxy involved.
//
express.logger.token("ip", function(request) {
 
   var retval = "";
 
   if (request["headers"] && request["headers"]["x-forwarded-for"]) {
      //
      // Proxied request
      //
      retval = request["headers"]["x-forwarded-for"];
 
   } else if (request["socket"] && request["socket"]["remoteAddress"]) {
      //
      // Direct request
      //
      retval = request["socket"]["remoteAddress"];
 
   } else if (request["socket"] && request["socket"]["socket"]
      && request["socket"]["socket"]["remoteAddress"]) {
      //
      // God only knows what happened here...
      //
      retval = request["socket"]["socket"]["remoteAddress"];
 
   }
 
   return(retval);
 
});

var logFile = fs.createWriteStream(app.paths.requestsLog, {flags: 'a'})
app.use(express.logger({
  stream : logFile,
  format : ':ip :url :method :status :response-time :res[content-length] ":date" :remote-addr ":referrer" ":user-agent"'
}))



/*********** STATIC FILES **************/
app.use('/nudgepad/', express.static(clientPath.replace(/\/$/,''), { maxAge: 31557600000 }))

require('./login.js')(app)
// Do this after /nudgepad/, so the login scripts get through fine.
app.use('/', app.privateCheck)

app.use('/', express.static(app.paths.project, { maxAge: 31557600000 }))

/********** email *************/
app.post(app.pathPrefix + 'email', app.checkId, function (req, res, next) {

  var to = req.body.to
  var subject = req.body.subject
  var message = req.body.message
  var from = 'nudgepad@' + app.domain
  
  app.email(to, from, subject, message, null, function (error) {
    if (error)
      res.send(error, 500)
    else
      res.send('Sent')
  })  

})


/********** invite *************/
require('./invite.js')(app)

/*********** nudgepad ***********/
app.get(/^\/nudgepad$/, app.checkId, function(req, res, next) {

  // If production, send html that pulls minified NudgePad
  if (!app.development) {
    res.send(app.nudgepadHtmlVersion)
    return
  }
  
  // If development, send html that pulls verbose NudgePad
  fs.readFile(clientPath + 'production/nudgepad.dev.html', 'utf8', function (err, data) {
    res.send(data)
    return 
  })

})

require('./backup.js')(app)
require('./upload.js')(app)

app.post(/nudgepad\.expressfs.*/, app.checkId, function (req, res, next) {
  next()
})

require('./expressfs.server.js')(app, {prefix : '/nudgepad.'})
require('./restart.js')(app)
// We use this to communicate with proxy.js so it knows what
// domain this process serves
app.get(app.pathPrefix + 'domain', function(req, res, next) {
  res.set('Content-Type', 'text/plain')
  return res.send(app.domain)
})

require('./status.js')(app, speedcoach)
require('./whoami.js')(app)
// We use this so we can tell if the server has been
// restarted since the clients session started
app.get(app.pathPrefix + 'started', app.checkId, function (req, res, next) {
  res.set('Content-Type', 'text/plain')
  return res.send(app.started + '')
})

require('./console.js')(app)
fs.watch(app.paths.project, function (event, filename) {
  
  // Trigger public changed event
  // mac on old node wont emit filename
  if (!filename)
    filename = ''
  app.SocketIO.sockets.emit('file', filename.toString())
  
})

require('./export.js')(app)
require('./persona.js')(app)
require('./forgotPassword.js')(app)
require('./updateEmail.js')(app)
require('./logout.js')(app)
require('./logs.js')(app)
require('./stats.js')(app)
require('./proxy.js')(app)
require('./import.js')(app)


/*********** Eval any custom packages or code that depends on userland (so eventually redirects, etc) ***********/
var loadPackages = function () {
  if (!fs.existsSync(app.paths.packages))
    return false
  try {

    var files = fs.readdirSync(app.paths.packages)
    for (var j in files) {
      var file = files[j]
      if (!file.match(/\.js$/))
        continue
      console.log('Including %s%s', app.paths.packages, file)
      require(app.paths.packages + file)(app)
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.log('Syntax error in ' + files[j] + ': ' + e.message)
      console.log('Includes skipped')
    } else {
      console.log('Error in ' + files[j] + ': ' + e.message)
    }
  }
}
loadPackages()

try {
  require('./redirects.js')(app)
} catch (e) {
  if (e instanceof SyntaxError) {
    console.log('Syntax error in ' + files[j] + ': ' + e.message)
    console.log('Includes skipped')
  } else {
    console.log('Error in ' + files[j] + ': ' + e.message)
  }
}

/*********** ! ***********/
app.use('/', function (req, res, next) {

  if (fs.exists(app.paths.project + 'notFound.html'))
    return res.sendfile(app.paths.project + 'notFound.html', 404)
  
  return res.send('Not found', 404)
})

/********* START SERVER **********/ 

// Start Listening
console.log('Starting %s on port %s', app.domain, app.port)
httpServer = http.createServer(app).listen(app.port)


fs.writeFileSync(runningPath + app.domain, app.port, 'utf8')
fs.chmodSync(runningPath + app.domain, '600')
fs.writeFileSync(portsPath + app.port, app.domain, 'utf8')
fs.chmodSync(portsPath + app.port, '600')

// Write session stats to disk before process closes
process.on('SIGTERM', function () {
  fs.unlinkSync(runningPath + app.domain)
  fs.unlinkSync(portsPath + app.port)
  process.exit(0)
})

app.SocketIO = socketio.listen(httpServer)
app.SocketIO.set('log level', 0)
require('./socket.js')(app)
require('./socketfs.server.js')(app)

console.log('Server started...')
speedcoach('end of app.js')
