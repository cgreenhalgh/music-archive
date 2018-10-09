import { Injectable, EventEmitter } from '@angular/core';
//import { RTCPeerConnection } from 'webrtc';

@Injectable()
export class LinkappsService {
	app:Window;
    messageEmitter:EventEmitter<any> = new EventEmitter();
    meldWindow:Window;

	constructor() {
		console.log('created LinkappsService')
		window.addEventListener('message', (ev) => this.onMessage(ev))
	}
	onMessage(ev:MessageEvent) {
		console.log('window message: ', ev)
		if (typeof ev.data =='string') {
			let msg = JSON.parse(ev.data)
			if ('mrl-music.archive/1.0'!=msg.version) {
				console.log('ignore window message with no/wrong version: ', ev.data)
				return
			}
            this.messageEmitter.emit(msg);
		}
	}
    getEmitter(): EventEmitter<any> {
        return this.messageEmitter;
    }
    openMeld() {
        console.log('open meld');
        this.meldWindow = window.open('http://localhost:8080/archive', 'meldwindow', null); 
    }
    meldPartPerformance(partid:string, performanceid:string) {
        if (!this.meldWindow)
            return;
        if (!performanceid)
          return;
        if (partid) {
          partid = partid.replace('Climb_', '');
        }
        else {
          partid = 'basecamp';
        }
        console.log(`set meld part ${partid} performance ${performanceid}`);
        // avoid: race
        //this.meldWindow.postMessage({type: "performance", payload:performanceid}, "*"); 
        //this.meldWindow.postMessage({type: "fragment", payload:partid}, "*");
        this.meldWindow = window.open('http://localhost:8080/archive?perf='+encodeURIComponent(performanceid)+'&frag='+encodeURIComponent(partid), 'meldwindow', null); 
    }
//	openApp():void {
//		console.log('open app window')
//		this.app = window.open('http://localhost:8080/1/archive-muzivisual/', 'archive-muzivisual');
//	}

/*
    // Create peer connections and add behavior.
    let peerConnection = new RTCPeerConnection({iceServers:[]});
    console.log('Created peer connection object.');

    window.addEventListener('message', (ev) => {
      console.log('on message: '+ev.data)
      if (typeof ev.data =='string') {
        let msg = JSON.parse(ev.data)
        if (msg.iceCandidate) {
          console.log('received ice candidate!')
          if(!peerConnection.remoteDescription.type)
            console.log('warning: remoteDescription type null')
          peerConnection.addIceCandidate(msg.iceCandidate)
          .catch((err) => {
            console.log('error add ice candidate '+ev.data, err)
          })
        }
        if (msg.remoteDescription) {
          console.log('received remote description!')
          peerConnection.setRemoteDescription(msg.remoteDescription)
          .catch((err) => {
            console.log('error add remote description '+ev.data, err)
          })
        }
      }
    })

    peerConnection.addEventListener('icecandidate', function(ev) {
      //console.log('icecandidate', ev);
      const peerConnection = ev.target;
      const iceCandidate = ev.candidate;

      if (iceCandidate) {
        //const newIceCandidate = new RTCIceCandidate(iceCandidate);
        console.log('ice candidate: '+JSON.stringify(iceCandidate));
        // send to app window
        let data = JSON.stringify({iceCandidate:iceCandidate});
        app.postMessage(data, '*');
        console.log('sent window message '+data);
      }
    });
    peerConnection.addEventListener('iceconnectionstatechange', function(ev) {
      // event.target
      console.log('ICE state change event: ', ev);
    });
    
    // single fixed id and name (=[out of band] negotiated)
    // Note: typescript error unknown createDataChannel
    let channel = (peerConnection as any).createDataChannel('linkapps', {ordered:true})//, negotiated:true, id:123
    channel.onopen = function(event) {
      console.log('channel open');
      channel.send('Hi you 2!');
    };
    channel.onmessage = function(event) {
      console.log('channel onmessage: ', event.data);
    };
    // Note: typescript error expects old arguments with success callback first
    // on negotiation needed - see https://www.w3.org/TR/webrtc/#simple-peer-to-peer-example
    peerConnection.createOffer(function(sessionDesc) {
      console.log('created offer', sessionDesc)
      peerConnection.setLocalDescription(sessionDesc);
      //peerConnection.setRemoteDescription(sessionDesc);
      let data = JSON.stringify({remoteDescription:sessionDesc})
      app.postMessage(data, '*')
    }, function(err) {
      console.log('error creating offer', err);
    });
*/
}
