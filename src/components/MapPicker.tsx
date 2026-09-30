"use client";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

const pin = L.divIcon({ className:"", html:"<div style='width:22px;height:22px;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#059669;box-shadow:0 2px 8px #0005'></div>", iconSize:[22,22], iconAnchor:[11,22] });
function ClickMap({ onChange }: {onChange:(v:[number,number])=>void}) { useMapEvents({ click(e){onChange([e.latlng.lat,e.latlng.lng])} }); return null; }
export default function MapPicker({ value,onChange }: {value:[number,number];onChange:(v:[number,number])=>void}) {
  return <div className="overflow-hidden rounded-xl border border-slate-200"><MapContainer center={value} zoom={12} scrollWheelZoom className="h-64 w-full"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><ClickMap onChange={onChange}/><Marker position={value} icon={pin}/></MapContainer></div>;
}
