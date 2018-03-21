import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule }    from '@angular/http';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { AppComponent } from './app.component';
import { WorksComponent } from './works.component';
import { WorkDetailComponent } from './work-detail.component';
import { WorkExplorerComponent } from './work-explorer.component';
import { PerformanceDetailComponent } from './performance-detail.component';
import { PartsMapComponent } from './parts-map.component';
import { RecordsService } from './records.service';
import { LinkappsService } from './linkapps.service';

import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [
    AppComponent,
    WorksComponent,
    WorkDetailComponent,
    WorkExplorerComponent,
    PerformanceDetailComponent,
    PartsMapComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    HttpModule,
    NgbModule.forRoot()
  ],
  providers: [RecordsService, LinkappsService],
  bootstrap: [AppComponent]
})
export class AppModule { }
