import { Component } from '@angular/core';
import { KioskService } from './kiosk.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Music Archive';
  public isNavbarCollapsed:boolean = true;
	research = {
		dismissed: true,
		warning: "This website collects anonymous data about how it is used. Neither you nor this device can be identified from the collected data."
	};
	kioskMode:boolean 
	
	constructor(
			private kioskService: KioskService
	) {
		this.kioskMode = kioskService.getKioskMode()
	}
	closeResearchWarning() {
		// TODO persist
		this.research.dismissed = true;
	}
}
