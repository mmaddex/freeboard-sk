/** Text Dial Component **
 ************************/

import { Component, Input } from '@angular/core';

/*********** Text Dial ***************
title: "<string>" title text,
value: "<string>" display value,
units: "<string>" dsisplay units,
***********************************/
@Component({
  selector: 'ap-dial-text',
  template: `
    <div class="dial-text mat-app-background">
      <div class="dial-text-title">{{ title }}</div>
      <div class="dial-text-value">{{ value }}</div>
      <div class="dial-text-units">{{ units }}</div>
    </div>
  `,
  styleUrls: ['./dial-text.css']
})
export class TextDialComponent {
  @Input() title: string;
  @Input() value: string;
  @Input() units: string;

  //constructor() {}
}
