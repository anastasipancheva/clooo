"use client";
import { useEffect, useRef, useCallback } from "react";
import * as signalR from "@microsoft/signalr";

const HUB_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5062") + "/hubs/notifications";

export type NotificationPayload = {
  type: string;
  title: string;
  body?: string;
  createdAt: string;
};

export function useSignalR(onNotification: (payload: NotificationPayload) => void) {
  const connRef = useRef<signalR.HubConnection | null>(null);
  const cbRef = useRef(onNotification);
  cbRef.current = onNotification;

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (!token) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect([2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.None)
      .build();

    conn.on("Notification", (payload: NotificationPayload) => cbRef.current(payload));

    conn.start().catch(() => {});
    connRef.current = conn;

    return () => { conn.stop(); };
  }, []);
}
