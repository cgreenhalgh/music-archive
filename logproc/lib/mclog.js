// mclog.js
// process muzicodes log file, intially for vStart/vStop/vStageChange events
fs = require('fs');

var performances = {}

module.exports.read = function( path ) {
	var data = fs.readFileSync( path, {encoding:'utf-8'} );
	var lines = data.split('\n');
	console.log('read '+lines.length+' lines');
	var currentPerformance = null;
	var meld_session = null;
	for (var l in lines) {
		var line = lines[l];
		try {
			var entry = JSON.parse(line);
			// event: "input","info":{"inputUrl":"post:meld.load","params":{..."meldcollection":"http://127.0.0.1:5000/collection/TTyEu7wQJPHUJYHpGV7tRj"...}
			if (('input'==entry.event && entry.info && 'post:meld.load'==entry.info.inputUrl)) {
				meld_session = entry.info.params.meldcollection;
				// should be before vStart...
			}
			// event: action.triggered
			// see also time, datetime
			// note typo :-)
			if (('action.tiggered'==entry.event || 'action.triggered'==entry.event) && entry.info && entry.info.actions) {
				// entry.info.actions[]
				for (var ai in entry.info.actions) {
					var action = entry.info.actions[ai];
					if (action.url && action.url.indexOf('emit:vStart:mobileapp:')==0) {
						// like emit:vStart:mobileapp:9333e7a2-16a9-4352-a45a-f6f42d848cde:basecamp
						var parts = action.url.split(':');
						var perfid = parts[3];
						if (perfid) {
							//console.log('Found start for performance '+perfid+' at '+entry.datetime);
							if (performances[perfid]) {
								console.log('Warning: performance '+perfid+' restarted at '+entry.datetime);
							}
							console.log('adding performance '+perfid);
							var performance = { startTime: entry.time, startDatetime: entry.datetime, id: perfid, stages: [], notes: [], codes: [], emits: []  };
							currentPerformance = performance;
							performances[perfid] = performance;
							performance.stages.push({id: parts[4], time: entry.time, datetime: entry.datetime, codes: [], meld_session:meld_session});
							performance.emits.push({name:'vStart', time:entry.time, data: action.url.substring('emit:vStart:mobileapp:'.length)});
						}
						else {
							console.log('WARNING: Found start for unspecified performance: '+action.url+' a tline '+(l+1));
						}
					}
					else if (action.url && action.url.indexOf('emit:vStop:mobileapp:')==0) {
						// emit:vStop:mobileapp:9333e7a2-16a9-4352-a45a-f6f42d848cde
						var parts = action.url.split(':');
						var perfid = parts[3];
						if (perfid) {
							//console.log('Found stop for performance '+perfid+' at '+entry.datetime);
							var performance = performances[perfid];
							if (performance) {
								performance.stopTime = entry.time;
								performance.stopDatetime = entry.datetime;
								performance.emits.push({name:'vStop', time:entry.time, data: action.url.substring('emit:vStop:mobileapp:'.length)});
							} else {
								console.log('Warning: performance '+perfid+' not found (vStop) at '+entry.datetime);
							}
						}
						currentPerformance = null;	
					}
					else if (action.url && action.url.indexOf('emit:vStageChange:mobileapp:')==0) {
						// like emit:vStageChange:mobileapp:9333e7a2-16a9-4352-a45a-f6f42d848cde:end->3b
						var parts = action.url.split(':');
						var perfid = parts[3];
						if (perfid) {
							//console.log('Found stage change for performance '+perfid+' at '+entry.datetime);
							var performance = performances[perfid];
							if (performance && performance.stopTime) {
								console.log('Warning: ignore vStageChange after end of performance '+perfid);
							}
							else if (performance && parts[4]) {
								performance.emits.push({name:'vStageChange', time:entry.time, data: action.url.substring('emit:vStageChange:mobileapp:'.length)});
								var ix = parts[4].indexOf('->');
								if (ix<0) {
									console.log('Found invalid vStageChange at line '+(l+1)+': '+action.url);
								} else {
									performance.stages.push({id: parts[4].substring(ix+2), time: entry.time, datetime: entry.datetime, codes: [], meld_session:meld_session});
								}
							} else {
								console.log('Warning: performance '+perfid+' not found (vStageChange) at '+entry.datetime);
							}
						}						
					}
				}
				if (entry.info.title && entry.info.code && currentPerformance) {
					var code = {id: entry.info.title, time: entry.time, datetime: entry.datetime};
					currentPerformance.codes.push(code);
					currentPerformance.stages[currentPerformance.stages.length-1].codes.push(code);
				}
			} else if ('midi.note'==entry.event) {
				// like {"localTime":1495029177971,"note":"E4","midinote":64,"freq":329.59534665249885,"velocity":127,"off":false}
				if (currentPerformance) {
					if (!entry.info.datetime) {
						entry.info.datetime = entry.datetime;
					}
					if (currentPerformance.notes.length==0 && currentPerformance.stages.length==1) {
						// "fix" time of start to first note?!
						console.log('Note: using first note as start of performance '+currentPerformance.id);
						currentPerformance.startTime = entry.time;
						currentPerformance.startDatetime = entry.datetime;
						currentPerformance.stages[0].time = entry.time;
						currentPerformance.stages[0].datetime = entry.datetime;
					}
					currentPerformance.notes.push(entry.info);
				} else {
					console.log('discard MIDI note outside performance at '+entry.datetime);
				}
			}
		} catch (err) {
			console.log('ERROR reading/processing log line: '+err.message+' - '+line+' (line '+(l+1)+')');
		}
	}
}

module.exports.getPerformances = function() {
	return performances;
}
