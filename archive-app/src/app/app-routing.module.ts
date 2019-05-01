import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { WorksComponent } from './works.component';
import { WorkDetailPageComponent } from './work-detail-page.component';
import { WorkExplorerComponent } from './work-explorer.component';
import { PerformanceDetailComponent } from './performance-detail.component';

const routes: Routes = [
  { path: '', redirectTo: '/works', pathMatch: 'full' },
  { path: 'works',  component: WorksComponent },
  { path: 'work/:id', component: WorkDetailPageComponent },
  { path: 'performance/:id', component: PerformanceDetailComponent },
  { path: 'explore/:id', component: WorkExplorerComponent }
];

@NgModule({
  imports: [ RouterModule.forRoot(routes) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}

