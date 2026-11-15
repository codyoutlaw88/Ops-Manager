"use client";
import { useState } from "react";
import { savePushSubscription, sendTestPush } from "@/app/actions";

function urlB64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushSetup({ publicKey }: { publicKey: string }) {
  const [msg, setMsg] = useState("");
  if (!publicKey) return <p className="warn">Push isn&apos;t set up on the server yet (VAPID keys missing).</p>;

  async function enable() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setMsg("This browser can't do push here. On iPhone, open the app from the home screen icon first.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setMsg("Notifications were not allowed."); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePushSubscription(json);
      setMsg(r.ok ? "Notifications are on for this device." : "Couldn't save this device.");
    } catch (e) {
      setMsg(`Couldn't turn on notifications: ${(e as Error).message}`);
    }
  }
  async function test() {
    const r = await sendTestPush();
    setMsg(r.sent ? `Sent to ${r.sent} device(s).` : "No devices are registered yet.");
  }
  return (
    <div className="row wrap">
      <button className="primary" onClick={enable}>Turn on notifications</button>
      <button className="small" onClick={test}>Send a test</button>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
