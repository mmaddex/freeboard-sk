/** Route NextPoint Component **
 ************************/

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';

/*********** NextPoint ***************
index: number - index of current point,
total: number - total number of points
***********************************/
@Component({
  selector: 'route-nextpoint',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mat-app-background">
      <div style="display: flex; flex-wrap: nowrap;">
        <div>
          <button
            class="nav-button"
            mat-stroked-button
            color="primary"
            matTooltip="Previous point"
            matTootipPosition="top"
            [disabled]="!circular && index == 0"
            (click)="changeIndex(-1)"
          >
            <mat-icon>skip_previous</mat-icon><br />
          </button>
        </div>
        <div>
          <button
            class="nav-button"
            mat-stroked-button
            color="primary"
            matTooltip="Next point"
            matTootipPosition="top"
            [disabled]="!circular && index >= total - 1"
            (click)="changeIndex(1)"
          >
            <mat-icon>skip_next</mat-icon><br />
          </button>
        </div>
      </div>
      <div
        style="font-family:roboto;height: 32px;height: 40px;line-height: 40px;"
      >
        {{ index + 1 }} of {{ total }}
      </div>
    </div>
  `,
  styles: [
    `
      .nav-button {
        height: 40px;
      }
    `
  ]
})
export class RouteNextPointComponent {
  @Input() index: number;
  @Input() total: number;
  @Input() circular = false;
  @Output() selected: EventEmitter<number> = new EventEmitter();

  //constructor() {}

  changeIndex(i: number) {
    if (i === 1) {
      if (this.circular && this.index === this.total - 1) {
        this.selected.emit(1);
      } else {
        this.selected.emit(this.index + 1);
      }
    } else {
      if (this.circular && this.index === 0) {
        this.selected.emit(this.total - 2);
      } else {
        this.selected.emit(this.index - 1);
      }
    }
  }
}
