import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpModule }    from '@angular/http';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { AppComponent } from './app.component';
import { WorksComponent } from './works.component';
import { WorkDetailComponent } from './work-detail.component';
import { WorkDetailPageComponent } from './work-detail-page.component';
import { WorkExplorerComponent } from './work-explorer.component';
import { PerformanceDetailComponent } from './performance-detail.component';
import { PartsMapComponent } from './parts-map.component';
import { RecordsService } from './records.service';
import { LinkappsService } from './linkapps.service';
import { KioskService } from './kiosk.service';
import { PlaylistFormComponent } from './playlist-form.component';
import { PlaylistItemFormComponent } from './playlist-item-form.component';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [
    AppComponent,
    WorksComponent,
    WorkDetailComponent,
    WorkDetailPageComponent,
    WorkExplorerComponent,
    PerformanceDetailComponent,
    PartsMapComponent,
    PlaylistItemFormComponent,
    PlaylistFormComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    HttpModule,
    NgbModule.forRoot()
  ],
  providers: [
    RecordsService, 
    LinkappsService, 
    KioskService,
    { provide: 'Window', useValue: window }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
