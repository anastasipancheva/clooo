import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { environment } from '@env';
import { AuthService } from './auth.service';
import { NotificationPayload } from './models';

@Injectable({ providedIn: 'root' })
export class SignalRService implements OnDestroy {
  private auth = inject(AuthService);
  private connection: signalR.HubConnection | null = null;

  notification$ = new Subject<NotificationPayload>();

  start(): void {
    const token = this.auth.getToken();
    if (!token || this.connection) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/notifications`, { accessTokenFactory: () => token })
      .withAutomaticReconnect([2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.None)
      .build();

    this.connection.on('Notification', (payload: NotificationPayload) => {
      this.notification$.next(payload);
    });

    this.connection.start().catch(() => {});
  }

  stop(): void {
    this.connection?.stop();
    this.connection = null;
  }

  ngOnDestroy() { this.stop(); }
}
