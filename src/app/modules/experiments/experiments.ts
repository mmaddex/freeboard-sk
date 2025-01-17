/** Experiments Components **
 ********************************/

import { Component, Output, EventEmitter } from '@angular/core';

/********* ExperimentsComponent ********/
@Component({
  selector: 'fb-experiments',
  template: `
    <mat-menu #experimentsmenu="matMenu">
      <!--
      <a mat-menu-item (click)="handleSelect('exp_id_here')">
          <mat-icon>filter_drama</mat-icon>
          <span>EXP_NAME_HERE</span>			
      </a>
      <a mat-menu-item>
          <span>None Available</span>	
      </a>
      -->
      <a mat-menu-item (click)="handleSelect('weather_forecast')">
        <mat-icon>ac_unit</mat-icon>
        <span>Weather Forecast</span>
      </a>
    </mat-menu>

    <div>
      <button
        mat-mini-fab
        [color]="''"
        [matMenuTriggerFor]="experimentsmenu"
        matTooltip="Experiments"
        matTooltipPosition="left"
      >
        <mat-icon>science</mat-icon>
      </button>
    </div>
  `,
  styles: [``]
})
export class ExperimentsComponent {
  @Output() selected: EventEmitter<any> = new EventEmitter();

  //constructor() {}

  handleSelect(choice: string, value?: any) {
    this.selected.emit({ choice: choice, value: value });
  }
}
