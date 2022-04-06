/** Signal K Stream Provider abstraction Facade
 * ************************************/
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { AppInfo } from 'src/app/app.info';
import { SettingsMessage } from 'src/app/lib/info/info.service';
import { SignalKClient } from 'signalk-client-angular';
import { SKStreamProvider } from './skstream.service';
import { SKVessel } from '../skresources/resource-classes';
import { AlarmsFacade } from '../alarms/alarms.facade';
import { Convert } from 'src/app/lib/convert';
import { SKResources } from '../skresources';
import { NotificationMessage, UpdateMessage } from 'src/app/types';

export enum SKSTREAM_MODE {
  REALTIME = 0,
  PLAYBACK
}

export interface StreamOptions {
  playbackRate: number;
  startTime: string;
  subscribe: string;
}

@Injectable({ providedIn: 'root' })
export class SKStreamFacade {
  // **************** ATTRIBUTES ***************************
  private onConnect: Subject<NotificationMessage | UpdateMessage> =
    new Subject();
  private onClose: Subject<NotificationMessage | UpdateMessage> = new Subject();
  private onError: Subject<NotificationMessage | UpdateMessage> = new Subject();
  private onMessage: Subject<NotificationMessage | UpdateMessage> =
    new Subject();
  private vesselsUpdate: Subject<void> = new Subject();
  private navDataUpdate: Subject<void> = new Subject();
  // *******************************************************

  constructor(
    private app: AppInfo,
    private signalk: SignalKClient,
    private alarmsFacade: AlarmsFacade,
    private skres: SKResources,
    private stream: SKStreamProvider
  ) {
    // ** SIGNAL K STREAM **
    this.stream
      .message$()
      .subscribe((msg: NotificationMessage | UpdateMessage) => {
        if (msg.action == 'open') {
          this.post({
            cmd: 'auth',
            options: {
              token: this.app.getToken()
            }
          });
          this.onConnect.next(msg);
        } else if (msg.action == 'close') {
          this.onClose.next(msg);
        } else if (msg.action == 'error') {
          this.onError.next(msg);
        } else {
          this.parseUpdate(msg);
          this.onMessage.next(msg);
        }
      });

    // ** SETTINGS - handle settings load / save events
    this.app.settings$.subscribe((r: SettingsMessage) =>
      this.handleSettingsEvent(r)
    );
  }
  // ** SKStream WebSocket messages **
  connect$(): Observable<NotificationMessage | UpdateMessage> {
    return this.onConnect.asObservable();
  }
  close$(): Observable<NotificationMessage | UpdateMessage> {
    return this.onClose.asObservable();
  }
  error$(): Observable<NotificationMessage | UpdateMessage> {
    return this.onError.asObservable();
  }
  delta$(): Observable<NotificationMessage | UpdateMessage> {
    return this.onMessage.asObservable();
  }

  // ** Data centric messages
  vessels$(): Observable<void> {
    return this.vesselsUpdate.asObservable();
  }
  navdata$(): Observable<void> {
    return this.navDataUpdate.asObservable();
  }

  terminate() {
    this.stream.terminate();
  }

  close() {
    this.stream.close();
  }

  post(msg) {
    this.stream.postMessage(msg);
  }

  // ** open Signal K Stream
  open(options?: StreamOptions) {
    if (options && options.startTime) {
      const url = this.signalk.server.endpoints['v1']['signalk-ws'].replace(
        'stream',
        'playback'
      );
      this.stream.postMessage({
        cmd: 'open',
        options: {
          url: url,
          subscribe: 'none',
          token: null,
          playback: true,
          playbackOptions: options
        }
      });
    } else {
      this.stream.postMessage({
        cmd: 'open',
        options: {
          url: this.signalk.server.endpoints['v1']['signalk-ws'],
          subscribe: 'none',
          token: null
        }
      });
    }
  }

  // ** subscribe to signal k paths
  subscribe() {
    this.stream.postMessage({
      cmd: 'subscribe',
      options: {
        context: 'vessels.*',
        path: [
          { path: '', period: 1000, policy: 'fixed' },
          { path: 'buddy', period: 1000, policy: 'fixed' },
          { path: 'uuid', period: 1000, policy: 'fixed' },
          { path: 'name', period: 1000, policy: 'fixed' },
          { path: 'communication.callsignVhf', period: 1000, policy: 'fixed' },
          { path: 'mmsi', period: 1000, policy: 'fixed' },
          { path: 'port', period: 1000, policy: 'fixed' },
          { path: 'flag', period: 1000, policy: 'fixed' },
          { path: 'navigation.*', period: 1000, policy: 'fixed' },
          { path: 'environment.wind.*', period: 1000, policy: 'fixed' },
          { path: 'environment.mode', period: 1000, policy: 'fixed' },
          { path: 'resources.*', period: 1000, policy: 'fixed' },
          { path: 'steering.autopilot.*', period: 1000, policy: 'fixed' }
        ]
      }
    });
    this.stream.postMessage({
      cmd: 'subscribe',
      options: {
        context: 'vessels.self',
        path: [{ path: 'notifications.*', period: 1000 }]
      }
    });
    this.stream.postMessage({
      cmd: 'subscribe',
      options: {
        context: 'atons.*',
        path: [{ path: '*', period: 60000 }]
      }
    });
    this.stream.postMessage({
      cmd: 'subscribe',
      options: {
        context: 'shore.basestations.*',
        path: [{ path: '*', period: 60000 }]
      }
    });
    this.stream.postMessage({
      cmd: 'subscribe',
      options: {
        context: 'sar.*',
        path: [{ path: '*', period: 60000 }]
      }
    });
    this.stream.postMessage({
      cmd: 'subscribe',
      options: {
        context: 'aircraft.*',
        path: [{ path: '*', period: 30000 }]
      }
    });
  }

  // ** parse delta message and update Vessel Data -> vesselsUpdate.next()
  private parseUpdate(msg: NotificationMessage | UpdateMessage) {
    if (msg.action == 'update') {
      // delta message

      this.parseVesselSelf(msg.result.self);

      this.parseVesselOther(msg.result.aisTargets);

      this.app.data.vessels.prefAvailablePaths = msg.result.paths;

      // ** update active vessel map display **
      this.app.data.vessels.active = this.app.data.vessels.activeId
        ? this.app.data.vessels.aisTargets.get(this.app.data.vessels.activeId)
        : this.app.data.vessels.self;

      this.processCourse(this.app.data.vessels.active);

      // process AtoNs
      this.app.data.atons = msg.result.atons;

      // process SaR
      this.app.data.sar = msg.result.sar;

      // process Aircraft
      this.app.data.aircraft = msg.result.aircraft;

      // processAIS
      this.app.data.aisMgr.updateList = msg.result.aisStatus.updated;
      this.app.data.aisMgr.staleList = msg.result.aisStatus.stale;
      this.app.data.aisMgr.removeList = msg.result.aisStatus.expired;

      // process AIS tracks
      this.app.data.aisMgr.updateList.forEach((id) => {
        const v =
          id.indexOf('aircraft') != -1
            ? this.app.data.aircraft.get(id)
            : this.app.data.vessels.aisTargets.get(id);
        if (v) {
          this.app.data.vessels.aisTracks.set(id, v.track);
        }
      });
      this.app.data.aisMgr.removeList.forEach((id) => {
        this.app.data.vessels.aisTracks.delete(id);
      });

      this.vesselsUpdate.next();
    }
  }

  private parseVesselSelf(v: SKVessel) {
    this.app.data.vessels.self = v;
    this.processVessel(this.app.data.vessels.self);
    this.alarmsFacade.updateAnchorStatus();
  }

  private parseVesselOther(otherVessels: Map<string, SKVessel>) {
    this.app.data.vessels.aisTargets = otherVessels;
    this.app.data.vessels.aisTargets.forEach((value, key) => {
      this.processVessel(value);
      value.wind.direction = this.app.useMagnetic
        ? value.wind.mwd
        : value.wind.twd;
      value.orientation =
        value.heading != null
          ? value.heading
          : value.cog != null
          ? value.cog
          : 0;
      if (`vessels.${this.app.data.vessels.closest.id}` == key) {
        if (!value.closestApproach) {
          this.alarmsFacade.updateAlarm('cpa', null);
          this.app.data.vessels.closest = {
            id: null,
            distance: null,
            timeTo: null,
            position: [0, 0]
          };
        } else {
          this.app.data.vessels.closest.position = value.position;
        }
      }
    });
  }

  // ** process vessel data and true / magnetic preference **
  private processVessel(d: SKVessel) {
    d.cog = this.app.useMagnetic ? d.cogMagnetic : d.cogTrue;
    d.heading = this.app.useMagnetic ? d.headingMagnetic : d.headingTrue;
  }

  // ** process course data
  private processCourse(v: SKVessel) {
    // ** process courseApi data
    if (typeof v['courseApi'] !== 'undefined') {
      this.processCourseApi(v['courseApi']);
    }

    // ** process preferred course data **
    if (typeof v['course.crossTrackError'] !== 'undefined') {
      this.app.data.navData.xte =
        this.app.config.units.distance == 'm'
          ? v['course.crossTrackError'] / 1000
          : Convert.kmToNauticalMiles(v['course.crossTrackError'] / 1000);
    }

    if (typeof v['course.distance'] !== 'undefined') {
      this.app.data.navData.dtg =
        this.app.config.units.distance == 'm'
          ? v['course.distance'] / 1000
          : Convert.kmToNauticalMiles(v['course.distance'] / 1000);
    }
    if (typeof v['course.bearingTrue'] !== 'undefined') {
      this.app.data.navData.bearingTrue = Convert.radiansToDegrees(
        v['course.bearingTrue']
      );
      if (!this.app.useMagnetic) {
        this.app.data.navData.bearing.value = this.app.data.navData.bearingTrue;
        this.app.data.navData.bearing.type = 'T';
      }
    }
    if (typeof v['course.bearingMagnetic'] !== 'undefined') {
      this.app.data.navData.bearingMagnetic = Convert.radiansToDegrees(
        v['course.bearingMagnetic']
      );
      if (this.app.useMagnetic) {
        this.app.data.navData.bearing.value =
          this.app.data.navData.bearingMagnetic;
        this.app.data.navData.bearing.type = 'M';
      }
    }
    if (typeof v['course.velocityMadeGood'] !== 'undefined') {
      this.app.data.navData.vmg =
        this.app.config.units.speed == 'kn'
          ? Convert.msecToKnots(v['course.velocityMadeGood'])
          : v['course.velocityMadeGood'];
    }
    if (typeof v['course.timeToGo'] !== 'undefined') {
      this.app.data.navData.ttg = v['course.timeToGo'] / 60;
    }
    // ** experimental: paths not in spec - estimatedTimeOfArrival**
    if (typeof v['course.estimatedTimeOfArrival'] !== 'undefined') {
      let d: Date | null;
      if (v['course.estimatedTimeOfArrival'] !== null) {
        d = new Date(v['course.estimatedTimeOfArrival']);
        this.app.data.navData.eta =
          d instanceof Date && !isNaN(d as any) ? d : null;
      } else {
        this.app.data.navData.eta = null;
      }
    }
    this.navDataUpdate.next();
  }

  // ** process courseApi values into navData
  processCourseApi(value) {
    if (!value) {
      this.app.data.navData.startPosition = null;
      this.app.data.navData.position = null;
      this.app.data.activeWaypoint = null;
      this.app.data.activeRoute = null;
      this.app.data.navData.pointIndex = -1;
      this.app.data.navData.pointTotal = 0;
      this.app.data.navData.pointNames = [];
      this.app.data.activeRouteReversed = false;
      return;
    }

    if (value.nextPoint && value.previousPoint) {
      // navData.arrivalCircle
      this.app.data.navData.arrivalCircle = value.nextPoint.arrivalCircle;

      // navData.startPosition
      this.app.data.navData.startPosition = value?.previousPoint.position
        ? [
            value.previousPoint.position.longitude,
            value.previousPoint.position.latitude
          ]
        : null;

      // navData.position
      this.app.data.navData.position = value?.nextPoint.position
        ? [
            value.nextPoint.position.longitude,
            value.nextPoint.position.latitude
          ]
        : null;

      // wpt / route hrefs
      if (value?.nextPoint.href) {
        const wptHref = value.nextPoint.href.split('/');
        this.app.data.activeWaypoint = wptHref[wptHref.length - 1];
      } else {
        this.app.data.activeWaypoint = null;
      }
    }

    // navData.activeRoute
    if (value.activeRoute?.href) {
      const rteHref = value.activeRoute.href.split('/');
      this.app.data.activeRoute = rteHref[rteHref.length - 1];
      this.app.data.activeWaypoint = null;
      this.app.data.navData.pointIndex = value?.activeRoute.pointIndex;
      this.app.data.navData.pointTotal = value?.activeRoute.pointTotal;

      const rte = this.app.data.routes.filter((i: any) => {
        if (i[0] === this.app.data.activeRoute) {
          return i;
        }
      });
      if (rte.length === 1 && rte[0][1]) {
        this.app.data.navData.pointNames =
          rte[0][1].feature.properties.points &&
          rte[0][1].feature.properties.points.names &&
          Array.isArray(rte[0][1].feature.properties.points.names)
            ? rte[0][1].feature.properties.points.names
            : [];
        this.app.data.activeRouteReversed = value?.activeRoute.reverse;

        const coords = rte[0][1].feature.geometry.coordinates;
        if (
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1]
        ) {
          this.app.data.activeRouteCircular = true;
        } else {
          this.app.data.activeRouteCircular = false;
        }
      }
    } else {
      this.app.data.activeRoute = null;
    }
  }

  // handle settings (config.selections)
  private handleSettingsEvent(value: any) {
    if (value.setting == 'config') {
      //console.log('streamFacade.settingsEvent');
      this.stream.postMessage({
        cmd: 'settings',
        options: { selections: this.app.config.selections }
      });
    }
  }
}
