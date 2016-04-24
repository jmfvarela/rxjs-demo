var Rx = require('rx');
var cheerio = require('cheerio');
var fetch = require('node-fetch');
var fs = require('fs');
var request = require('request');


function getCheerio(url, params) {
  var promise = fetch(url, params)
        .then(response => response.text())
        .then(body => cheerio.load(body));
  return Rx.Observable.fromPromise(promise);
}

function getJson(url, params) {
  var promise = fetch(url, params)
        .then(response => response.text())
        .then(body => JSON.parse(body));
  return Rx.Observable.fromPromise(promise);
}

function download(url, filename) {
  request.head(url, function(err, res, body){
    console.log('Saving '+filename + " (" + res.headers['content-length'] + " bytes)" );
    request(url).pipe(fs.createWriteStream(filename)).on('close', function(){console.log("Saved")});
  });
}

var pageRequest = new Rx.Subject();

pageRequest
  .flatMap(url => {
    console.log("Fetching "+url);
    return getJson(url)
  })
  .flatMap(json => Rx.Observable.from(json.page.items))
  .map(item => {
    return {id: item.id, htmlURL: item.htmlUrl, longTitle: item.longTitle, description: item.description, thumbnail: item.thumbnail } 
  })
  .reduce(function (acc, x, idx, source) {
    return acc + x.htmlURL + "\n";
  }, "")
  .flatMap(urls => {
    console.log("Detecting:\n" + urls);
    console.log("Converting with piraminetlab.com...");
    return getCheerio("http://www.piraminetlab.com/enlaces.php", {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: "url_original="+encodeURIComponent(urls) }  ); 
  })
  .flatMap(page$ => {
    var urls = page$('a.enlace')
      .map(function() {
        return page$(this).attr('href');
      });
    return Rx.Observable.from(urls);
  })
  .subscribe(url => {
    console.log("Video " + url);
    var filename=url.split('/').pop();
    download(url, filename);
  });


const petParade = 'http://www.rtve.es/api/programas/97070/videos';
const babyLooneyTunes = 'http://www.rtve.es/api/programas/38373/videos';
pageRequest.onNext(petParade);
pageRequest.onNext(babyLooneyTunes);
pageRequest.onCompleted();

