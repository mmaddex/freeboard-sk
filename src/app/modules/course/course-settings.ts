import { Component, OnInit, Inject, ChangeDetectorRef } from '@angular/core';
import {
  MatBottomSheetRef,
  MAT_BOTTOM_SHEET_DATA
} from '@angular/material/bottom-sheet';
import { AppInfo } from 'src/app/app.info';
import { SignalKClient } from 'signalk-client-angular';
import { Convert } from 'src/app/lib/convert';
import { HttpErrorResponse } from '@angular/common/http';
import { SKStreamFacade } from 'src/app/modules';
import { UpdateMessage } from 'src/app/types';
import { Subscription } from 'rxjs';

/********* Course Settings Modal ********
	data: {
        title: "<string>" title text
    }
***********************************/
@Component({
  selector: 'ap-course-modal',
  template: `
    <div class="_ap-course">
      <mat-toolbar>
        <span>
          <mat-icon>settings</mat-icon>
        </span>
        <span style="flex: 1 1 auto; padding-left:20px;text-align:center;">
          {{ data.title }}
        </span>
        <span>
          <button
            mat-icon-button
            (click)="closeModal()"
            matTooltip="Close"
            matTooltipPosition="below"
          >
            <mat-icon>keyboard_arrow_down</mat-icon>
          </button>
        </span>
      </mat-toolbar>

      <mat-card>
        <div style="display:flex;flex-wrap:nowrap;">
          <div class="key-label">Arrival Circle</div>
          <div style="flex:1 1 auto;">
            <mat-form-field style="width:100%;" floatLabel="always">
              <mat-label
                >Arrival Circle radius ({{
                  app.config.units.distance == 'm'
                    ? app.config.units.distance
                    : 'NM'
                }}):
              </mat-label>
              <input
                id="arrivalCircle"
                matInput
                type="number"
                min="0"
                [value]="frmArrivalCircle"
                (change)="onFormChange($event)"
                placeholder="500"
                matTooltip="Enter Arrival circle radius"
              />
            </mat-form-field>
          </div>
          <div style="width:45px;"></div>
        </div>

        <div style="display:flex;flex-wrap:nowrap;">
          <div style="padding-right: 10px;">
            <mat-slide-toggle
              id="targetarrivalenable"
              color="primary"
              [(checked)]="targetArrivalEnabled"
              (change)="toggleTargetArrival($event)"
              placeholder="Set Target Arrival time"
            >
            </mat-slide-toggle>
          </div>

          <div>
            <mat-form-field style="width:150px;">
              <mat-label>Target Arrival Date</mat-label>
              <input
                id="arrivalDate"
                [disabled]="!targetArrivalEnabled"
                matInput
                required
                [matDatepicker]="picker"
                [min]="minDate"
                [(ngModel)]="arrivalData.datetime"
                (dateChange)="onFormChange($event)"
                placeholder="Choose a start date"
              />
              <mat-hint>MM/DD/YYYY</mat-hint>
              <mat-datepicker-toggle
                matSuffix
                [for]="picker"
              ></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
          </div>
          <div style="display:flex;flex-wrap:nowrap;">
            <mat-form-field style="width:50px;">
              <mat-label>Time</mat-label>
              <mat-select
                id="arrivalHour"
                [(ngModel)]="arrivalData.hour"
                [disabled]="!targetArrivalEnabled"
                (selectionChange)="onFormChange($event)"
              >
                <mat-option *ngFor="let i of hrValues()" [value]="i">{{
                  i
                }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field style="width:50px;">
              <mat-select
                id="arrivalMinutes"
                [(ngModel)]="arrivalData.minutes"
                [disabled]="!targetArrivalEnabled"
                (selectionChange)="onFormChange($event)"
              >
                <mat-option *ngFor="let i of minValues()" [value]="i">{{
                  i
                }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field style="width:50px;">
              <mat-select
                id="arrivalSeconds"
                [(ngModel)]="arrivalData.seconds"
                [disabled]="!targetArrivalEnabled"
                (selectionChange)="onFormChange($event)"
              >
                <mat-option *ngFor="let i of minValues()" [value]="i">{{
                  i
                }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
      </mat-card>

      <mat-card *ngIf="app.config.experiments">
        <div style="display:flex;flex-wrap:nowrap;">
          <div class="key-label" style="font-size: 16px;">Auto-Pilot:</div>
          <div style="flex:1 1 auto;">
            <mat-slide-toggle
              id="autopilotenable"
              color="primary"
              [disabled]="!hasAutoPilot"
              [checked]="app.data.vessels.self.autopilot.state === 'enabled'"
              (change)="onFormChange($event)"
              placeholder="Autopilot Enabled"
            >
            </mat-slide-toggle>
          </div>
          <div style="width:45px;"></div>
        </div>
        <div style="display:flex;flex-wrap:nowrap;">
          <div class="key-label">Mode:</div>
          <div style="flex:1 1 auto;">
            <mat-form-field style="width:100%;" floatLabel="always">
              <mat-select
                id="autopilotmode"
                [(value)]="app.data.vessels.self.autopilot.mode"
                (selectionChange)="onFormChange($event)"
              >
                <mat-option
                  *ngFor="let i of autoPilotModes"
                  [value]="i"
                  [matTooltip]="i"
                  matTooltipPosition="right"
                >
                  {{ i }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <div style="width:45px;"></div>
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      ._ap-course {
        font-family: arial;
        min-width: 300px;
      }
      ._ap-course .key-label {
        font-weight: 500;
        width: 120px;
      }
      ._ap-course .key-desc {
        font-style: italic;
      }
    `
  ]
})
export class CourseSettingsModal implements OnInit {
  frmArrivalCircle: number;
  private deltaSub: Subscription;
  protected targetArrivalEnabled = false;
  protected minDate = new Date();
  protected arrivalData = {
    hour: '00',
    minutes: '00',
    seconds: '00',
    datetime: null
  };
  protected autoPilotModes = []; //this.app.data.vessels.self.autopilot.modeList
  protected hasAutoPilot = false;
  private context = 'self';
  /*this.app.data.vessels.activeId
  ? this.app.data.vessels.activeId
  : 'self';*/

  constructor(
    public app: AppInfo,
    private stream: SKStreamFacade,
    private cdr: ChangeDetectorRef,
    private signalk: SignalKClient,
    public modalRef: MatBottomSheetRef<CourseSettingsModal>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data
  ) {}

  ngOnInit() {
    if (this.data.title === 'undefined') {
      this.data['title'] = 'Course Settings';
    }
    this.frmArrivalCircle =
      this.app.data.navData.arrivalCircle === null
        ? 0
        : this.app.data.navData.arrivalCircle;
    this.frmArrivalCircle =
      this.app.config.units.distance === 'm'
        ? this.frmArrivalCircle
        : Number(
            Convert.kmToNauticalMiles(this.frmArrivalCircle / 1000).toFixed(1)
          );

    this.deltaSub = this.stream.delta$().subscribe((e: UpdateMessage) => {
      if (e.action === 'update') {
        this.cdr.detectChanges();
      }
    });

    this.signalk.api
      .get(this.app.skApiVersion, 'vessels/self/navigation/course')
      .subscribe((val) => {
        console.log(val.targetArrivalTime);
        if (val.targetArrivalTime) {
          this.targetArrivalEnabled = true;
          this.arrivalData.datetime = new Date(val.targetArrivalTime);
          this.arrivalData.hour = (
            '00' + this.arrivalData.datetime.getHours()
          ).slice(-2);
          this.arrivalData.minutes = (
            '00' + this.arrivalData.datetime.getMinutes()
          ).slice(-2);
          this.arrivalData.seconds = (
            '00' + this.arrivalData.datetime.getSeconds()
          ).slice(-2);
        }
      });

    this.signalk.api
      .get(this.app.skApiVersion, 'vessels/self/steering/autopilot/config')
      .subscribe(
        (val) => {
          console.log(val);
          if (
            val.options &&
            val.options.mode &&
            Array.isArray(val.options.mode)
          ) {
            this.autoPilotModes = val.options.mode;
            this.hasAutoPilot = true;
          }
        },
        () => {
          this.autoPilotModes = [];
          this.hasAutoPilot = false;
        }
      );
  }

  ngOnDestroy() {
    this.deltaSub.unsubscribe();
  }

  closeModal() {
    this.modalRef.dismiss();
  }

  onFormChange(e) {
    if (
      e.targetElement &&
      [
        'arrivalDate',
        'arrivalHour',
        'arrivalMinutes',
        'arrivalSeconds'
      ].includes(e.targetElement.id)
    ) {
      this.processTargetArrival();
    }
    if (
      e.source &&
      ['arrivalHour', 'arrivalMinutes', 'arrivalSeconds'].includes(e.source.id)
    ) {
      this.processTargetArrival();
    }
    if (e.target && e.target.id == 'arrivalCircle') {
      if (e.target.value !== '' && e.target.value !== null) {
        let d =
          this.app.config.units.distance == 'm'
            ? Number(e.target.value)
            : Convert.nauticalMilesToKm(Number(e.target.value)) * 1000;
        d = d <= 0 ? null : d;

        this.signalk.api
          .putWithContext(
            this.app.skApiVersion,
            this.context,
            'navigation/course/arrivalCircle',
            { value: d }
          )
          .subscribe(
            () => undefined,
            (error: HttpErrorResponse) => {
              let msg = `Error setting Arrival Circle!\n`;
              if (error.status === 403) {
                msg += 'Unauthorised: Please login.';
              }
              this.app.showAlert(`Error (${error.status}):`, msg);
            }
          );
      }
    }
    if (e.source) {
      if (e.source.id === 'autopilotenable') {
        // toggle autopilot enable
        this.signalk.api
          .putWithContext(
            this.app.skApiVersion,
            this.context,
            'steering/autopilot/state',
            {
              value: e.checked ? 'enabled' : 'disabled'
            }
          )
          .subscribe(
            () => undefined,
            (error: HttpErrorResponse) => {
              let msg = `Error setting Autopilot state!\n`;
              if (error.status === 403) {
                msg += 'Unauthorised: Please login.';
              }
              this.app.showAlert(`Error (${error.status}):`, msg);
            }
          );
      }
      if (e.source.id === 'autopilotmode') {
        // autopilot mode
        this.signalk.api
          .putWithContext(
            this.app.skApiVersion,
            this.context,
            'steering/autopilot/mode',
            {
              value: e.value
            }
          )
          .subscribe(
            () => undefined,
            (error: HttpErrorResponse) => {
              let msg = `Error setting Autopilot mode!\n`;
              if (error.status === 403) {
                msg += 'Unauthorised: Please login.';
              }
              this.app.showAlert(`Error (${error.status}):`, msg);
            }
          );
      }
    }
  }

  toggleTargetArrival(e) {
    this.targetArrivalEnabled = e.checked;
    if (!this.targetArrivalEnabled) {
      this.arrivalData.datetime = null;
      this.signalk.api
        .putWithContext(
          this.app.skApiVersion,
          this.context,
          'navigation/course/targetArrivalTime',
          {
            value: null
          }
        )
        .subscribe();
    } else {
      this.processTargetArrival();
    }
  }

  processTargetArrival() {
    if (this.targetArrivalEnabled) {
      if (!this.arrivalData.datetime) {
        return;
      }
      const atime = this.formatArrivalTime();
      this.signalk.api
        .putWithContext(
          this.app.skApiVersion,
          this.context,
          'navigation/course/targetArrivalTime',
          {
            value: atime
          }
        )
        .subscribe(
          () => {
            console.log('targetArrivalTime = ', atime);
          },
          (error: HttpErrorResponse) => {
            let msg = `Error setting target arrival time!\n`;
            if (error.status === 403) {
              msg += 'Unauthorised: Please login.';
            }
            this.app.showAlert(`Error (${error.status}):`, msg);
          }
        );
    }
  }

  formatArrivalTime(): string {
    let ts = '';
    this.arrivalData.datetime.setHours(parseInt(this.arrivalData.hour));
    this.arrivalData.datetime.setMinutes(parseInt(this.arrivalData.minutes));
    this.arrivalData.datetime.setSeconds(parseInt(this.arrivalData.seconds));
    ts = this.arrivalData.datetime.toISOString();
    return ts.slice(0, ts.indexOf('.')) + 'Z';
  }

  hrValues() {
    const v = [];
    for (let i = 0; i < 24; i++) {
      v.push(('00' + i).slice(-2));
    }
    return v;
  }

  minValues() {
    const v = [];
    for (let i = 0; i < 59; i++) {
      v.push(('00' + i).slice(-2));
    }
    return v;
  }
}
