import { Component, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PlaylistInfo } from './types';

@Component({
  selector: 'playlist-form',
  templateUrl: './playlist-form.component.html',
  styleUrls: ['./playlist-form.component.css']
})
export class PlaylistFormComponent implements OnChanges  {
  @Input() playlist: PlaylistInfo;
  @Input() disabled: boolean;
  @Output() save: EventEmitter<PlaylistInfo> = new EventEmitter();
  @Output() cancel: EventEmitter<any> = new EventEmitter();
  @Output() dodelete: EventEmitter<any> = new EventEmitter();
  @Output() doexport: EventEmitter<PlaylistInfo> = new EventEmitter();
  form: FormGroup
  file: File

  
  constructor(
    private fb: FormBuilder
  ) { 
    this.createForm();
  }
  createForm() { 
    this.form = this.fb.group({
      title: ['', Validators.required ],
      file: [''],
     });
  }
  ngOnChanges() {
    this.rebuildForm();
    if (this.disabled)
      this.form.disable();
    else
      this.form.enable();
  }
  rebuildForm() {
    console.log('rebuild form', this.playlist);
    this.form.reset(this.playlist);
  }
  fileUpdated($event) {
    const files = $event.target.files || $event.srcElement.files;
    this.file = files[0];
    console.log('change file', this.file);
    var reader = new FileReader();
    reader.addEventListener("loadend", () => {
      // reader.result contains the contents of blob as a typed array
      let text = reader.result;
      try {
        let info:PlaylistInfo = JSON.parse(text) as PlaylistInfo;
        if (info.title===undefined || info.items===undefined) {
          console.log('does not resemble playlist',info);
          alert('Sorry, that does not seem to be a valid playlist');
        }
        console.log('read playlist', info);
        this.playlist = info;
        this.rebuildForm();
      } catch(err) {
        console.log('error parsing file as json',err);
        alert('Sorry, that does not seem to be a valid playlist');
      }
    });
    reader.readAsText(this.file);
  }
  onSubmit() {
    this.playlist = this.prepareSavePlaylist()
    this.rebuildForm();
    this.save.emit(this.playlist);
  }
  prepareSavePlaylist(): PlaylistInfo {
    const formModel = this.form.value;
    const savePlaylist:PlaylistInfo = {
      title: formModel.title,
      items: this.playlist.items,
    }
    return savePlaylist;
  }
  revert() {
    this.rebuildForm();
    this.cancel.emit(null);
  }
  onDelete() {
    this.dodelete.emit(null);
  }
  onExport() {
    let playlist = this.prepareSavePlaylist()
    this.doexport.emit(playlist);
  }
}