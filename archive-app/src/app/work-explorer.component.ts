import 'rxjs/add/operator/switchMap';
import { Component, OnInit, ElementRef, NgZone, OnDestroy, ViewChild }      from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Params } from '@angular/router';
import { Location }               from '@angular/common';
import { Renderer2 } from '@angular/core';

import * as FileSaver from 'file-saver';

import { Entity } from './entity';
import { RecordsService }  from './records.service';
import { LinkappsService } from './linkapps.service';
import { PlaylistInfo, PlaylistItem } from './types';

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
    startTimeOffset:number;
	urls:string[] = [];
	performance:Performance;
	audio:Object;
	canplay:boolean = false;
	shouldplay:boolean = false;
	lastTime:number = 0;
	isVideo:boolean = false;
	visible:boolean = false;
  duration:number;
	constructor(fields: object, performance:Performance) {
		super(fields);
		this.performance = performance;
		this.startTime = this.getTime('prov:startedAtTime');
		let stvs = this.getNumberValues('coll:startTimeOffset');
        if (stvs.length>0) {
            this.startTimeOffset = stvs[0];
            console.log(`Fixing start time of recording ${this.id} to ${performance.startTime}-${this.startTimeOffset} instead of ${this.startTime} (delta ${(performance.startTime-this.startTimeOffset)-this.startTime})`);
            this.startTime = performance.startTime-this.startTimeOffset;
        } else {
            this.startTimeOffset = null;
        }
	}
	setUrls(urls:string[]) {
		this.urls = urls;
		this.isVideo = urls.find(url => url.length>4 && '.mp4'==url.substr(-4))!==undefined;
		if (this.isVideo)
			console.log('found video recording '+this.id+' url '+urls);
	}
}

class Performance extends ScreenEntity {
	startTime:number;
	recordings:Recording[];
  performers:Entity[];
  isPlaylist:boolean = false;
	constructor(fields: object) {
		super(fields);
		this.startTime = this.getTime('prov:startedAtTime');
    this.performers = [];
	}
}

class Playlist extends Performance {
  playlistFeedback:string;
  playlistFeedbackVisible:boolean = false;
  playlistFeedbackTimer = null;
  constructor(name:string) {
    super({'rdfs:label':name});
    this.isPlaylist = true;
  }
  showFeedback(feedback:string) {
    this.playlistFeedback = feedback;
    this.playlistFeedbackVisible = true;
    if (this.playlistFeedbackTimer)
      clearTimeout(this.playlistFeedbackTimer);
    let self = this;
    function fn() {
      self.playlistFeedbackTimer = null;
      if (self.playlistFeedbackVisible) {
        self.playlistFeedbackVisible = false;
        self.playlistFeedbackTimer = setTimeout(fn, 1000);
      } else {
        self.playlistFeedback = null;
      }
    };
    this.playlistFeedbackTimer = setTimeout(fn,100);
  }
}

class Part extends ScreenEntity {
  popularity:number; // 0-1
  heatmapColor:string;
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

class SubEvent extends Entity {
	startTime:number;
	startTimeText:string;
	highlight:boolean=false;
	countdown:number=0;
	constructor(fields:object, pp: PartPerformance) {
		super(fields);
		this.startTime = this.getTime('prov:startedAtTime');
		var partOffset = this.startTime - pp.startTime;
		let minutes = Math.floor(partOffset / 60);
		let seconds = Math.floor(partOffset-60*minutes);
		this.startTimeText = (minutes)+':'+Math.floor(seconds/10)+(seconds%10);
	}
	clear() {
		this.countdown = 0;
		this.highlight = false;
	}
	setAbsTime(time:number) {
		var delta = this.startTime-time;
		this.highlight = (delta<=0 && delta> -1);
		if (delta>0 && delta<5)
			this.countdown = Math.floor(delta+1);
		else
			this.countdown = 0;
		console.log('setAbsTime '+time+'/'+this.startTime+'='+delta+', countdown='+this.countdown+', highlight='+this.highlight);
	}
}

class PartPerformance extends Entity {
	startTime:number;
	performance:Performance;
	part:Part;
	clip:AudioClip;
	audioClip:AudioClip;
	videoClip:AudioClip;
	currentTimeText:string = '0:00';
	subevents:SubEvent[] = [];
  isClip:boolean = false;
  playlist:Playlist;
  playlistOffset:number;
  realPerformance:Performance;
  //clipOffset:number;
  hasOffset:boolean;
  hasDuration:boolean;
  duration:number;
	constructor(fields:object, performance:Performance, part:Part) {
		super(fields);
    if(!part) console.log('Error: create PP '+this.id+' with null part; fields:', fields);
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
var nextClip = 1;
class Clip extends PartPerformance {
  realPartPerformance:PartPerformance;
  active:boolean = false;
  hasStartOffset:boolean = false;
  hasEndOffset:boolean = false;
  // TODO offset/duration
  constructor(playlist:Playlist, pp:PartPerformance) {
    super({},playlist,pp.part);
    this.id = '_clip'+(nextClip++);
    this.startTime = pp.startTime;
    this.isClip = true;
    this.audioClip = new AudioClip(pp.audioClip.recording, pp.audioClip.start, pp.audioClip.duration);
    this.clip = new AudioClip(pp.clip.recording, pp.clip.start, pp.clip.duration);
    this.videoClip = new AudioClip(pp.videoClip.recording, pp.videoClip.start, pp.videoClip.duration);
    if (this.audioClip)
      this.duration = this.audioClip.duration;
    if (this.videoClip && (!this.duration || this.videoClip.duration < this.duration))
      this.duration = this.videoClip.duration;
    this.playlist = playlist;
    this.realPartPerformance = pp;
    this.realPerformance = pp.performance;
    this.subevents = pp.subevents;
  }
  setCurrentTime(time:number) {
    if (this.realPartPerformance) {
      super.setCurrentTime(time + this.startTime - this.realPartPerformance.startTime);
    } else {
      super.setCurrentTime(time);
    }
  }
}

const DRAG_AND_DROP_MIME_TYPE = 'application/x-archive-dd';

@Component({
  selector: 'work-explorer',
  templateUrl: './work-explorer.component.html',
  styleUrls: ['./work-explorer.component.css']
})

export class WorkExplorerComponent implements OnInit, OnDestroy {
  @ViewChild('appframe') appframe: ElementRef;
  work: Entity;
  performances: Performance[] = [];
  allPerformancesSelected:boolean = true;
  parts: Part[] = [];
  recordings: Recording[] = [];
	partPerformances: PartPerformance[] = [];
	currentlyPlaying: PartPerformance = null;
	selectedPart: Part = null;
	selectedPerformance: Performance = null;
  playlistClips: Clip[] = [];
	showMap: boolean = false;
	countdownLevels: number[] = [5,4,3,2,1];
	showVideo: boolean = true;
	popout: Window;
  showApp:boolean = false;
  appUrl:SafeResourceUrl;
  messageSub:any;
  playlistCount:number = 0;
  editingPlaylistInfo:PlaylistInfo;
  editingPlaylist:Playlist;
  editingPlaylistItem:PlaylistItem;
  editingClip:Clip;
  
  constructor(
	private elRef:ElementRef,
    private recordsService: RecordsService,
    private route: ActivatedRoute,
    private location: Location,
    private renderer: Renderer2,
    private ngZone: NgZone,
    private linkappsService: LinkappsService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .subscribe((params:Params) => { if (params['popout']!==undefined) { this.popoutPlayer(); } } );
    this.route.params
      .switchMap((params: Params) => this.recordsService.getWork(params['id']))
      .subscribe(work => this.initialiseForWork(work));
    this.messageSub = this.linkappsService.getEmitter().subscribe((ev) => {
        if ('app.start'==ev.event) {
          console.log('got app.start...');
          this.updateApp();
        } else {
          console.log('unknown linkapps event', ev);
        }
    })
    this.appUrl = this.sanitizer.bypassSecurityTrustResourceUrl("http://localhost:8080/1/archive-muzivisual/?p=archive&archive=1");
  }
  ngOnDestroy(): void {
    // mainly for popout
    this.stop();
    this.messageSub.unsubscribe();
  }
  clickShowApp(): void {
    this.showApp = !this.showApp;
  }
  updateApp2(performance:Performance, stages:string[]) {
    var msg:any = {version: 'mrl-music.archive/1.0', event: 'play.update'};
    if (performance) {
      // performance title
      msg.performanceTitle = performance.label;
      msg.performanceId = performance.getValue("coll:system_id");
      if (performance.performers) {
        msg.performers = [];
        for (var pi in performance.performers) {
          // performer(s)
          var performer = performance.performers[pi];
          msg.performers.push(performer.label);
        }
      }
      // TODO venue -> label
      msg.venue = performance.getValue("crm:P7_took_place_at");
      // e.g."Place/Djanogly_Recital_Hall"
      //if (msg.venue.substring(0,6)=='Place/')
      //  msg.venue = msg.venue.substring(6);
      //msg.venue = msg.venue.replace('_', ' ');
    }
    msg.stages = stages;
    if (performance || stages) {
      console.log('update app', msg);
      try {
        this.appframe.nativeElement.contentWindow.postMessage(JSON.stringify(msg), "*");
      } catch (err) {
        console.log('error updating app window', err);
      }  
    }
  }
  updateApp(): void {
    if (this.currentlyPlaying) {
      // stages in this performance
      var stages:string[];
      if (!this.currentlyPlaying.isClip) {
        var parts = this.partPerformances.filter(pp => pp.performance===this.currentlyPlaying.performance &&
           pp.startTime<=this.currentlyPlaying.startTime)
          .sort((a,b)=>a.startTime-b.startTime).map(pp => pp.part.getValue("coll:part_id"));
        stages = parts;
      } else {
        var parts = this.partPerformances.filter(pp => pp.performance===this.currentlyPlaying.performance &&
           pp.playlistOffset<=this.currentlyPlaying.playlistOffset)
          .sort((a,b)=>a.playlistOffset-b.playlistOffset).map(pp => pp.part.getValue("coll:part_id"));
        stages = parts;
      }
      this.updateApp2(this.currentlyPlaying.performance, stages);
    } 
    else if (this.selectedPerformance) {
      this.updateApp2(this.selectedPerformance, []);
    }
  }
  popoutPlayer(): void {
    console.log('popout player');
    // Warning: not injected
    this.popout = window.open('', 'archive_player'); //,'archive_player'|'_blank' 'scrollbars=no,status=no,menubar=no,width=720,height=480');
    //data:text/html,<html><head><title>Explorer player</title></head><body><div>hello</div></body></html>
    let init = () => {
      if (!!this.popout.document.title) {
        console.log('popout window initialised already as '+this.popout.document.title);
        return;
      }
      console.log('initialise popout player window '+this.popout.document.title);
      this.popout.document.title = 'Archive Player Window';
      let css = 'video {\n width: 100%;\n height: auto;\n}\nvideo.hidden {\n display: none;\n}\nbody {\n background: black; \n}',
        head = this.popout.document.head || this.popout.document.getElementsByTagName('head')[0],
        style = this.popout.document.createElement('style');
      style.type = 'text/css';
      style.appendChild(document.createTextNode(css));
      head.appendChild(style); 
    }
    init();
    this.popout.addEventListener('load', init, true); 
  }
	initialiseForWork(work:Entity):void {
    console.log('initialiseForWork...');
		this.work = work; 
		this.showMap = !!work.getValue('coll:map_url');
		/* get all performances of work */
		this.recordsService.getPerformancesOfWork(work)
		.then(performances => {
			this.performances = performances
			.map(p => new Performance(p.fields))
			.sort((a,b) => a.compareTo(b, 'prov:startedAtTime'));
      console.log('got '+this.performances.length+' performances');
			/* then get all performers of each performance*/
      return Promise.all(this.performances.map(p => 
        this.recordsService.getPerformersOfPerformance(p)
        .then(performers => {
          console.log('got '+performers.length+' performers for '+p.label);
          p.performers = performers;
        })
      ))
		})
    .then(() => {
      /* then get all parts (members) of work */
      return this.recordsService.getMembers(work); 
    })
		.then(members => {
			this.parts = members
			.map(m => new Part(m.fields))
			.sort((a,b) => a.compareToNumber(b, 'coll:part_rank'));
      console.log('got '+this.parts.length+' parts')
			/* then get all recordings of each performance */
			return Promise.all(this.performances.map(p => 
				this.recordsService.getRecordingsOfPerformance(p)
				.then(recs => {
					p.recordings = recs.map(rec => new Recording(rec.fields, p));
					/* and the URLs for each performance */
					return Promise.all(p.recordings.map(r => 
						this.recordsService.getUrlsOfRecording(r).then(urls => r.setUrls(urls) )));
				})));
		})
		.then(() => {
      console.log('(hopefully) got associated recordings and urls');
			return Promise.all(this.performances.map(p =>
				this.recordsService.getSubEvents(p)
				.then((events) => {
					this.partPerformances = this.partPerformances.concat(
						events.map(ev => new PartPerformance(ev.fields, p, this.parts.find(p => 
							ev.getValues('frbroo:R25F_performed_r','frbroo:R25F_performed').indexOf(p.type_id+'/'+p.id)>=0)))
					);
          console.log('got '+events.length+' subevents for performance '+p.id+' -> '+this.partPerformances.length+' total part-performances');
				})
			))
		})
		.then(() => {
      console.log('after sub-events, get sub-sub-events');
			return Promise.all(this.partPerformances.map(pp =>
				this.recordsService.getSubEvents(pp)
				.then(subevents => 
					pp.subevents = subevents.map(subevent => new SubEvent(subevent.fields, pp))
				)
			))
		})
		.then(() => {
			console.log('loaded work to explore');
			this.buildAudioClips();
      this.buildPopularity();
            this.updateApp();
		});
	}
	
  goBack(): void {
    this.location.back();
  }
  
	setShowMap(value) {
		this.showMap = value;
	}
	setShowVideo(value) {
		this.pause();
		this.showVideo = value;
		this.partPerformances.forEach(pp => pp.clip = (this.showVideo ? pp.videoClip : pp.audioClip) );
		this.recordings.forEach(r => r.visible = r.isVideo==this.showVideo && (r.performance==this.selectedPerformance || (this.currentlyPlaying && this.currentlyPlaying.performance==r.performance)));
    this.checkPopoutMediaVisible();
		if (this.currentlyPlaying) {
			this.playInternal(this.currentlyPlaying.performance, this.currentlyPlaying.part);
		}
	}
	buildAudioClips() {
		for (var pi in this.performances) {
			let p = this.performances[pi];
			for (var video=0; video<2; video++) {
				let rec = p.recordings.find(r => r.isVideo==(video>0) && !!r.urls && r.urls.length>0);
				if (undefined===rec) {
					console.log('Note: no '+(video ? 'video' : 'audio')+' recording with url for performance '+p.label);
					continue;
				}
				this.recordings.push(rec);
			}
		}
    if(this.popout)
      this.createPopoutMedia();
		for (var pi in this.partPerformances) {
			let pp = this.partPerformances[pi];
			for (var video=0; video<2; video++) {
				// first recording for now
				let rec = this.recordings.find(r => r.isVideo==(video>0) && r.performance===pp.performance);
				if (undefined===rec) {
					console.log('Note: no '+(video ? 'video' : 'audio')+' recording with url for performance '+pp.label);
					continue;
				}
				let startTime = pp.startTime;
				let recStartTime = rec.startTime;
				// TODO end of last stage??
				let endTime = this.partPerformances.filter(p => p.performance===pp.performance && p.startTime > pp.startTime)
				.map(p => p.startTime).sort().find(() => true);
				let clip = new AudioClip(rec, startTime-recStartTime, endTime? endTime-startTime : null);
				console.log('part '+pp.id+' is '+clip.start+'+'+clip.duration);
        if (clip.duration && (!pp.duration || clip.duration < pp.duration))
          pp.duration = clip.duration;
				if (video) {
					pp.videoClip = clip;
					if (this.showVideo)
						pp.clip = pp.videoClip;
				}
				else {
					pp.audioClip = clip;
					if (!this.showVideo)
						pp.clip = clip;
				}
			}
		}
	}
  buildPopularity() {
    let maxPopularity = 0;
    this.parts.forEach(part => {
      part.popularity = this.partPerformances.filter(p => p.part===part).length;
      if (part.popularity > maxPopularity) {
        maxPopularity = part.popularity;
      }
    })
    this.parts.forEach(part => {
      part.popularity = part.popularity / maxPopularity;
      if (0==part.popularity) {
        part.heatmapColor = 'rgb(80,80,80)';
      } else {
        // blue to red 
        //part.heatmapColor = 'hsl('+(240+120*part.popularity+',100%,50%)');
        // yellow to red 
        part.heatmapColor = 'hsl('+(60-60*part.popularity+',100%,50%)');
      }
    });
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
  clickAllPerformancesCheckbox(event) {
    this.clickPerformanceCheckbox(event,null);
  }
  refreshSelectedPerformance() {
    if(!this.selectedPerformance) {
      if (!this.selectedPart) {
        for (var pi in this.parts) {
          let p = this.parts[pi];
          p.available = false;
          p.active = false;
        }
      }
      return;
    }
    for (var pi in this.parts) {
      let p = this.parts[pi];
      p.selected = false;
    }
    // clips?
    if (this.selectedPerformance.isPlaylist) {
      this.playlistClips = this.partPerformances.filter(pp => pp.performance === this.selectedPerformance && pp.isClip ).sort((a,b) => a.playlistOffset - b.playlistOffset) as Clip[];
    } else {
      this.playlistClips = [];
    }
    // available stages in this performance
    for (var pi in this.parts) {
      var part = this.parts[pi];
      part.available = !!this.partPerformances.find(pp =>  pp.performance === this.selectedPerformance && pp.part === part);
    }
    // TODO visible w playlist??
    //this.checkPopoutMediaVisible();
    this.updateApp();
  }
	clickPerformanceCheckbox(event,perf) {
    if (perf!==null) {
      console.log('select performance '+perf.id);
      this.allPerformancesSelected = false;
    } else {
      console.log('select all performances');
      this.allPerformancesSelected = true;
    }
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
		if (perf!==null && !perf.selected)
			perf.selected = true;
		this.selectedPerformance = perf;
    // clips?
    if (this.selectedPerformance.isPlaylist) {
      this.playlistClips = this.partPerformances.filter(pp => pp.performance === perf && pp.isClip ).sort((a,b) => a.playlistOffset - b.playlistOffset) as Clip[];
    } else {
      this.playlistClips = [];
    }
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
		if (!this.currentlyPlaying) {
      if (perf.isPlaylist) {
			  let pp = this.partPerformances.filter(p => p.performance === perf && p.isClip).sort((a,b) => a.playlistOffset - b.playlistOffset).find(p => true) as Clip;
        if (pp) {
          this.playInternal(perf, pp.part, pp);
        } else {
          this.recordings.forEach(r => r.visible = r.isVideo==this.showVideo && r.performance==perf);
        }
      }
      else {
        let part:Part = this.parts.find(p => p.available);
  		 	if (part) {
	  			this.playInternal(perf, part);
		  	} else {
			  	this.recordings.forEach(r => r.visible = r.isVideo==this.showVideo && r.performance==perf);
			  }
      }
		}
    this.checkPopoutMediaVisible();
    this.updateApp();
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
	clickMapPart(part) {
		console.log('clickMapPart('+part.id+')');
		if (part.available) {
			this.clickPartPlay(null, part);
		} else {
			this.clickPartCheckbox(null, part);
		}
	}
	getMedia() {
		var media = [];
    if (!!this.popout) {
      let audios = this.popout.document.body.getElementsByTagName('audio');
      let videos = this.popout.document.body.getElementsByTagName('video');
      for (var ai=0; ai<audios.length; ai++) {
        media.push(audios[ai]);
      }
      for (var ai=0; ai<videos.length; ai++) {
        media.push(videos[ai]);
      }
    }
		else if (!!this.elRef) {
			let audios = this.elRef.nativeElement.getElementsByTagName('audio');
			let videos = this.elRef.nativeElement.getElementsByTagName('video');
			for (var ai=0; ai<audios.length; ai++) {
				media.push(audios[ai]);
			}
			for (var ai=0; ai<videos.length; ai++) {
				media.push(videos[ai]);
			}
		}
		return media;
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
    this.playlistClips = [];
    this.allPerformancesSelected = false;
		if (!part.selected)
			part.selected = true;
		this.selectedPart = part;
		for (var pi in this.performances) {
			var performance = this.performances[pi];
			performance.available = !!this.partPerformances.find(pp => pp.performance === performance && pp.part === part);
		}
		if (this.currentlyPlaying) {
			if (this.currentlyPlaying.part!==part|| !this.currentlyPlaying.performance.available) {
				this.stop();
			}
			else
				this.currentlyPlaying.performance.active = true;
		}
		if (!this.currentlyPlaying) {
			var perf = this.performances.find(p => p.available);
		 	if (perf) {
				this.playInternal(perf, part);
			}
			else {
				this.recordings.forEach(r => r.visible = false );
			}
		}
    this.checkPopoutMediaVisible();
	}
	clickPartPlay(event,part) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		let perf = this.performances.find(p => p.selected);
		if (perf!==undefined) {
			this.playInternal(perf, part);
		}
	}
	playInternal(perf:Performance, part:Part, clip?:Clip) {
		console.log('play '+perf.id+' '+part.id+(clip ? ' clip at '+clip.startTime : ''));
		for (var pi in this.parts) {
			let p = this.parts[pi];
			p.active = p===part && !part.selected;
		}
		for (var pi in this.performances) {
			let p = this.performances[pi];
			p.active = p===perf && !perf.selected;
		}
		let wasPlaying = this.currentlyPlaying;
		this.currentlyPlaying = clip ? clip : this.partPerformances.find(pp => pp.performance===perf && pp.part===part);
		this.currentlyPlaying.subevents.map(ev => ev.clear());
    
    for (var ppi in this.partPerformances) {
      let pp = this.partPerformances[ppi];
      if (pp.isClip) {
        let clip = pp as Clip;
        clip.active = clip === this.currentlyPlaying;
      }
    }
    
		//console.log('elRef',this.elRef);
    let realPerf = this.currentlyPlaying.isClip ? this.currentlyPlaying.realPerformance : perf;
		let rec = this.recordings.find(r => r.isVideo==this.showVideo && r.performance===realPerf);
		if (!rec) {
			console.log('no '+(this.showVideo ? 'video' : 'audio')+' recording for performance '+realPerf.id);
		}
		this.recordings.forEach(r => r.visible = r==rec );
    this.checkPopoutMediaVisible();
		if (!!this.elRef) {
			let media = this.getMedia();
			for (var ai=0; ai<media.length; ai++) {
				let audio = media[ai];
				console.log('media '+ai+'/'+media.length+': '+(!!rec ? rec.id : '(none)')+' vs '+audio.id, audio);
				if (!!rec && audio.id==rec.id) {
					rec.shouldplay = true;
					console.log('media '+ai+' visible!');
					// start time...
					var partOffset = 0;
					if (!!wasPlaying && wasPlaying.part===part && wasPlaying!==this.currentlyPlaying && !clip) {
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
					audio.play();
				} else {
					audio.pause();
				}
			}
		}
        this.updateApp();
	}
	stop() {
		if (this.currentlyPlaying) {
			this.currentlyPlaying.part.active = false;
			this.currentlyPlaying.performance.active = false;
		}
		this.pause();
		this.currentlyPlaying = null;
        this.updateApp();
	}
	audioTimeupdate(event,rec) {
		console.log('timeupdate '+rec.id+' '+event.target.currentTime);
		rec.lastTime = event.target.currentTime;
		if (!!this.currentlyPlaying && this.currentlyPlaying.clip && this.currentlyPlaying.clip.recording===rec) {
			let offset = rec.lastTime+rec.startTime-this.currentlyPlaying.startTime;
			this.currentlyPlaying.setCurrentTime(offset);
			this.currentlyPlaying.subevents.map(ev => ev.setAbsTime(rec.lastTime+rec.startTime));
			if (this.currentlyPlaying.performance.selected && !this.currentlyPlaying.isClip) {
				// check best clip...
				let nextPp = this.partPerformances.filter(pp=>pp.performance===this.currentlyPlaying.performance
					&& (!pp.duration || pp.startTime+pp.duration-0.1>rec.lastTime+rec.startTime))
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
					this.currentlyPlaying.subevents.map(ev => ev.setAbsTime(rec.lastTime+rec.startTime));
                    this.updateApp();
				}
			}
      else if (this.currentlyPlaying.performance.selected && this.currentlyPlaying.isClip) {
        // playlist
        let playlistTime = this.currentlyPlaying.playlistOffset + rec.lastTime+rec.startTime - this.currentlyPlaying.startTime;
        console.log('playlist time now '+playlistTime);
        let nextPp = this.partPerformances.filter(pp=>pp.performance===this.currentlyPlaying.performance
          && (!pp.duration || pp.playlistOffset+pp.duration-0.1>playlistTime))
          .sort((a,b)=>a.playlistOffset-b.playlistOffset).find(()=>true);
        this.partPerformances.filter(pp=>pp.performance===this.currentlyPlaying.performance)
           .forEach(pp => console.log(`- clip ${pp.id} plo ${pp.playlistOffset} dir ${pp.duration}`))
        if (!nextPp) {
          console.log('no valid clip to play');
          this.pause();
          let maxTime = this.currentlyPlaying.startTime+ (this.currentlyPlaying.duration ? this.currentlyPlaying.duration : 0) - rec.startTime;
          if (rec.lastTime > maxTime + 0.1)
            event.target.currentTime = maxTime;
        } else if (nextPp!==this.currentlyPlaying) {
          console.log('change clip to +'+nextPp.playlistOffset);
          this.playInternal(nextPp.performance, nextPp.part, nextPp as Clip);
        } else if (playlistTime<-0.1) {
          console.log(`skip to start from ${playlistTime}`);
          event.target.currentTime = nextPp.startTime - rec.startTime;
        }
      }
			else if (this.currentlyPlaying.part.selected) {
				if (this.currentlyPlaying.duration && offset > this.currentlyPlaying.duration) {
					// pause
					this.pause();
					event.target.currentTime = this.currentlyPlaying.startTime-rec.startTime;
				} else if (offset < -0.5) {
					// (significantly) before clip?!
					event.target.currentTime = rec.lastTime-offset;
				}
			}
		}
	}
	audioEnded(event,rec) {
		console.log('ended '+rec.id);
		this.pause();
		event.target.currentTime = 0;
	}
	audioCanplay(event,rec) {
		console.log('canplay '+rec.id);
		rec.canplay = true;
    let duration = event.target.duration;
    if (!rec.duration) {
      rec.duration = duration;
      this.partPerformances.forEach(pp => {
        if (pp.audioClip.recording===rec && !pp.audioClip.duration) {
          pp.audioClip.duration = duration-pp.audioClip.start;
          if (!pp.duration || pp.duration > pp.audioClip.duration)
            pp.duration = pp.audioClip.duration;
          console.log(`fix duration of audioclip ${pp.id} ${pp.performance.id} ${pp.part.id} as ${pp.audioClip.duration}`);
        }
        if (pp.videoClip.recording===rec && !pp.videoClip.duration) {
          pp.videoClip.duration = duration-pp.videoClip.start;
          if (!pp.duration || pp.duration > pp.videoClip.duration)
            pp.duration = pp.videoClip.duration;
          console.log(`fix duration of videoclip ${pp.id} ${pp.performance.id} ${pp.part.id} as ${pp.videoClip.duration}`);
        }
      })
    }
		// shouldn't be needed?!
		if (rec.shouldplay) {
			console.log('play '+rec.id+' on canplay');
			event.target.play();
		}
	}
	audioSeeked(event,rec) {
		console.log('seeked '+rec.id);
	}
	play() {
		if (!!this.currentlyPlaying && !this.currentlyPlaying.clip.recording.shouldplay) {
			this.currentlyPlaying.clip.recording.shouldplay = true;
			if (!!this.elRef) {
				let audios = this.getMedia();
				for (var ai=0; ai<audios.length; ai++) {
					let audio = audios[ai];
					if (audio.id==this.currentlyPlaying.clip.recording.id) {
						this.currentlyPlaying.clip.recording.shouldplay = true;
						audio.play();
					}
				}
			}
		}
	}
	pause() {		if (this.currentlyPlaying) {
			if (!!this.elRef) {
				let audios = this.getMedia();
				for (var ai=0; ai<audios.length; ai++) {
					let audio = audios[ai];
					audio.pause();
				}
			}
			this.recordings.forEach(r => r.shouldplay = false);
		}
	}
	getAudio(rec:Recording) {
    if (!!this.popout) {
      let audios = rec.isVideo ? this.popout.document.body.getElementsByTagName('video') :
        this.popout.document.body.getElementsByTagName('audio');
      for (var ai=0; ai<audios.length; ai++) {
        let audio = audios[ai];
        console.log('audio '+ai+'/'+audios.length+':', audio);
        if (!!rec && audio.id==rec.id) {
          return audio;
        }
      }
    }
		else if (!!this.elRef) {
			let audios = rec.isVideo ? this.elRef.nativeElement.getElementsByTagName('video') :
				this.elRef.nativeElement.getElementsByTagName('audio');
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
        let pp = this.currentlyPlaying.isClip 
         ? this.partPerformances.filter(pp=>pp.performance===this.currentlyPlaying.performance && 
          pp.playlistOffset>this.currentlyPlaying.playlistOffset).sort((a,b)=>a.playlistOffset-b.playlistOffset).find(()=>true)
				 : this.partPerformances.filter(pp=>pp.performance===this.currentlyPlaying.performance && 
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
				let pp = this.currentlyPlaying.isClip 
          ? this.partPerformances.filter(pp=>pp.performance===this.currentlyPlaying.performance && 
          pp.playlistOffset<this.currentlyPlaying.playlistOffset).sort((a,b)=>b.playlistOffset-a.playlistOffset).find(()=>true)
          : this.partPerformances.filter(pp=>pp.performance===this.currentlyPlaying.performance && 
					pp.startTime<this.currentlyPlaying.startTime).sort((a,b)=>b.startTime-a.startTime).find(()=>true);
				if (!!pp)
					this.playInternal(pp.performance, pp.part);
			}
		}
	}
	playSubevent(subevent) {
		if (!!this.currentlyPlaying) {
			let audio = this.getAudio(this.currentlyPlaying.clip.recording);
			if (!!audio) {
				var time = subevent.startTime - this.currentlyPlaying.clip.recording.startTime - 3;
				console.log('seek to subevent '+subevent.startTime+' => '+time);
				if (time<0)
					time = 0;
				if (audio.duration!=0 && time>audio.duration) {
					this.pause();
					audio.currentTime = audio.duration;
				}
				else
					audio.currentTime = time;
			}
		}
	}
  addPopoutVideo(rec:Recording) {
    let parent = this.popout.document.body;
    let video = this.popout.document.createElement('video');
    video.setAttribute('id', rec.id);
    //video.setAttribute('controls', 'true');
    this.renderer.listen(video, 'canplay', (event) => this.ngZone.run(() => this.audioCanplay(event, rec)));
    this.renderer.listen(video, 'seeked', (event) => this.ngZone.run(() => this.audioSeeked(event, rec)));
    this.renderer.listen(video, 'timeupdate', (event) => this.ngZone.run(() => this.audioTimeupdate(event, rec)));
    this.renderer.listen(video, 'ended', (event) => this.ngZone.run(() => this.audioEnded(event, rec)));
    //video.addEventListener('canplay', (event) => {console.log(`popout canplay ${rec.id}`)});
    let url = this.popout.document.createElement('source');
    url.setAttribute('src', rec.urls[0]);
    url.setAttribute('type', 'video/mp4');
    video.appendChild(url);
    parent.appendChild(video);
    
  }
  createPopoutMedia() {
    console.log('create popout media...');
/*
    let parent = this.popout.document.body;
    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }
    for (let rec of this.recordings) {
      if (rec.isVideo) {
        this.addPopoutVideo(rec);
      }
    }
*/
    this.checkPopoutMediaVisible();
  }
  checkPopoutMediaVisible() {
    if (!this.popout)
      return;

    for (let rec of this.recordings) {
      let video = this.popout.document.getElementById(rec.id);
      if (!!video) {
        //video.className = rec.visible ? '' : 'hidden';
        // make / remove - only one visible
        if (!rec.visible) {
          try {
            // https://stackoverflow.com/questions/28105950/html5-video-stalled-event
            // clear src and load??
            (video as HTMLVideoElement).pause();
            let srcs = video.getElementsByTagName('source');
            for (let si=0; si<srcs.length; si++) {
              let src = srcs.item(si);
              src.setAttribute('src', '');
            }
            if (srcs.length===0) {
              console.log('could not find source element in video (to stop)');
            }
            (video as HTMLVideoElement).load();
          }
          catch (err) {
            console.log('Error removing video: '+err.message, err);
          }
          video.remove();
        }
      } else if (rec.visible) {
        // create
        this.addPopoutVideo(rec);
      }
    }
  }
  clickPlaylistAdd(ev) {
    this.performances.push(new Playlist('Playlist '+(++this.playlistCount)));
  }
  dragPartPerformance(ev, pp: PartPerformance) {
    console.log('drag pp '+pp.performance.id+' '+pp.part.id);
    ev.dataTransfer.setData(DRAG_AND_DROP_MIME_TYPE,JSON.stringify({type:'PartPerformance',part:pp.part.id,performance:pp.performance.id}))
  }
  dragPart(ev, part: Part) {
    let pp = this.partPerformances.find(pp => pp.part === part && pp.performance.selected);
    if (!pp) {
      console.log('no part performance found');
      return;
    }
    this.dragPartPerformance(ev, pp);
  }
  dragoverPerformance(ev, pp:Performance) {
    if (!pp.isPlaylist)
      return;
    ev.preventDefault();
  }
  playlistAddPartPerformance(playlist:Playlist, part:string,performance:string, title?:string, startTime?:number, endTime?:number): Clip {
      let pp = this.partPerformances.find(pp => pp.part.id == part && pp.performance.id == performance);
      if (!pp) {
        console.log('error: could not locate part performance '+performance+' '+part);
        return;
      }
      let clip = new Clip(playlist, pp);
      if (title)
        clip.label = title;
      else {
        clip.label = pp.part.label+' from '+pp.performance.label;
        if (pp.performance.performers && pp.performance.performers.length>0) {
          clip.label += ' by ';
          for (var pi=0; pi<pp.performance.performers.length; pi++) {
            let p = pp.performance.performers[pi];
            if (pi>0)
              clip.label += ', ';
            clip.label += p.label;
          }
        }
      }
      this.fixClipStartTimeAndDuration(clip, startTime, endTime);
      // duration so far
      let duration = this.partPerformances.filter(pp => pp.playlist === playlist).map(pp => pp.videoClip ? pp.duration : 0).reduce((a,b)=> a+b, 0);
      console.log('total duration was '+duration+' + '+clip.duration);
      clip.playlistOffset = duration;
      this.partPerformances.push(clip);
      return clip;
  }
  dropOnPerformance(ev, pp:Performance) {
    if (!pp.isPlaylist) {
      console.log('error: drop on non-playlist');
      return;
    }
    let playlist = pp as Playlist;
    ev.preventDefault();
    let data = ev.dataTransfer.getData(DRAG_AND_DROP_MIME_TYPE);
    console.log('Drop:', data);
    if (!data)
      return;
    let info = JSON.parse(data);
    if ('PartPerformance'==info.type) {
      this.playlistAddPartPerformance(playlist, info.part, info.performance);
      playlist.showFeedback('Added');
    }
    else if ('Clip'==info.type) {
      // handle Clip drop
      // id, part, performance
      if (!info.id || !info.part || !info.performance) {
        console.log('error: ill-formed Clip dropped', info);
        return;
      }
      let clip = this.playlistClips.find(c => c.id == info.id);
      if (!clip) {
        console.log(`error, could not find dropped clip ${info.id}`);
        return;
      }
      let newclip = this.playlistAddPartPerformance(playlist, info.part, info.performance, info.title, info.startTime, info.endTime);
      playlist.showFeedback('Added');
    }
    if (this.selectedPerformance === pp)
      this.refreshSelectedPerformance();
  }
  clickClipPlay(ev,clip:Clip) {
    this.playInternal(clip.playlist, clip.part, clip);
  }
  dragClip(ev,clip:Clip) {
    // TODO playlist ID?
    ev.dataTransfer.setData(DRAG_AND_DROP_MIME_TYPE,JSON.stringify({
      type:'Clip',id:clip.id,part:clip.part.id,performance:clip.realPerformance.id,title:clip.label,
      startTime: Math.abs(clip.startTime-clip.realPartPerformance.startTime)>0.01 ? clip.startTime-clip.realPartPerformance.startTime : null,
      endTime: Math.abs(clip.startTime+clip.duration-(clip.realPartPerformance.startTime+clip.realPartPerformance.duration))>0.01 ?
        clip.startTime+clip.duration-clip.realPartPerformance.startTime : null      
    }))
  }
  dragoverClip(ev, clip:Clip) {
    ev.preventDefault();
  }
  dropOnClip(ev,clip:Clip) {
    ev.preventDefault();
    let data = ev.dataTransfer.getData(DRAG_AND_DROP_MIME_TYPE);
    console.log('Drop:', data);
    if (!data)
      return;
    let info = JSON.parse(data);
    if ('PartPerformance'==info.type) {
      //this.playlistAddPartPerformance(playlist, info.part, info.performance);
      // shouldn't happen!
      console.log('error, PartPerformance drop on Clip');
      return;
    }
    else if ('Clip'==info.type) {
      // handle Clip drop
      // id, part, performance
      if (!info.id || !info.part || !info.performance) {
        console.log('error: ill-formed Clip dropped', info);
        return;
      }
      // should be re-ordering with current playlist
      let clipIds = this.playlistClips.map(c => c.id);
      let targetIx = clipIds.indexOf(clip.id);
      if (targetIx<0) {
        console.log(`error: target clip ${clip.id} not found in current list`);
        return;
      }
      let fromIx = clipIds.indexOf(info.id);
      if (fromIx<0) {
        console.log(`error: dropped clip ${info.id} not found in current list`);
        return;
      }
      console.log(`move clip from ${fromIx} to ${targetIx}`)
      if (fromIx==targetIx)
        return;
      let fromClip = this.playlistClips[fromIx];
      this.playlistClips.splice(fromIx, 1);
      if (targetIx>=fromIx)
        targetIx--;
      this.playlistClips.splice(targetIx, 0, fromClip);
      let playlistOffset = 0;
      for (let ci=0; ci<this.playlistClips.length; ci++) {
        let c = this.playlistClips[ci];
        c.playlistOffset = playlistOffset;
        if (!c.duration || c.duration<=0) {
          console.log(`warning, clip ${ci} has duration ${c.duration}`)
        }
        playlistOffset += c.duration;
      }
      this.refreshSelectedPerformance();
    }
  }
  editPlaylist($event,playlist:Playlist) {
    console.log('edit playlist', playlist);
    this.editingPlaylist = playlist;
    this.editingPlaylistInfo = { title: playlist.label }
    this.editingPlaylistInfo.items = [];
    let items = this.partPerformances.filter(pp => pp.playlist === this.editingPlaylist && pp.isClip).sort((a,b) => a.playlistOffset - b.playlistOffset);
    for (let ii in items) {
      let item = items[ii] as Clip;
      let itemInfo : PlaylistItem = {title: item.label, performance: item.realPerformance.id, part: item.part.id};
      // copy startTime & endTime
      if (Math.abs(item.startTime - item.realPartPerformance.startTime) > 0.01) {
        itemInfo.startTime = item.startTime - item.realPartPerformance.startTime;
      }
      if (Math.abs(item.startTime + item.duration - (item.realPartPerformance.startTime+item.realPartPerformance.duration)) > 0.01) {
        itemInfo.endTime = item.startTime + item.duration - item.realPartPerformance.startTime;
      }
      this.editingPlaylistInfo.items.push(itemInfo);
    }
  }
  deletePlaylistClips(playlist:Playlist) {
      for (var ii=0; ii<this.partPerformances.length; ii++) {
        let item = this.partPerformances[ii];
        if (item.playlist === playlist) {
          this.partPerformances.splice(ii,1);
          ii--;
        }
      }
  }
  saveEditingPlaylistInternal(info:PlaylistInfo) {
    if (this.editingPlaylist.selected) {
      this.stop();
    }
    if (this.editingPlaylist) {
      this.editingPlaylist.label = info.title;
      //let items = this.partPerformances.filter(pp => pp.playlist === this.editingPlaylist).sort((a,b) => a.playlistOffset - b.playlistOffset);
      this.deletePlaylistClips(this.editingPlaylist);
      for (var ix in info.items) {
        let item = info.items[ix];
        this.playlistAddPartPerformance(this.editingPlaylist, item.part, item.performance, item.title, item.startTime, item.endTime);
      }
      this.fixPlaylistOffsets(this.editingPlaylist);
      if (this.editingPlaylist.selected) {
        this.refreshSelectedPerformance();
      }
    }
  }
  saveEditingPlaylist(info:PlaylistInfo) {
    console.log('save editing playlist', info);
    this.saveEditingPlaylistInternal(info);
    this.cancelEditingPlaylist();
  }
  cancelEditingPlaylist() {
    this.editingPlaylistInfo = null;
    this.editingPlaylist = null;
  }
  deleteEditingPlaylist() {
    if (!this.editingPlaylist)
      return;
    this.deletePlaylistClips(this.editingPlaylist);
    for (var pi=0; pi<this.performances.length; pi++) {
      let perf = this.performances[pi];
      if (perf === this.editingPlaylist) {
        this.performances.splice(pi,1);
        pi = pi-1;
      }
    }
    if (this.selectedPerformance=== this.editingPlaylist) {
      this.selectedPerformance = null;
      this.playlistClips = [];
    }
    this.cancelEditingPlaylist();
    this.refreshSelectedPerformance();
  }
  exportEditingPlaylist(info:PlaylistInfo) {
    this.saveEditingPlaylistInternal(info);
    if (this.editingPlaylist) {
      console.log('export playlist',info);
      let data = JSON.stringify(info, null, 4);
      let blob = new Blob([data], {
            type: "application/json"
        });
      FileSaver.saveAs(blob, "playlist "+info.title+".json");
    }
    this.cancelEditingPlaylist();
  }   
  editPlaylistItem($event,clip:Clip) {
    console.log('edit clip', clip);
    this.editingClip = clip;
    this.editingPlaylistItem = { title: clip.label, performance: clip.realPerformance.id, part: clip.part.id }
    // copy startTime endTime
    if (Math.abs(this.editingClip.startTime - this.editingClip.realPartPerformance.startTime) > 0.01) {
      this.editingPlaylistItem.startTime = this.editingClip.startTime - this.editingClip.realPartPerformance.startTime;
    }
    if (Math.abs(this.editingClip.startTime +this.editingClip.duration - (this.editingClip.realPartPerformance.startTime + this.editingClip.realPartPerformance.duration)) > 0.01) {
      this.editingPlaylistItem.endTime = this.editingClip.startTime +this.editingClip.duration - this.editingClip.realPartPerformance.startTime;
    }
    this.pause();
    if (this.currentlyPlaying === clip && clip.clip.recording) {
      // audio or video?
      if (this.showVideo)
        this.editingPlaylistItem.currentTime = clip.videoClip.recording.lastTime - clip.realPartPerformance.videoClip.start;
      else
        this.editingPlaylistItem.currentTime = clip.audioClip.recording.lastTime - clip.realPartPerformance.audioClip.start;
    }
  }
  fixClipStartTimeAndDuration(clip:Clip, startTime?:number, endTime?:number) {
    // set start time
    if (!startTime || startTime<0)
      startTime = 0;
    if (startTime > clip.realPartPerformance.duration)
      startTime = clip.realPartPerformance.duration;
    if (!endTime || endTime > clip.realPartPerformance.duration)
      endTime = clip.realPartPerformance.duration;
    if (endTime<startTime)
      endTime = startTime;
    clip.hasStartOffset = Math.abs(startTime) > 0.01;
    clip.hasEndOffset = Math.abs(endTime - clip.realPartPerformance.duration) > 0.01;
    clip.startTime = clip.realPartPerformance.startTime+startTime;
    let duration = endTime - startTime;
    clip.duration = duration;
    //console.log(`clip startTime = ${this.editingClip}`)
    if (clip.videoClip && clip.realPartPerformance.videoClip) {
      clip.videoClip.start = clip.realPartPerformance.videoClip.start + startTime;
      clip.videoClip.duration = duration;
    }
    if (clip.audioClip && clip.realPartPerformance.audioClip) {
      clip.audioClip.start = clip.realPartPerformance.audioClip.start + startTime;
      clip.audioClip.duration = duration;
    }
    if (clip.clip && clip.realPartPerformance.clip) {
      clip.clip.start = clip.realPartPerformance.clip.start + startTime;
      clip.clip.duration = duration;
    }

  }
  saveEditingPlaylistItem(info:PlaylistItem) {
    console.log('save editing playlist item', info);
    if (!this.editingClip)
      return;
    this.editingClip.label = info.title;
    this.fixClipStartTimeAndDuration(this.editingClip, info.startTime, info.endTime);
    this.fixPlaylistOffsets(this.editingClip.performance);
    this.cancelEditingPlaylistItem();
  }
  cancelEditingPlaylistItem() {
    this.editingPlaylistItem = null;
    this.editingClip = null;
  }
  deleteEditingPlaylistItem() {
    if (!this.editingClip)
      return;
    
    for (var ii=0; ii<this.partPerformances.length; ii++) {
      let item = this.partPerformances[ii];
      if (item === this.editingClip) {
        this.partPerformances.splice(ii,1);
        ii--;
      }
    }
    if (this.selectedPerformance=== this.editingPlaylist) {
      for (var ii=0; ii<this.playlistClips.length; ii++) {
        let item = this.playlistClips[ii];
        if (item === this.editingClip) {
          this.playlistClips.splice(ii, 1);
          ii--;
        }
      }
    }
    this.fixPlaylistOffsets(this.editingClip.performance)
    if (this.currentlyPlaying === this.editingClip)
      this.stop();
    this.cancelEditingPlaylistItem();
    this.refreshSelectedPerformance();
  }
  fixPlaylistOffsets(performance:Performance) {
    // times...
    let otherClips = this.partPerformances.filter(pp => pp.performance === performance && pp.isClip)
      .sort((a,b) => a.playlistOffset - b.playlistOffset);
    let playlistOffset = 0;
    for (let ci=0; ci<otherClips.length; ci++) {
      let c = otherClips[ci];
      c.playlistOffset = playlistOffset;
      if (!c.duration || c.duration<=0) {
        console.log(`warning, clip ${ci} has duration ${c.duration}`)
      }
      playlistOffset += c.duration;
    }
  }
}

