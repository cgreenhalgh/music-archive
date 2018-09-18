mclog = require('./mclog');
experience = require('./experience');
output = require('./output');
performances = require('./performances');

fs = require('fs');

if (process.argv.length<6) {
	console.log('ERROR: usage: node logs2codes.js CODEOUTCSV CODEOUTVIZJSON EXPERIENCEXLSX ANNALISTEXPORTFILE1 ANNALISTEXPORTFILE2 LOGFILE1 ...');
	process.exit(-1);
}

var expfile = process.argv[4];
try {
	console.log('read experience spreadsheet '+expfile);
	experience.readSpreadsheet(expfile);
}
catch(err) {
	console.log('ERROR: reading experience spreadsheet '+expfile+': '+err.message, err);
	process.exit(-2);
}


var annalistContext, annalistEntries = [];
for (var fi=5; fi<=6; fi++) {
	var annalistfile = process.argv[fi];
	try {
		annalistContext = JSON.parse(fs.readFileSync(annalistfile, {encoding:'utf-8'}));
		annalistEntries = annalistEntries.concat(annalistContext['annal:entity_list']);
	}
	catch (err) {
		console.log('ERROR: reading annalist file '+annalistfile+': '+err.message);
		process.exit(-3);
	}
}

var experience_codes = experience.getCodes();
// e.g. { id: '5c_1', stage: '5c', meifile: '5cFallingTrees.mei', measure: 25, type: 'challenge' },
console.log('experience codes', experience_codes);

var triggered_codes = [];
for(var j=7; j<process.argv.length; j++) {
	var mclogfile = process.argv[j];
	try {
		console.log('read musicodes log '+mclogfile);
		mclog.read(mclogfile);
	}
	catch (err) {
		console.log('ERROR: reading musicodes logfile '+mclogfile+': '+err.message, err);
		process.exit(-2);
	}
}

console.log('performances:');
var mcperformances = mclog.getPerformances();
for (var perfid in mcperformances) {
	var performance = mcperformances[perfid];
	var performanceTitle = performances.getPerformanceTitle( annalistEntries, perfid );
	if (!performanceTitle) {
		console.log('Warning: could not find annalist entry for performance '+perfid+' - ignored');
		continue;
	}
	performance.title = performanceTitle;
	console.log('MC performance '+perfid+':' /*, performance.stages*/ );
	// performances has stages[] with {id, time, datetime, codes[]}
	// codes[] has {id,time,datetime}
	for (var si in performance.stages) {
		var stage = performance.stages[si];			
		var stage_codes = {};
		for (var ci in stage.codes) {
			var code = stage.codes[ci];
			stage_codes[code.id] = code;
		}
		for (var ci in experience_codes) {
			var experience_code = experience_codes[ci];
			if (experience_code.stage != stage.id)
				continue;
			var stage_code = stage_codes[experience_code.id];
			delete stage_codes[experience_code.id];
			var triggered_code = {
					performanceid:perfid,
					performance:performance.title,
					stage:stage.id,
					code:experience_code.id,
					measure:experience_code.measure,
					type:experience_code.type,
					played: !!stage_code
				}
			if (!!stage_code) {
				triggered_code.time_in_stage = 0.001*(stage_code.time - stage.time);
			}
			triggered_codes.push(triggered_code);
		}
		for (var ci in stage_codes) {
			var stage_code = stage_codes[ci];
			var triggered_code = {
					error:'code not found in experience definition',
					performanceid:perfid,
					performance:performance.title,
					stage:stage.id,
					code:experience_code.id,
					measure:experience_code.measure,
					type:experience_code.type,
					played: true
				}
			if (!!stage_code) {
				triggered_code.time_in_stage = 0.001*(stage_code.time - stage.time);
			}				
			triggered_codes.push(triggered_code);
		}
		// stage change
		if (1+Number(si) < performance.stages.length) {
			var next_stage = performance.stages[1+Number(si)];
			if (next_stage) {
				var triggered_code = {
						performanceid:perfid,
						performance:performance.title,
						stage:stage.id,
						played: false,
						nextstage:next_stage.id
					}
				triggered_codes.push(triggered_code);
			} else {
				var triggered_code = {
						error:'unknown next stage '+(1+Number(si))+'/'+performance.stages.length+' for stage '+si,
						performanceid:perfid,
						performance:performance.title,
						stage:stage.id,
						played: false
					}
				triggered_codes.push(triggered_code);				
			}
		} else {
			/*var triggered_code = {
					error:'out of range next stage '+(1+Number(si))+'/'+performance.stages.length+' for stage '+si,
					performanceid:perfid,
					performance:performance.title,
					stage:stage.id,
					type:'NEXT',
					played: false
				}
			triggered_codes.push(triggered_code);				
			*/
		}
	}
	//		console.log(performance);
}

function escapeCsv(text) {
	if (!text)
		return '';
	text = String(text);
	if (text.indexOf('"')>=0 || text.indexOf(',')>=0 || text.indexOf('\n')>=0) {
		var out = '"';
		for (var i=0; i<text.length; i++) {
			var c = text.substring(i,i+1);
			if ('"'==c) {
				out = out + '""';			
			} else if ('\n'==c){
				out = out + '\n';
			} else {
				out = out + c;
			}
		}
		out = out + '"';
		return out;
	}
	return text;
}

console.log('triggered_codes: '+ triggered_codes.length);
var output = 'error,performanceid,performance,stage,code,type,measure,played,time_in_stage,nextstage\n';
for (var ti in triggered_codes) {
	var tc = triggered_codes[ti];
	output = output + escapeCsv(tc.error)+','+escapeCsv(tc.performanceid)+','+
	escapeCsv(tc.performance)+','+
	escapeCsv(tc.stage)+','+escapeCsv(tc.code)+','+escapeCsv(tc.type)+','+
	  escapeCsv(tc.measure)+','+escapeCsv(tc.played)+','+escapeCsv(tc.time_in_stage)+','+
	  escapeCsv(tc.nextstage)+'\n'
}
var outfile = process.argv[2];
console.log('write output to '+outfile);
fs.writeFileSync( outfile, output, {encoding:'utf-8'});

// visualisation
var vizout = {};
vizout.performances = [];
for (var perfid in mcperformances) {
	var performance = mcperformances[perfid];
	if (!performance.title) 
		continue;
	vizout.performances.push({id: perfid, title: performance.title, startTime: performance.startTime});
}
vizout.performances.sort(function(a,b) { return String(a.startTime).localeCompare(String(b.startTime)); })
// hack!
vizout.stages = [
    {"id": "basecamp", title:"Basecamp", path:1, level:0 },
    {"id": "1a",  title:"Angry Deer",path:0, level:1 },
    {"id": "1b",  title:"Stones",path:1, level:1 },
    {"id": "1c",  title:"Echo",path:2, level:1 },
    {"id": "p1a",  title:"Path 1a",path:0, level:2 },
    {"id": "p2a",  title:"Path 2a",path:1, level:2 },
    {"id": "p3a",  title:"Path 3a",path:2, level:2 },
    {"id": "2a",  title:"Flooded Path",path:0, level:3 },
    {"id": "2b", title:"Tree Trunk", path:1, level:3 },
    {"id": "2c", title:"Herd of Cows", path:2, level:3 },
    {"id": "p1b", title:"Path 1b", path:0, level:4 },
    {"id": "p2b", title:"Path 2b", path:1, level:4 },
    {"id": "p3b", title:"Path 3b", path:2, level:4 },
    {"id": "3a", title:"Shimmering Stone", path:0, level:5 },
    {"id": "3b", title:"Whispering Forest", path:1, level:5 },
    {"id": "3c", title:"Talkative Stranger", path:2, level:5 },
    {"id": "p1c", title:"Path 1c", path:0, level:6 },
    {"id": "p2c", title:"Path 2c", path:1, level:6 },
    {"id": "p3c", title:"Path 3c", path:2, level:6 },
    {"id": "4a", title:"Sleeping Bear", path:0, level:7 },
    {"id": "4b", title:"Hallucination", path:1, level:7 },
    {"id": "4c", title:"Apple Tree", path:2, level:7 },
    {"id": "5a", title:"Rolling Stones", path:0, level:8 },
    {"id": "5b", title:"Birds Attack", path:1, level:8 },
    {"id": "5c", title:"Falling Trees", path:2, level:8 },
    {"id": "summit", title:"Summit", path:1, level:9 }
];
/*
var exstages = experience.getStages();
for (var si in exstages) {
	var exstage = exstages[si];
	var title = exstage.meifile;
	// TODO fix
	var stage = vizout.stages.find(function(s) { return s.id == exstage.stage});
	if (stage)
		stage.title = title;
	else {
		console.log('could not find stage '+exstage.stage+' to set title');
	}
}
*/
for (var si in vizout.stages) {
	var stage = vizout.stages[si];
	stage.codes = [];
	stage.performance_next = {};
}
for (var ci in experience_codes) {
	var code = experience_codes[ci];
	var stage = vizout.stages.find(function(s) { return s.id == code.stage });
	if (stage) {
		stage.codes.push({id: code.id, measure: code.measure, type: code.type, performance_code: {} })
	} else {
		console.log('error: could not find stage '+code.stage+' for code '+code.id)
	}
}
// sort codes?! - doesn't put Ending... at end yet :-(
vizout.stages.sort(function(a,b) {
	if (Number(a) < Number(b) && Number(a) != 0) 
		return -1;
	else if (Number(a) > Number(b) && Number(b) != 0)
		return 1;
	else 
		return String(a).localeCompare(String(b));
});
for (var perfid in mcperformances) {
	var performance = mcperformances[perfid];
	if (!performance.title) 
		continue;
	for (var si in performance.stages) {
		var stage = performance.stages[si];
		var vstage = vizout.stages.find(function(s) { return s.id == stage.id })
		if (vstage && 1+Number(si) < performance.stages.length) {
			var next_stage = performance.stages[1+Number(si)];
			if (next_stage) {
				vstage.performance_next[perfid] = next_stage.id;
			}
		}
	}
}
for (var tc in triggered_codes) {
	var triggered_code = triggered_codes[tc];
	if (!triggered_code.code)
		continue;
	var vstage = vizout.stages.find(function(s) { return s.id == triggered_code.stage });
	if (!vstage)
		continue;
	var vcode = vstage.codes.find(function(c) { return c.id == triggered_code.code });
	if (!vcode)
		continue;
	vcode.performance_code[triggered_code.performanceid] = { played: triggered_code.played, time_in_stage: triggered_code.time_in_stage };
}
var vizoutput = JSON.stringify(vizout,null, 4);
var outfile2 = process.argv[3];
console.log('write viz output to '+outfile2);
fs.writeFileSync( outfile2, vizoutput, {encoding:'utf-8'});
console.log('done');
