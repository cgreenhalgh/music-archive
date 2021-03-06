// stages.js
// generate stage-related stuff
fs = require('fs');
path = require('path');
utils = require('./utils');

module.exports.readMuzivisualStages = function( mvpath, narrativespath ) {
	// like:
	// stage_name,stage,cue,map_x,map_y,path,original_x,original_y
	// Basecamp,basecamp,1a/1b,0.53125,0.626041667,0,320,631
	var narratives = fs.readFileSync(narrativespath, {encoding: 'utf-8'});
	narratives = narratives.replace(/\r/g,'');
	var nlines = narratives.split('\n');
	var narratives = {};
	var depnarratives = {};
	for (var l in nlines) {
		if (l==0)
			continue;
		var values = nlines[l].split('/');
		// ignore trailing , if present (historical artefact)
		if (values[2].length>0 && values[2].charAt(values[2].length-1)==',') {
			values[2] = values[2].substring(0, values[2].length-1);
		}
		// from/to/narrative
		// use the first one
		if (narratives[values[1]]===undefined)
			narratives[values[1]] = values[2];
		// dependent narratives keyed by from
		if (depnarratives[values[1]]===undefined)
			depnarratives[values[1]]= {};
		depnarratives[values[1]][values[0]] = values[2];
	}
	var text = fs.readFileSync(mvpath, {encoding: 'utf-8'});
	var lines = text.split('\n');
	var stages = [];
	var headings = lines[0].split(',');
	for (var l in lines) {
		if (l==0)
			continue;
		var data = {};
		var values = lines[l].split(',');
		for (var h in headings) {
			data[headings[h]] = values[h];
		}
		var cue = data.cue.length>0 ? data.cue.split('/') : [];
		// prefer the narrative in the same path, i.e. where this is the first option
		if (cue.length>0 && depnarratives[cue[0]][data.stage]!==undefined)
			narratives[cue[0]] = depnarratives[cue[0]][data.stage];
	}
	for (var l in lines) {
		if (l==0)
			continue;
		var data = {};
		var values = lines[l].split(',');
		for (var h in headings) {
			data[headings[h]] = values[h];
		}
		var cue = data.cue.length>0 ? data.cue.split('/') : [];
		stages.push({id: data.stage, title: data.stage_name, rank: l, description: narratives[data.stage],
			map_x: Number(data.map_x), map_y: Number(data.map_y), path: Number(data.path), cue: cue,
			narratives: depnarratives[data.stage] });
	}
	return stages;
}

module.exports.makeAnnalistStages = function( stages ) {
	var templatefile = path.join( __dirname, '..', 'templates', 'stage.json' );
	var template;
	try {
		template = JSON.parse(fs.readFileSync( templatefile, {encoding:'utf-8'} ));
	}
	catch (err) {
		console.log('ERROR: reading stage template file '+templatefile+': '+err.message);
		return null;
	}
	var annalistStages = [];
	for (var si in stages) {
		var stage = stages[si];
		var value = JSON.parse(JSON.stringify(template));
		utils.replaceVariables(value, stage);
		// hack for now for narratives
		
		annalistStages.push(value);
	}
	return annalistStages;
}

module.exports.fixAnnalistClimb = function( annalistEntries, annalistStages ) {
	for (var i in annalistEntries) {
		var entry = annalistEntries[i];
		if ('Performed_work'==entry['annal:type_id'] && 'Climb'==entry['annal:id']) {
			
			var HAS_MEMBER = "frbroo:R10_has_member";
			entry[HAS_MEMBER] = [];
			for (var si in annalistStages) {
				var stage = annalistStages[si];
				var item = {};
				item[HAS_MEMBER] = stage['annal:type_id']+'/'+stage['annal:id'];
				entry[HAS_MEMBER].push(item); 
			}
			// cludge for climb
			entry['coll:map_url'] = 'assets/images/Climb_Map_background.jpg';
			return entry;
		}
		else {
			//console.log('skip '+entry['annal:type_id']+' '+entry['annal:id']);
		}
	}
	console.log('ERROR could not find Performed_work Climb in annalist entries');
	return null;
}