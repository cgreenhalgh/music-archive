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
  
  constructor(
    private fb: FormBuilder
  ) { 
    this.createForm();
  }
  createForm() { 
    this.form = this.fb.group({
      title: ['', Validators.required ],
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
  onSubmit() {
    this.playlist = this.prepareSavePlaylist()
    this.rebuildForm();
    this.save.emit(this.playlist);
  }
  prepareSavePlaylist(): PlaylistInfo {
    const formModel = this.form.value;
    const savePlaylist:PlaylistInfo = {
      title: formModel.title,
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