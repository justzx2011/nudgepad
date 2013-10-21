// Shim window.console for IE.
if (!window.console)
 window.console = {log: function() {}}

// Configure expressFS
expressfs.prefix = '/nudgepad.'
expressfs.rootPath = '/nudgepad/projects/' + location.hostname + '/'
socketfs.rootPath = '/nudgepad/projects/' + location.hostname + '/'
expressfs.trash = function (filename, callback) { 
  expressfs.rename(filename, 'nudgepad/trash/' + filename, callback)
}

/**
 * The Editor. The main nudgepad namespace.
 *
 * @special Singleton
 */
var nudgepad = {}
nudgepad.isTesting = false
// In case we open multiple tabs
window.name = 'nudgepad'
var Query = ParseQueryString()
var Cookie = parseCookie(document.cookie)
nudgepad.projectPath = '/nudgepad/projects/' + location.hostname + '/'
nudgepad.status = new Space()

/**
 * Requests the data from the server and loads the editor.
 */
nudgepad.main = function () {
  
  $.get('/nudgepad.status', function (space) {
    nudgepad.status.reload(space)
    
    // We do this here because chrome is weird
    // Revert to a previously saved state
    window.addEventListener('popstate', function (event) {
      Launcher.openToolFromQueryString()
    })
    
    nudgepad.warnBeforeReload = true
    window.onbeforeunload = nudgepad.beforeUnload

    Launcher.openToolFromQueryString()
    
    $('#LoadingScreen').hide()
    
    nudgepad.askToRegister()
    nudgepad.benchmarkCreationTime()
    mixpanel.track('I opened NudgePad')
    
  })

}

nudgepad.askToRegister = function () {
  // Ask them to register the project if they haven't
  // We assume owner@projectname is the default name for now.
  // In the future we'll want to update that
  if (Cookie.email === ('owner@' + document.location.host))
    RegisterForm.open()
}

nudgepad.beforeUnload = function(e) {
  if (nudgepad.warnBeforeReload)
    return nudgepad.reloadMessage()
}

nudgepad.benchmarkCreationTime = function () {
  // Only do this once per project
  if (!Query.newProject && store.get('opens'))
    return true

  store.set('opens', 1)
  var howLongItTookToCreateThisProject = new Date().getTime() - Query.timestamp
  mixpanel.track('I created a new project', {
    'time' : howLongItTookToCreateThisProject
  })
  console.log('It took %sms to create this project', howLongItTookToCreateThisProject) 
}

nudgepad.reloadMessageOneTime = ''
nudgepad.reloadMessage = function () {
  var message
  if (message = nudgepad.reloadMessageOneTime) {
    nudgepad.reloadMessageOneTime = ''
    return message
  }
  if (Tool.openTool)
    Tool.openTool.logTime()
  return 'Are you sure you want to leave Nudgepad?'
}

nudgepad.restartCheck = function () {
  $.get('/nudgepad.started', {}, function (data) {
    if (!nudgepad.status.get('started'))
      return true
    if (data !== nudgepad.status.get('started')) {
      nudgepad.reloadMessageOneTime = 'Your project restarted. Please refresh the page.'
      location.reload()
    }
  })
}

window.onerror = function(message, url, lineNumber) {
  mixpanel.track('I got a javascript error')
  Alerts.error('Javascript Error: ' + message)
  return false
}



