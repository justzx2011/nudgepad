var Pages = new Tool('Pages')

Pages.editor = {}

Pages.editor.filename = 'index.html'

Pages.editor.pages = new Space()

Pages.refresh = function () {
  $('.openPage').remove()
  Pages.editor.pages.sort(function (a,b) {
    return b < a
  })
  Pages.editor.pages.each(function (filename, value) {
    $('#PagesFileMenu').append('<li><a class="cursor openPage" onclick="Pages.editor.open(\'' + filename + '\')">' + filename + '</a></li>')
  })
}

Pages.editor.create = function () {
  var filename = prompt('Enter a name for the file', 'index.html')
  if (!filename)
    return true
  expressfs.writeFile(filename, '')
  Pages.editor.pages.set(filename, new Scraps.Page(''))
  Pages.editor.open(filename)
  Pages.refresh()
}

Pages.editor.duplicate = function () {
  var filename = prompt('Enter a name for the file', Pages.editor.filename)
  if (!filename)
    return true
  var page = Pages.editor.openPage()
  expressfs.writeFile(filename, page.toHtml({wrap : true}))
  Pages.editor.pages.set(filename, new Scraps.Page(page.toString()))
  Pages.editor.open(filename)
  Pages.refresh()
  
}

Pages.editor.loadFiles = function () {
  Pages.editor.pages = new Space()
  expressfs.downloadDirectory('', 'html', function (data) {
    var files = new Space(data)
    files.each(function (filename, value) {
      Pages.editor.pages.set(filename, new Scraps.Page($.htmlToScraps(value)))
      if (filename === Pages.editor.filename)
        Pages.editor.open(Pages.editor.filename)
      Pages.refresh()
    })
  })
}

Pages.on('ready', function () {
  Pages.editor.open(Pages.editor.filename)
  Pages.refresh()
})

Pages.on('open', Pages.editor.loadFiles)

Pages.editor.editHtml = function () {
  var htmlString = html_beautify(Pages.editor.openPage().toHtml({wrap:true}), {
    'indent-size' : 2,
    'indent-char' : ' ',
    'indent-inner-html' : true
  })
  TextPrompt.open('', htmlString, Pages.editor.filename, function (data) {
    Pages.editor.pages.set(Pages.editor.filename, new Scraps.Page($.htmlToScraps(data)))
    Pages.editor.open(Pages.editor.filename)
  })
}

Pages.editor.editScraps = function () {
  TextPrompt.open('', Pages.editor.openPage().toString(), Pages.editor.filename.replace('html', 'space'), function (data) {
    Pages.editor.pages.set(Pages.editor.filename, new Scraps.Page(data))
    Pages.editor.open(Pages.editor.filename)
  })
}

Pages.editor.open = function (filename) {
  Pages.editor.filename = filename
  if (!Pages.editor.pages.get(Pages.editor.filename))
    return true
  $('#PagesFilename').html(filename)
  Pages.editor.render()
  /*
  socketfs.watch(filename, function (data) {
    Pages.editor.pages.set(filename, new Scraps.Page($.htmlToScraps(data.content)))
    Pages.editor.render()
  })
  */
}

Pages.editor.openPage = function () {
  return Pages.editor.pages.get(Pages.editor.filename)
}

Pages.editor.publish = function () {
  var htmlString = html_beautify(Pages.editor.openPage().toHtml({wrap: true}), {
    'indent-size' : 2,
    'indent-char' : ' ',
    'indent-inner-html' : true
  })
  expressfs.writeFileAndOpen(Pages.editor.filename, htmlString)
}

Pages.editor.render = function () {
  var page = new Scraps.Page(Pages.editor.openPage())
  var html = page.toHtml({wrap: true, filter : function () {
    // dont render scripts
    if (this.div.tag === 'script')
      this.div.draft = true
    this.div.attr('data-index', this.index)
    this.div.addClass('PagesScrap')
  }})
  var body = $('#PagesStage').contents().find('body')
  body.html(html)
  body.on('click', '*', function (event) {
    
    if ($(this).is('a'))
      event.preventDefault()

    // only select leafs
    if ($(this).find('.PagesScrap').length)
      return true
    if (!$(this).hasClass('PagesScrap'))
      return true
    var text = $(this).text()
    if (!text.length)
      return true
    $(this).attr('contenteditable', true)
    $(this).focus()
    $(this).on('blur', function () {
      $(this).removeAttr('contenteditable')
      var content = $(this).html()
      var index = $(this).attr('data-index')
      Pages.editor.pages.get(Pages.editor.filename).getByIndexPath(index).set('content', content)
    })
  })
  //   var options = {}
  // $( "#PagesStage" ).droppable(options)
}
