import 'rxjs/add/operator/switchMap';
import { Component, OnInit, OnChanges, Input, SimpleChange }      from '@angular/core';

import { Entity } from './entity';
import { RecordsService }  from './records.service';

@Component({
  selector: 'work-detail',
  templateUrl: './work-detail.component.html'
})
export class WorkDetailComponent implements OnInit, OnChanges {
	@Input() id: string
  work: Entity;
  performances: Entity[] = [];
  parts: Entity[] = [];
  composers: Entity[] = [];

  constructor(
    private recordsService: RecordsService,
  ) {}

  ngOnInit(): void {
  }
  stripAnchors(html:string): string {
  	if (!html)
  		return html
  	return html.replace(/<a [^>]*>/g, '').replace(/<\\a>/g, '')
  }
  ngOnChanges(changes: {[propKey: string]: SimpleChange}) {
  	if (changes['id'] && changes['id'].currentValue) {
  		console.log(`work detail view for ${changes['id'].currentValue}`, changes)
  		this.recordsService.getWork(changes['id'].currentValue)
      .then(work => { this.work = work; 
        this.work.description = this.stripAnchors(this.work.description)
        this.recordsService.getPerformancesOfWork(work)
        .then(performances => this.performances = performances
          .sort((a,b) => a.compareTo(b, 'prov:startedAtTime')));
        this.recordsService.getMembers(work)
        .then(members => this.parts = members
          .sort((a,b) => a.compareTo(b, 'coll:part_rank')));
        this.recordsService.getComposersOfWork(work)
        .then(composers => {
        	this.composers = composers
          .sort((a,b) => a.compareTo(b, 'rdfs:label'))
          this.composers.forEach((c) => c.description = this.stripAnchors(c.description))
        });
      });
  	}
  }
}

