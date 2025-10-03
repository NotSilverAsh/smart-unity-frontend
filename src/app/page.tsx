/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import Head from "next/head";

interface Location {
  lat: number;
  lon: number;
  name?: string;
}

interface WeatherData {
  year: number;
  max_temp: number;
  precipitation: number;
  wind_speed: number | null;
  air_quality: string | null;
}

interface Analysis {
  avgMaxTemp: string;
  changeOfPrecip: string;
  changeOfExtremeHeat: string;
  avgWindSpeed: string;
  avgAirQuality: string;
}

declare global {
  interface Window {
    L: any;
    Chart: any;
  }
}

export default function Home() {
  // core state
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [location, setLocation] = useState<Location>({ lat: 2.3073, lon: 112.9335 });
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [rawData, setRawData] = useState<WeatherData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // search & suggestions
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Location[]>([]);

  // map/chart refs
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const chartRef = useRef<any>(null);

  // UI settings
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light" | "blue">("dark");
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");
  const [windUnit, setWindUnit] = useState<"m/s" | "km/h">("m/s");

  // --- load CSS / scripts for leaflet & chart.js ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Leaflet CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css";
    document.head.appendChild(link);

    // Leaflet script then Chart.js
    const leafletScript = document.createElement("script");
    leafletScript.src = "https://unpkg.com/leaflet@1.7.1/dist/leaflet.js";
    leafletScript.onload = () => {
      const chartScript = document.createElement("script");
      chartScript.src = "https://cdn.jsdelivr.net/npm/chart.js";
      chartScript.onload = () => setScriptsLoaded(true);
      document.body.appendChild(chartScript);
    };
    document.body.appendChild(leafletScript);
  }, []);

  // --- geolocation: on mount try to get current user location --- 
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocation({ lat, lon, name: "Current location" });
        // We'll call getWeatherProfile after map & scripts initialize to avoid race conditions.
      },
      (err) => {
        console.warn("Geolocation error:", err.message);
      },
      { maximumAge: 60_000, timeout: 8000 }
    );
  }, []);

  // --- initialize map once scripts are loaded ---
  useEffect(() => {
    if (!scriptsLoaded || !window.L || mapRef.current) return;

    const map = window.L.map("map").setView([location.lat, location.lon], 10);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const marker = window.L.marker([location.lat, location.lon], { draggable: true }).addTo(map);
    markerRef.current = marker;
    mapRef.current = map;

    // when marker dragged: update location and fetch (throttled)
    let timer: number | null = null;
    marker.on("dragend", () => {
      const latlng = marker.getLatLng();
      setLocation((prev) => ({ ...prev, lat: latlng.lat, lon: latlng.lng }));
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        getWeatherProfile(latlng.lat, latlng.lng, date);
      }, 350);
    });

    // click map to move marker
    map.on("click", (e: any) => {
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;
      setLocation((prev) => ({ ...prev, lat, lon }));
      markerRef.current?.setLatLng([lat, lon]);
      // throttle small delay for UX
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        getWeatherProfile(lat, lon, date);
      }, 200);
    });

    // center to initial location (in case geolocation set it before scripts loaded)
    map.setView([location.lat, location.lon], 10);

    // trigger initial fetch (if geolocation already set)
    getWeatherProfile(location.lat, location.lon, date);
  }, [scriptsLoaded]);

  // --- whenever location changes via state (e.g., search), update map & marker (but don't re-fetch redundantly) ---
  useEffect(() => {
    if (!mapRef.current) return;
    try {
      mapRef.current.setView([location.lat, location.lon], 10);
      markerRef.current?.setLatLng([location.lat, location.lon]);
    } catch (e) {
      // ignore
    }
  }, [location]);

  // --- getWeatherProfile: calls backend and processes response ---
  const getWeatherProfile = async (lat?: number, lon?: number, d?: string) => {
    setLoading(true);
    setError("");
    const fetchLat = typeof lat === "number" ? lat : location.lat;
    const fetchLon = typeof lon === "number" ? lon : location.lon;
    const fetchDate = d ?? date;

    try {
      const res = await fetch(
        `http://localhost:5443/api/v1/weather?lat=${fetchLat}&lon=${fetchLon}&date=${fetchDate}`
      );
      if (!res.ok) {
        // try to read JSON if available for better error
        const text = await res.text();
        throw new Error(`Backend API error: ${res.status} ${res.statusText} ${text}`);
      }
      const payload = await res.json();

      const incomingRaw: any[] = payload.rawData ?? [];
      // convert units if needed
      const converted: WeatherData[] = incomingRaw.map((r: any) => {
        const wind = typeof r.wind_speed === "number" ? r.wind_speed : null;
        const windConverted = wind !== null && windUnit === "km/h" ? wind * 3.6 : wind;
        const temp = typeof r.max_temp === "number" ? r.max_temp : NaN;
        const tempConverted = tempUnit === "F" ? (temp * 9) / 5 + 32 : temp;
        return {
          year: Number(r.year),
          max_temp: Number(tempConverted),
          precipitation: r.precipitation !== undefined ? Number(r.precipitation) : NaN,
          wind_speed: windConverted !== null ? Number(windConverted) : null,
          air_quality: r.air_quality ?? null,
        } as WeatherData;
      });

      // compute analysis on converted data (avg temp, chance precip, avg wind)
      const validTemps = converted.filter((c) => Number.isFinite(c.max_temp));
      const avgMaxTemp =
        validTemps.length > 0
          ? (validTemps.reduce((s, v) => s + v.max_temp, 0) / validTemps.length).toFixed(1)
          : "N/A";

      const yearsWithRain = converted.filter((c) => c.precipitation !== null && c.precipitation > 0.5).length;
      const chanceOfRain = converted.length ? Math.round((yearsWithRain / converted.length) * 100).toString() : "N/A";

      const yearsWithExtreme = converted.filter((c) => c.max_temp > (tempUnit === "F" ? 95 : 35)).length;
      const chanceOfExtreme = converted.length ? Math.round((yearsWithExtreme / converted.length) * 100).toString() : "N/A";

      const windVals = converted.filter((c) => typeof c.wind_speed === "number").map((c) => c.wind_speed!) as number[];
      const avgWind = windVals.length ? (windVals.reduce((a, b) => a + b, 0) / windVals.length).toFixed(1) : "N/A";

      const dataAnalysis: Analysis = {
        avgMaxTemp: avgMaxTemp,
        changeOfPrecip: chanceOfRain,
        changeOfExtremeHeat: chanceOfExtreme,
        avgWindSpeed: avgWind,
        avgAirQuality: payload.dataAnalysis?.avgAirQuality ?? "N/A",
      };

      setRawData(converted);
      setAnalysis(dataAnalysis);
      setError("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error("getWeatherProfile error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- chart: update in-place, don't destroy unless necessary ---
  useEffect(() => {
    if (!rawData || !window.Chart || !scriptsLoaded) return;
    const canvas = document.getElementById("weatherChart") as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const labels = rawData.map((d) => d.year.toString());
    const temps = rawData.map((d) => d.max_temp);
    const winds = rawData.map((d) => d.wind_speed ?? 0);

    if (chartRef.current) {
      // update data and labels
      chartRef.current.data.labels = labels;
      if (chartRef.current.data.datasets?.[0]) {
        chartRef.current.data.datasets[0].data = temps;
        chartRef.current.data.datasets[0].label = `Max Temperature (${tempUnit})`;
      }
      if (chartRef.current.data.datasets?.[1]) {
        chartRef.current.data.datasets[1].data = winds;
        chartRef.current.data.datasets[1].label = `Wind (${windUnit})`;
      }
      chartRef.current.update();
      return;
    }

    chartRef.current = new window.Chart(ctx as any, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: `Max Temperature (${tempUnit})`,
            data: temps,
            backgroundColor: labels.map((yr) =>
              Number(yr) === new Date().getFullYear() ? "rgba(255,99,132,0.8)" : "rgba(54,162,235,0.7)"
            ),
            borderColor: "rgba(54,162,235,1)",
            borderWidth: 1,
            yAxisID: "y",
          },
          {
            label: `Wind (${windUnit})`,
            data: winds,
            backgroundColor: "rgba(255,206,86,0.7)",
            borderColor: "rgba(255,206,86,1)",
            borderWidth: 1,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: theme === "light" ? "#000" : "#fff" } },
        },
        scales: {
          x: { ticks: { color: theme === "light" ? "#000" : "#fff" }, grid: { color: "#444" } },
          y: {
            id: "y",
            position: "left",
            ticks: { color: theme === "light" ? "#000" : "#fff" },
            grid: { color: "#444" },
          },
          y1: {
            id: "y1",
            position: "right",
            ticks: { color: theme === "light" ? "#000" : "#fff" },
            grid: { drawOnChartArea: false, color: "#444" },
          },
        },
      },
    } as any);
  }, [rawData, tempUnit, windUnit, scriptsLoaded, theme]);

  // --- download CSV ---
  const downloadCSV = () => {
    if (!rawData) return;
    const headers = ["Year", `Max_Temp_${tempUnit}`, "Precip_mm", `Wind_${windUnit}`];
    const rows = rawData.map((r) => [
      r.year,
      r.max_temp ?? "N/A",
      r.precipitation ?? "N/A",
      r.wind_speed ?? "N/A",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `weather_${location.lat}_${location.lon}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // --- search (Nominatim) ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=6`
      );
      const data = await res.json();
      const results: Location[] = data.map((it: any) => ({
        lat: parseFloat(it.lat),
        lon: parseFloat(it.lon),
        name: it.display_name,
      }));
      setSuggestions(results);
    } catch (e) {
      console.error("search error", e);
      setSuggestions([]);
    }
  };

  const selectSuggestion = (l: Location) => {
    setLocation(l);
    mapRef.current?.setView([l.lat, l.lon], 10);
    markerRef.current?.setLatLng([l.lat, l.lon]);
    setSuggestions([]);
    setSearchQuery("");
    // fetch
    getWeatherProfile(l.lat, l.lon, date);
  };

  // --- simple activity suitability summary (uses analysis) ---
  const getSuitabilitySummary = () => {
    if (!analysis) return null;
    // parse numbers defensively
    const avgTemp = parseFloat(analysis.avgMaxTemp);
    const chanceRain = parseInt(analysis.changeOfPrecip, 10) || 0;
    const avgWind = analysis.avgWindSpeed === "N/A" ? null : parseFloat(analysis.avgWindSpeed);

    const result: { activity: string; suitable: boolean; reason?: string }[] = [];

    // Hiking: avoid if chanceRain >= 40 or wind >= 10 m/s (36 km/h) or temp extreme
    const hikingBad = chanceRain >= 40 || (avgWind !== null && avgWind >= (windUnit === "km/h" ? 36 : 10)) || avgTemp >= (tempUnit === "F" ? 104 : 40) || avgTemp <= (tempUnit === "F" ? 32 : 0);
    result.push({
      activity: "Hiking",
      suitable: !hikingBad,
      reason: hikingBad
        ? chanceRain >= 40
          ? `High chance of rain (${chanceRain}%)`
          : avgWind !== null && avgWind >= (windUnit === "km/h" ? 36 : 10)
          ? `Windy (${avgWind} ${windUnit})`
          : `Temperature outside comfortable range (${analysis.avgMaxTemp}°${tempUnit})`
        : undefined,
    });

    // Beach: prefer warm and low rain
    const beachBad = chanceRain >= 30 || avgTemp < (tempUnit === "F" ? 68 : 20);
    result.push({
      activity: "Beach",
      suitable: !beachBad,
      reason: beachBad ? (chanceRain >= 30 ? `Rain likely (${chanceRain}%)` : `Too cool (${analysis.avgMaxTemp}°${tempUnit})`) : undefined,
    });

    // Cycling: wind sensitive
    const cyclingBad = (avgWind !== null && avgWind >= (windUnit === "km/h" ? 45 : 12.5)) || chanceRain >= 40;
    result.push({
      activity: "Cycling",
      suitable: !cyclingBad,
      reason: cyclingBad ? (avgWind !== null && avgWind >= (windUnit === "km/h" ? 45 : 12.5) ? `Very windy (${avgWind} ${windUnit})` : `Rain likely (${chanceRain}%)`) : undefined,
    });

    // Outdoor Event (parade): low rain preferred
    const eventBad = chanceRain >= 35;
    result.push({
      activity: "Outdoor Event",
      suitable: !eventBad,
      reason: eventBad ? `Rain likely (${chanceRain}%)` : undefined,
    });

    return result;
  };

  const summary = getSuitabilitySummary();

  const themeClass =
    theme === "light" ? "bg-gray-100 text-black" : theme === "blue" ? "bg-blue-900 text-white" : "bg-gray-900 text-white";

  return (
    <>
      <Head>
        <title>NASA Weather Dashboard — Forecast-style</title>
      </Head>

      <div className={`${themeClass} min-h-screen p-4 transition-colors duration-300`}>
        {/* hamburger + close */}
        <div className="fixed top-4 right-4 z-[100] flex gap-2">
          <button className="p-2 bg-gray-700 rounded-md text-white" onClick={() => setMenuOpen(true)}>
            ☰
          </button>
          {menuOpen && (
            <button className="p-2 bg-red-600 rounded-md text-white" onClick={() => setMenuOpen(false)}>
              ✕
            </button>
          )}
        </div>

        {/* slide panel */}
        <div
          className={`fixed top-0 right-0 h-full bg-gray-800 shadow-lg z-[100] w-64 p-4 transform transition-transform duration-300 ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <h3 className="text-lg mb-4 font-semibold text-white">Settings</h3>
          <div className="mb-4">
            <label className="text-white mr-2">Theme:</label>
            <select className="bg-gray-700 p-1 rounded w-full text-white" value={theme} onChange={(e) => setTheme(e.target.value as any)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="blue">Blue</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="text-white mr-2">Temp:</label>
            <select className="bg-gray-700 p-1 rounded w-full text-white" value={tempUnit} onChange={(e) => setTempUnit(e.target.value as any)}>
              <option value="C">°C</option>
              <option value="F">°F</option>
            </select>
          </div>
          <div>
            <label className="text-white mr-2">Wind:</label>
            <select className="bg-gray-700 p-1 rounded w-full text-white" value={windUnit} onChange={(e) => setWindUnit(e.target.value as any)}>
              <option value="m/s">m/s</option>
              <option value="km/h">km/h</option>
            </select>
          </div>
        </div>

        {/* main */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col justify-start text-white">
            <h2 className="text-2xl font-semibold mb-4 text-blue-200">Select Your Location & Date</h2>

            <input
              type="date"
              className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white mb-3"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <input
              type="text"
              placeholder="Search city or location..."
              className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white mb-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />

            <div className="flex gap-2 mb-3">
              <button className="flex-1 bg-blue-600 hover:bg-blue-700 p-2 rounded" onClick={handleSearch}>
                Search
              </button>
              <button
                className="bg-gray-600 hover:bg-gray-500 p-2 rounded text-white"
                onClick={() => {
                  // re-use browser geolocation
                  if (!("geolocation" in navigator)) return;
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const lat = pos.coords.latitude;
                      const lon = pos.coords.longitude;
                      setLocation({ lat, lon, name: "Current location" });
                      mapRef.current?.setView([lat, lon], 10);
                      markerRef.current?.setLatLng([lat, lon]);
                      getWeatherProfile(lat, lon, date);
                    },
                    (err) => console.warn("Geolocation error:", err.message)
                  );
                }}
              >
                Use my location
              </button>
            </div>

            {suggestions.length > 0 && (
              <div className="bg-gray-700 rounded mb-4 max-h-40 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <div key={i} className="p-2 hover:bg-blue-600 cursor-pointer text-white" onClick={() => selectSuggestion(s)}>
                    {s.name}
                    <div className="text-xs text-gray-300">{s.lat.toFixed(4)}, {s.lon.toFixed(4)}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-2">
              <p>Latitude: {location.lat.toFixed(4)}</p>
              <p>Longitude: {location.lon.toFixed(4)}</p>
            </div>

            <button
              onClick={() => getWeatherProfile()}
              disabled={loading || !scriptsLoaded}
              className="mt-2 bg-blue-600 hover:bg-blue-700 p-3 rounded disabled:bg-gray-600"
            >
              {loading ? "Loading..." : "Check Weather"}
            </button>

            <p className="mt-4 rounded bg-yellow-900 text-yellow-300 p-2 font-semibold text-center">
              Please note that the data shown below might not be accurate — values are derived from NASA historical observations and used to estimate likely conditions.
            </p>
          </div>

          <div id="map" className="shadow-lg bg-gray-700 rounded-lg h-96 flex items-center justify-center relative"></div>
        </div>

        {error && <div className="bg-red-700 p-3 rounded text-white mb-4">{error}</div>}

        {analysis && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-white mb-6">
            <h2 className="text-xl mb-4 text-blue-200">Weather Profile (historical-based forecast)</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 grid grid-cols-2 gap-4">
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                  <h3 className="text-white font-semibold mb-2">Avg Temp</h3>
                  <p className="text-2xl font-bold text-blue-300">{analysis.avgMaxTemp}°{tempUnit}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                  <h3 className="text-white font-semibold mb-2">Chance of Rain</h3>
                  <p className="text-2xl font-bold text-blue-300">{analysis.changeOfPrecip}%</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                  <h3 className="text-white font-semibold mb-2">Extreme Heat</h3>
                  <p className="text-2xl font-bold text-blue-300">{analysis.changeOfExtremeHeat}%</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                  <h3 className="text-white font-semibold mb-2">Air Quality</h3>
                  <p className="text-2xl font-bold text-blue-300">{analysis.avgAirQuality}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                  <h3 className="text-white font-semibold mb-2">Avg Wind</h3>
                  <p className="text-2xl font-bold text-blue-300">{analysis.avgWindSpeed} {windUnit}</p>
                </div>
              </div>

              <div className="lg:col-span-2 bg-gray-700 p-4 rounded-lg">
                <canvas id="weatherChart" className="w-full h-64 lg:h-80"></canvas>
                <div className="mt-3 text-right">
                  <button onClick={downloadCSV} className="bg-green-600 p-2 rounded text-white">Download CSV</button>
                </div>
              </div>
            </div>

            {/* Summary box */}
            <div className="mt-6 bg-gray-700 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">Suitability summary</h3>
              {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {summary.map((s) => (
                    <div key={s.activity} className={`p-3 rounded ${s.suitable ? "bg-green-900 text-green-200" : "bg-red-900 text-red-200"}`}>
                      <div className="font-semibold">{s.activity}</div>
                      <div className="text-sm">
                        {s.suitable ? "Suitable" : `Not suitable — ${s.reason ?? "conditions unfavourable"}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
