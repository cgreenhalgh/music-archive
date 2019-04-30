import { Injectable } from '@angular/core';

const KIOSK_MODE = true

@Injectable()
export class KioskService {
	kioskMode:boolean = KIOSK_MODE
	constuctor()
	{		
	}
  getKioskMode() : boolean {
  	return this.kioskMode
  }
}
