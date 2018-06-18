mclog = require('./mclog');
experience = require('./experience');
output = require('./output');
performances = require('./performances');

fs = require('fs');

if (process.argv.length<5) {
	console.log('ERROR: usage: node logs2codes.js CODEOUTCSV EXPERIENCEXLSX ANNALISTEXPORTFILE1 ANNALISTEXPORTFILE2 LOGFILE1 ...');
	process.exit(-1);
}

var expfile = process.argv[3];
try {
	console.log('read experience spreadsheet '+expfile);
	experience.readSpreadsheet(expfile);
}
catch(err) {
	console.log('ERROR: reading experience spreadsheet '+expfile+': '+err.message, err);
	process.exit(-2);
}


var annalistContext, annalistEntries = [];
for (var fi=4; fi<=5; fi++) {
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
for(var j=6; j<process.argv.length; j++) {
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
var output = 'error,performanceid,performance,stage,code,type,measure,played,time_in_stage\n';
for (var ti in triggered_codes) {
	var tc = triggered_codes[ti];
	output = output + escapeCsv(tc.error)+','+escapeCsv(tc.performanceid)+','+
	escapeCsv(tc.performance)+','+
	escapeCsv(tc.stage)+','+escapeCsv(tc.code)+','+escapeCsv(tc.type)+','+
	  escapeCsv(tc.measure)+','+escapeCsv(tc.played)+','+escapeCsv(tc.time_in_stage)+'\n'
}
var outfile = process.argv[2];
console.log('write output to '+outfile);
fs.writeFileSync( outfile, output, {encoding:'utf-8'});
console.log('done');
