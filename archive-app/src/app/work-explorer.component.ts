import 'rxjs/add/operator/switchMap';
import { Component, OnInit, ElementRef }      from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Location }               from '@angular/common';

import { Entity } from './entity';
import { RecordsService }  from './records.service';

class ScreenEntity extends Entity {
	selected:boolean = false;
	available:boolean = false;
	active:boolean = false;
	highlighted:boolean = false;

	constructor(fields: object) {
		super(fields);
	}
}

class Recording extends Entity {
	startTime:number;
	urls:string[] = [];
	performance:Performance;
	audio:Object;
	canplay:boolean = false;
	shouldplay:boolean = false;
	lastTime:number = 0;
	constructor(fields: object, performance:Performance) {
		super(fields);
		this.performance = performance;
		this.startTime = this.getTime('prov:startedAtTime');
		
	}
}

class Performance extends ScreenEntity {
	startTime:number;
	recordings:Recording[];
	constructor(fields: object) {
		super(fields);
		this.startTime = this.getTime('prov:startedAtTime');
	}
}

class Part extends ScreenEntity {
	constructor(fields: object) {
		super(fields);
	}
}

class AudioClip {
	recording:Recording;
	start:number;
	duration:number;
	constructor(recording:Recording,start:number,duration:number) {
		this.recording = recording;
		this.start = start;
		this.duration = duration;
	}
}

class PartPerformance extends Entity {
	startTime:number;
	performance:Performance;
	part:Part;
	clip:AudioClip;
	currentTimeText:string = '0:00';
	constructor(fields:object, performance:Performance, part:Part) {
		super(fields);
		this.startTime = this.getTime('prov:startedAtTime');
		this.performance = performance;
		this.part = part;
	}
	setCurrentTime(time:number) {
		time = Math.floor(time);
		let minus = (time<0) ? '-' : '';
		if (time<0)
			time = -time;
		let minutes = Math.floor(time / 60);
		let seconds = time-60*minutes;
		this.currentTimeText = minus+(minutes)+':'+Math.floor(seconds/10)+(seconds%10);
	}
}

@Component({
  selector: 'work-explorer',
  templateUrl: './work-explorer.component.html',
  styleUrls: ['./work-explorer.component.css']
})

export class WorkExplorerComponent implements OnInit {
  work: Entity;
  performances: Performance[] = [];
  parts: Part[] = [];
  recordings: Recording[] = [];
	partPerformances: PartPerformance[] = [];
	currentlyPlaying: PartPerformance = null;
	selectedPart: Part = null;
	selectedPerformance: Performance = null;
	
  constructor(
	private elRef:ElementRef,
    private recordsService: RecordsService,
    private route: ActivatedRoute,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.route.params
      .switchMap((params: Params) => this.recordsService.getWork(params['id']))
      .subscribe(work => this.initialiseForWork(work));
  }
	initialiseForWork(work:Entity):void {
		this.work = work; 
		/* get all performances of work */
		this.recordsService.getPerformancesOfWork(work)
		.then(performances => {
			this.performances = performances
			.map(p => new Performance(p.fields))
			.sort((a,b) => a.compareTo(b, 'prov:startedAtTime'));
			/* then get all parts (members) of work */
			return this.recordsService.getMembers(work); 
		})
		.then(members => {
			this.parts = members
			.map(m => new Part(m.fields))
			.sort((a,b) => a.compareToNumber(b, 'coll:part_rank'));
			/* then get all recordings of each performance */
			return Promise.all(this.performances.map(p => 
				this.recordsService.getRecordingsOfPerformance(p)
				.then(recs => {
					p.recordings = recs.map(rec => new Recording(rec.fields, p));
					/* and the URLs for each performance */
					return Promise.all(p.recordings.map(r => 
						this.recordsService.getUrlsOfRecording(r).then(urls => r.urls = urls )));
				})));
		})
		.then(() => 
			Promise.all(this.performances.map(p =>
				this.recordsService.getSubEvents(p)
				.then(events => 
					this.partPerformances = this.partPerformances.concat(
						events.map(ev => new PartPerformance(ev.fields, p, this.parts.find(p => 
							ev.getValues('frbroo:R25F_performed_r','frbroo:R25F_performed').indexOf(p.type_id+'/'+p.id)>=0)))
					)
				))
			)
		)
		.then(() => {
			console.log('loaded work to explore');
			this.buildAudioClips();
		});
	}
	
  goBack(): void {
    this.location.back();
  }
  
	buildAudioClips() {
		for (var pi in this.performances) {
			let p = this.performances[pi];
			let rec = p.recordings.find(r => !!r.urls && r.urls.length>0);
			if (undefined===rec) {
				console.log('Note: no recording with url for performance '+p.label);
				continue;
			}
			this.recordings.push(rec);
		}
		for (var pi in this.partPerformances) {
			let pp = this.partPerformances[pi];
			// first recording for now
			let rec = this.recordings.find(r => r.performance===pp.performance);
			if (undefined===rec) {
				console.log('Note: no recording with url for performance '+pp.label);
				continue;
			}
			let startTime = pp.startTime;
			let recStartTime = rec.startTime;
			// TODO end of last stage??
			let endTime = this.partPerformances.filter(p => p.performance===pp.performance && p.startTime > pp.startTime)
			.map(p => p.startTime).sort().find(() => true);
			let clip = new AudioClip(rec, startTime-recStartTime, endTime? endTime-startTime : null);
			console.log('part '+pp.id+' is '+clip.start+'+'+clip.duration);
			pp.clip = clip;
		}
	}
	clickPerformance(perf) {
		console.log('highlight performance '+perf.id);
		for (var pi in this.performances) {
			let p = this.performances[pi];
			if (p!==perf)
				p.highlighted = false;
		}
		perf.highlighted = true;
		// highlight stages in this performance
		for (var pi in this.parts) {
			let part = this.parts[pi];
			part.highlighted = !!this.partPerformances.find(pp =>  pp.performance === perf && pp.part === part);
		}
	}
	clickPerformanceCheckbox(event,perf) {
		console.log('select performance '+perf.id);
		for (var pi in this.performances) {
			let p = this.performances[pi];
			if (p!==perf && p.selected)
				p.selected = false;
			p.available = false;
		}
		for (var pi in this.parts) {
			let p = this.parts[pi];
			p.selected = false;
		}
		this.selectedPart = null;
		if (!perf.selected)
			perf.selected = true;
		this.selectedPerformance = perf;
		// available stages in this performance
		for (var pi in this.parts) {
			var part = this.parts[pi];
			part.available = !!this.partPerformances.find(pp =>  pp.performance === perf && pp.part === part);
		}
		if (this.currentlyPlaying) {
			if (this.currentlyPlaying.performance!==perf || !this.currentlyPlaying.part.available)
				this.stop();
			else
				this.currentlyPlaying.part.active = true;
		}
	}
	clickPerformancePlay(event,perf) {
		event.preventDefault();
		event.stopPropagation();
		let part = this.parts.find(p => p.selected);
		if (part!==undefined) {
			this.playInternal(perf, part);
		}
	}
	clickPart(part) {
		console.log('highlight part'+part.id);
		for (var pi in this.parts) {
			let p = this.parts[pi];
			if (p!==part)
				p.highlighted = false;
		}
		part.highlighted = true;
		// highlight performances including this part/stage
		for (var pi in this.performances) {
			var performance = this.performances[pi];
			performance.highlighted = !!this.partPerformances.find(pp => pp.performance === performance && pp.part === part);
		}
	}
	clickPartCheckbox(event,part) {
		console.log('select part'+part.id);
		for (var pi in this.parts) {
			let p = this.parts[pi];
			if (p!==part && p.selected)
				p.selected = false;
			p.available = false;
		}
		for (var pi in this.performances) {
			let p = this.performances[pi];
			p.selected = false;
		}
		this.selectedPerformance = null;
		if (!part.selected)
			part.selected = true;
		this.selectedPart = part;
		for (var pi in this.performances) {
			var performance = this.performances[pi];
			performance.available = !!this.partPerformances.find(pp => pp.performance === performance && pp.part === part);
		}
		if (this.currentlyPlaying) {
			if (this.currentlyPlaying.part!==part|| !this.currentlyPlaying.performance.available)
				this.stop();
			else
				this.currentlyPlaying.performance.active = true;
		}
	}
	clickPartPlay(event,part) {
		event.preventDefault();
		event.stopPropagation();
		let perf = this.performances.find(p => p.selected);
		if (perf!==undefined) {
			this.playInternal(perf, part);
		}
	}
	playInternal(perf, part) {
		console.log('play '+perf.id+' '+part.id);
		for (var pi in this.parts) {
			let p = this.parts[pi];
			p.active = p===part && !part.selected;
		}
		for (var pi in this.performances) {
			let p = this.performances[pi];
			p.active = p===perf && !perf.selected;
		}
		
		let wasPlaying = this.currentlyPlaying;
		this.currentlyPlaying = this.partPerformances.find(pp => pp.performance===perf && pp.part===part);
		
		//console.log('elRef',this.elRef);
		let rec = this.recordings.find(r => r.performance===perf);
		if (!rec) {
			console.log('no recording for performance '+perf.id);
		}
		if (!!this.elRef) {
			let audios = this.elRef.nativeElement.getElementsByTagName('audio');
			for (var ai=0; ai<audios.length; ai++) {
				let audio = audios[ai];
				console.log('audio '+ai+'/'+audios.length+':', audio);
				if (!!rec && audio.id==rec.id) {
					rec.shouldplay = true;
					// start time...
					var partOffset = 0;
					if (!!wasPlaying && wasPlaying.part===part && wasPlaying!==this.currentlyPlaying) {
						// same time in part?
						partOffset = wasPlaying.clip.recording.lastTime + wasPlaying.clip.recording.startTime 
						- wasPlaying.startTime;
						if (partOffset<0) {
							console.log('warning: part offset <0: '+partOffset+' (lastTime '+wasPlaying.clip.recording.lastTime+')');
							partOffset = 0;
						}
					}
					this.currentlyPlaying.setCurrentTime(partOffset);	
					if (this.currentlyPlaying.clip.start+partOffset>=0) {
						console.log('seek to '+(this.currentlyPlaying.clip.start+partOffset));
						audio.currentTime = this.currentlyPlaying.clip.start+partOffset;
					} else {
						console.log('warning: clip start <0: '+this.currentlyPlaying.id+', '+this.currentlyPlaying.clip.start+'+'+partOffset);
						audio.currentTime = 0;
					}
					if (audio.readyState>=2)
						// canplay
						audio.play();
				} else {
					audio.pause();
				}
			}
		}
	}
	stop() {
		this.pause();
		this.currentlyPlaying = null;
	}
	audioTimeupdate(event,rec) {
		console.log('timeupdate '+rec.id+' '+event.srcElement.currentTime);
		rec.lastTime = event.srcElement.currentTime;
		if (!!this.currentlyPlaying && this.currentlyPlaying.clip.recording===rec) {
			let offset = rec.lastTime+rec.startTime-this.currentlyPlaying.startTime;
			this.currentlyPlaying.setCurrentTime(offset);
			if (this.currentlyPlaying.performance.selected) {
				// check best clip...
				let nextPp = this.partPerformances.filter(pp=>pp.performance===this.currentlyPlaying.performance
					&& (!pp.clip.duration || pp.startTime+pp.clip.duration-0.1>rec.lastTime+rec.startTime))
					.sort((a,b)=>a.startTime-b.startTime).find(()=>true);
				if (!nextPp) {
					console.log('no valid part to play');
					//this.stop();
				} else if (nextPp!==this.currentlyPlaying) {
					console.log('change part to '+nextPp.id);
					this.currentlyPlaying.part.active = false;
					this.currentlyPlaying = nextPp;
					this.currentlyPlaying.part.active = true;
					this.currentlyPlaying.setCurrentTime(rec.lastTime+rec.startTime-this.currentlyPlaying.startTime);
				}
			}
			else if (this.currentlyPlaying.part.selected) {
				if (this.currentlyPlaying.clip.duration && offset > this.currentlyPlaying.clip.duration) {
					// pause
					this.pause();
					event.srcElement.currentTime = this.currentlyPlaying.startTime-rec.startTime;
				} else if (offset < 0) {
					// before clip?!
					event.srcElement.currentTime = rec.lastTime-offset;
				}
			}
		}
	}
	audioEnded(event,rec) {
		console.log('ended '+rec.id);
		this.pause();
		event.srcElement.currentTime = 0;
	}
	audioCanplay(event,rec) {
		console.log('canplay '+rec.id);
		rec.canplay = true;
		if (rec.shouldplay) {
			console.log('play '+rec.id+' on canplay');
			event.srcElement.play();
		}
	}
	audioSeeked(event,rec) {
		console.log('seeked '+rec.id);
	}
	play() {
		if (!!this.currentlyPlaying && !this.currentlyPlaying.clip.recording.shouldplay) {
			this.currentlyPlaying.clip.recording.shouldplay = true;
		if (!!this.elRef) {
			let audios = this.elRef.nativeElement.getElementsByTagName('audio');
			for (var ai=0; ai<audios.length; ai++) {
				let audio = audios[ai];
				if (audio.id==this.currentlyPlaying.clip.recording.id) {
					this.currentlyPlaying.clip.recording.shouldplay = true;
					if (audio.readyState>=2)
						// canplay
						audio.play();
					}
				}
			}
		}
	}
	pause() {
		if (this.currentlyPlaying) {
			this.currentlyPlaying.performance.active = false;
			this.currentlyPlaying.part.active = false;
			if (!!this.elRef) {
				let audios = this.elRef.nativeElement.getElementsByTagName('audio');
				for (var ai=0; ai<audios.length; ai++) {
					let audio = audios[ai];
					audio.pause();
				}
			}
			this.recordings.forEach(r => r.shouldplay = false);
		}
	}
	getAudio(rec:Recording) {
		if (!!this.elRef) {
			let audios = this.elRef.nativeElement.getElementsByTagName('audio');
			for (var ai=0; ai<audios.length; ai++) {
				let audio = audios[ai];
				console.log('audio '+ai+'/'+audios.length+':', audio);
				if (!!rec && audio.id==rec.id) {
					return audio;
				}
			}
		}
		return null;
	}
	forward() {
		if (!!this.currentlyPlaying) {
			let audio = this.getAudio(this.currentlyPlaying.clip.recording);
			if (!!audio) {
				let currentTime = audio.currentTime;
				if (audio.duration!=0 && currentTime+10>audio.duration) {
					this.pause();
					audio.currentTime = audio.duration;
				}
				else
					audio.currentTime = currentTime+10;
			}
		}
	}
	back() {
		if (!!this.currentlyPlaying) {
			let audio = this.getAudio(this.currentlyPlaying.clip.recording);
			if (!!audio) {
				let currentTime = audio.currentTime;
				if (this.currentlyPlaying.part.selected) {
					if (this.currentlyPlaying.clip.recording.startTime+currentTime-10 < this.currentlyPlaying.startTime)
						audio.currentTime = this.currentlyPlaying.startTime - this.currentlyPlaying.clip.recording.startTime;
					else if (currentTime>10)
						audio.currentTime = currentTime-10;
					else
						audio.currentTime = 0;
				} else {
					// performance
					if (currentTime>10)
						audio.currentTime = currentTime-10;
					else {
						audio.currentTime = 0;
					}
				}
			}
		}
	}
	next() {
		console.log('next');
		if (!!this.currentlyPlaying) {
			if (this.currentlyPlaying.part.selected) {
				let options = this.partPerformances.filter(pp=>pp.part===this.currentlyPlaying.part);
				let ix = (options.indexOf(this.currentlyPlaying)+1) % options.length;
				this.playInternal(options[ix].performance, options[ix].part);
			} else {
				let pp = this.partPerformances.filter(pp=>pp.performance===this.currentlyPlaying.performance && 
					pp.startTime>this.currentlyPlaying.startTime).sort((a,b)=>a.startTime-b.startTime).find(()=>true);
				if (!!pp)
					this.playInternal(pp.performance, pp.part);
			}
		}
	}
	previous() {
		console.log('previous');
		if (!!this.currentlyPlaying) {
			if (this.currentlyPlaying.part.selected) {
				let options = this.partPerformances.filter(pp=>pp.part===this.currentlyPlaying.part);
				let ix = (options.indexOf(this.currentlyPlaying)+options.length-1) % options.length;
				this.playInternal(options[ix].performance, options[ix].part);
			} else {
				let pp = this.partPerformances.filter(pp=>pp.performance===this.currentlyPlaying.performance && 
					pp.startTime<this.currentlyPlaying.startTime).sort((a,b)=>b.startTime-a.startTime).find(()=>true);
				if (!!pp)
					this.playInternal(pp.performance, pp.part);
			}
		}
	}
}

