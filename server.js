/*
 * General modules
 */

var express = require('express');
var app = express();

/* -------------------------------------------------------
 * TIMESTAMP MICROSERVICE
 * -------------------------------------------------------*/

var url = require("url");
var moment = require("moment");

app.get('/timestamp-microservice/*', function (req, res) {
	
	//Extract parameters from URL
	var date = req.params[0];
	var month = date.split(' ')[0];
	
	//If the query is not empty 
	if (date.length) {
		
		res.writeHead(200, {'content-type':'application/JSON'});
		
		//Check if the date format is valid in strict mode to match either one of the 
		// specified formats
		var isValid = moment(date, ['MMM DD, YYYY', 'MMM DD YYYY', 'MMMM DD, YYYY', 'MMMM DD YYYY'], true).isValid(); 

		// If the format is valid and the month is a valid string or a number, in which case is unix format
		if (isValid == true || !isNaN(month)){
			
			// If the date is a string, split by the space character
			// and join them with a space, then calculate the date in UNIX
			if (isNaN(date.split(' ')[0]) == true) {
				
				var naturalTime = date;
				
				//Get the unix time and convert it to seconds
				var unixTime = (new Date(naturalTime).getTime())/1000;
				
			// Else, if its a number, a unix format,
			// convert the unix time to the right format
			} else {
				
				var unixTime = date;
				var naturalTime = moment.unix(unixTime).format("MMMM DD, YYYY");
			}
		  
		//Else, if the format is not valid 
		} else {
			
			var naturalTime = null;
			var unixTime = null;
			
		}
		
		//Create the JSON object, and then send it back to the client
		var JSONres = {
			"unix" : unixTime,
			"natural" : naturalTime
		}
		
		res.end(JSON.stringify(JSONres));
		
	//Else, if the input is empty (there is no query)
	} else {
		res.sendFile(__dirname + '/index/timestamp-microservice-index.html');
	}
   
});

/* -------------------------------------------------------
 * REQUEST HEADER PARSER
 * -------------------------------------------------------*/
 
 app.get('/request-header-parser/', function (req, res) {
	
	res.writeHead(200, {'content-type':'application/JSON'});
	
	var ipAddress = req.headers["x-forwarded-for"];
	var language = req.headers["accept-language"].split(',')[0];
	var userAgent = req.headers["user-agent"];
	
	//Only match the first sequence in parenthesis
	// Regular expression credit to http://stackoverflow.com/questions/17779744/regular-expression-to-get-a-string-between-parentheses-in-javascript
	var regExp = /\(([^)]+)\)/;
	var software = regExp.exec(userAgent)[1];

	var dataJSON = {
		"ipAddress": ipAddress,
		"Language": language,
		"Software": software
	}
	
	res.end(JSON.stringify(dataJSON));
	
});

/* -------------------------------------------------------
 * URL SHORTENER
 * -------------------------------------------------------*/
var urlValidator = require("url-validator");
var shortId = require("shortid");
var mongo = require("mongodb").MongoClient;

//Use an environment variable for mLab database URI
var dataURL = process.env.MONGOLAB_URI;

//Handle when user first arrives at the site
app.get('/url-shortener/', function (req, res) {
  res.sendFile(__dirname + '/index/url-shortener-index.html');
})

//Handle requests
app.get('/url-shortener/new/*', function(req, res){
	
	res.writeHead(200, {"content-type":"application/JSON"});
	
	var urlInput = req.params[0]; 
   
	//Check if the url is valid
	if (urlValidator(urlInput)) {
		
		//   Try to access the database and get the URL the user gave as input
		mongo.connect(dataURL, function(err, db) {
			
			if (err) throw err; 
	   
			var urlsCollection = db.collection('urls');
		   
			// Search for a long url the user gave as input
			urlsCollection.find({
			   
			  'long-url': { $eq: urlInput}
			   
			}).toArray(function(err, documents){
			   
				if (err) throw err;
				
				var id = shortId.generate();
				
				//If it found a match, close the database
				// extract the data from the first document found and return it as a JSON
				if (documents.length != 0) {
					
					// console.log('ALREADY IN DATABASE');
					
					db.close();
					
					var data = {
						"long-url": documents[0]["long-url"],
						"short-url": 'https://url-shortener-est.herokuapp.com/' + documents[0]["short-url"]
					}
					
					res.end(JSON.stringify(data));
					
				//Else, create a new document to store the shortened version url
				} else {
					
					//Create a document with the user's input and a shortened version of the url
					urlsCollection.insert({
						
					  "long-url": urlInput,
					  "short-url": id.toString()
						
					}, function(err, doc) {
						
						if (err) throw err;
						
						//Send the data just added to the client, close the database
						//and update the counter
						var data = {
							
							"long-url": urlInput,
							"short-url": 'https://url-shortener-est.herokuapp.com/' + id.toString() 
						
						}
						
						db.close();
						res.end(JSON.stringify(data));
						
					});
				}
			});
		});
		
	} else {
		
		var data = {
			"Error" : "Not a valid URL"
		}
		
		res.end(JSON.stringify(data));
	}
});

app.get('/url-shortener/:id', function(req, res) {
	
	//The input is a short url
	var input = req.params.id;
	
	mongo.connect(dataURL, function(err, db) {
		   
		if (err) throw err;
		   
		var urlsCollection = db.collection('urls');
		
		urlsCollection.find({
			
			"short-url": {$eq: input}
			
		}).toArray(function(err, documents){
			
		   if (err) throw err;
		   
		   //If it found matchess
		   if (documents.length>0) {
			   
			   var finalUrl = documents[0]["long-url"];
			   
			   res.redirect(finalUrl);
			   
		   } else {
			   
			   res.end('No URL matched in our database');
			   
		   }
		});
		
	});
		 
});

/* -------------------------------------------------------
 * FILE METADATA MICROSERVICE
 * -------------------------------------------------------*/
 
var multer = require("multer");
var path = require('path');

var upload = multer({dest:'uploads'});

app.get('/file-metadata-microservice/', function (req, res) {
  res.sendFile(__dirname + '/index/file-metadata-index.html');
})

app.post('/uploads', upload.single('file-input'), function(req, res) {
    
    res.writeHead(200, {'content-type': 'application/JSON'});
    
    if (req) {
        
        var data = {
            'File Size': req.file["size"].toString() + ' ' + 'bytes'
        }
        
        res.end(JSON.stringify(data));
        
    } else {
        
        res.end('There was an error uploading the file');
        
    }
});

/* -------------------------------------------------------
 * IMAGE SEARCH ABSTRACTION LAYER
 * -------------------------------------------------------*/

// TODO: build this feature


/*
 * GENERAL LISTENING TO THE PORT
 */

app.listen(process.env.PORT, function () {
	console.log('Example app listening to current port!');
});