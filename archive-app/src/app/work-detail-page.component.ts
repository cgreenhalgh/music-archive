import 'rxjs/add/operator/switchMap';
import { Component, OnInit }      from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Location }               from '@angular/common';

@Component({
  selector: 'work-detail-page',
  templateUrl: './work-detail-page.component.html'
})
export class WorkDetailPageComponent implements OnInit {
	id: string

  constructor(
    private route: ActivatedRoute,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.route.params
      .switchMap((params: Params) => { console.log(`work detail page for ${params['id']}`, params['id']); return [String(params['id'])])
      .subscribe(id => { console.log(`=> ${id}`, id); this.id = id })
  }

  goBack(): void {
    this.location.back();
  }
}

