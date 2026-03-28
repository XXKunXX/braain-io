"use client";

import { useEffect, useState } from "react";
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Thermometer } from "lucide-react";

// WMO Weather interpretation codes → label + icon
function getWeatherInfo(code: number): { label: string; icon: React.ReactNode } {
  if (code === 0) return { label: "Klar", icon: <Sun className="h-5 w-5 text-yellow-500" /> };
  if (code <= 3) return { label: "Bewölkt", icon: <Cloud className="h-5 w-5 text-gray-400" /> };
  if (code <= 49) return { label: "Nebel", icon: <Cloud className="h-5 w-5 text-gray-400" /> };
  if (code <= 69) return { label: "Regen", icon: <CloudRain className="h-5 w-5 text-blue-400" /> };
  if (code <= 79) return { label: "Schnee", icon: <CloudSnow className="h-5 w-5 text-blue-300" /> };
  if (code <= 99) return { label: "Gewitter", icon: <CloudLightning className="h-5 w-5 text-yellow-600" /> };
  return { label: "Unbekannt", icon: <Cloud className="h-5 w-5 text-gray-400" /> };
}

type WeatherState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; temp: number; windspeed: number; code: number };

export function WeatherWidget({ address }: { address: string }) {
  const [weather, setWeather] = useState<WeatherState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Step 1: geocode address via Nominatim
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
          { headers: { "Accept-Language": "de" } }
        );
        const geoData = await geoRes.json();
        if (!geoData?.[0]) { if (!cancelled) setWeather({ status: "error" }); return; }
        const { lat, lon } = geoData[0];

        // Step 2: get current weather from Open-Meteo
        const wxRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,windspeed_10m,weathercode&timezone=Europe%2FBerlin`
        );
        const wxData = await wxRes.json();
        if (!cancelled) {
          setWeather({
            status: "ok",
            temp: Math.round(wxData.current.temperature_2m),
            windspeed: Math.round(wxData.current.windspeed_10m),
            code: wxData.current.weathercode,
          });
        }
      } catch {
        if (!cancelled) setWeather({ status: "error" });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [address]);

  if (weather.status === "loading") {
    return (
      <div className="bg-white rounded-2xl p-4 flex items-center gap-3 animate-pulse">
        <div className="w-10 h-10 rounded-xl bg-gray-100" />
        <div className="space-y-1.5">
          <div className="h-3 w-20 bg-gray-100 rounded" />
          <div className="h-3 w-28 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (weather.status === "error") return null;

  const { label, icon } = getWeatherInfo(weather.code);

  return (
    <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-400 mb-0.5">Wetter vor Ort</p>
        <p className="text-sm font-semibold text-gray-900">
          {label} · {weather.temp}°C
        </p>
        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
          <Wind className="h-3 w-3" /> {weather.windspeed} km/h
        </p>
      </div>
    </div>
  );
}
