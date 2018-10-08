import { Component, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PlaylistItem } from './types';

@Component({
  selector: 'playlist-item-form',
  templateUrl: './playlist-item-form.component.html',
  styleUrls: ['./playlist-form.component.css']
})
export class PlaylistItemFormComponent implements OnChanges  {
  @Input() item: PlaylistItem;
  @Input() disabled: boolean;
  @Output() save: EventEmitter<PlaylistItem> = new EventEmitter();
  @Output() cancel: EventEmitter<any> = new EventEmitter();
  @Output() dodelete: EventEmitter<any> = new EventEmitter();
  form: FormGroup

  
  constructor(
    private fb: FormBuilder
  ) { 
    this.createForm();
  }
  createForm() { 
    this.form = this.fb.group({
      title: ['', Validators.required ],
      startTime: [''],
      endTime: [''],
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
    console.log('rebuild form', this.item);
    this.form.reset(this.item);
  }
  onSubmit() {
    this.item = this.prepareSaveItem()
    this.rebuildForm();
    this.save.emit(this.item);
  }
  prepareSaveItem(): PlaylistItem {
    const formModel = this.form.value;
    const saveItem:PlaylistItem = {
      title: formModel.title,
      performance: this.item.performance,
      part: this.item.part,
      startTime: (formModel.startTime ? Number(formModel.startTime) : null),
      endTime: (formModel.endTime ? Number(formModel.endTime) : null),
    }
    return saveItem;
  }
  revert() {
    this.rebuildForm();
    this.cancel.emit(null);
  }
  onDelete() {
    this.dodelete.emit(null);
  }
  resetStartTime() {
    this.form.get('startTime').setValue(null);
  }
  setStartTime() {
    this.form.get('startTime').setValue(this.item.currentTime);
  }
  resetEndTime() {
    this.form.get('endTime').setValue(null);
  }
  setEndTime() {
    this.form.get('endTime').setValue(this.item.currentTime);
  }
}