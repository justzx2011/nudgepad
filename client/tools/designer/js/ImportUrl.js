Designer.importUrl = function (url, callback) {
  $.post('/nudgepad.proxy', { url : url}, function (data) {
    var name = url.replace(/^https?\:\/\//, '')
    var space = $.htmlToScraps(data)
    space = Designer.relativeToAbsolute(space.toString(), url)
    Designer.menu.create(name, space.toString())
    Alerts.success('Imported ' + url)
    if (callback)
      callback()
  })
}

Designer.importUrlPrompt = function () {
  
  var url = prompt('Enter a url to import', 'http://')
  if (!url)
    return false
  
  if (!url.match(/^https?\:\/\//))
    url = 'http://' + url
  Designer.importUrl(url)
  
}
