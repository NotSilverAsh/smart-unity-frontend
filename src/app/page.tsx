/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import Head from "next/head";

interface Location {
  lat: number;
  lon: number;
  name?: string;
}

interface ForecastDay {
  date: string;
  temperature: number;
  max_temp: number;
  min_temp: number;
  precipitation: number;
  wind_speed: number;
  humidity: string;
  pressure: number;
  weather_code: string;
  conditions: string;
  feels_like?: number;
}

interface CurrentWeather {
  temperature: number;
  feels_like: number;
  humidity: string;
  wind_speed: number;
  pressure: number;
  conditions: string;
  weather_code: string;
  data_quality?: string;
  measurement_height?: string;
}

interface WeatherData {
  current: CurrentWeather;
  forecast: ForecastDay[];
  location: string;
  data_source?: string;
  nasa_mission?: string;
  probabilities?: {
    temperature_above?: number;
    precipitation_above?: number;
    windspeed_above?: number;
  };
  user_thresholds?: {
    temperature?: number;
    precipitation?: number;
    windSpeed?: number;
  };
}

declare global {
  interface Window {
    L: any;
    Chart: any;
  }
}

export default function Home() {
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [location, setLocation] = useState<Location>({
    lat: 40.7128,
    lon: -74.006,
    name: "New York",
  });
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Location[]>([]);

  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const chartRef = useRef<any>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light" | "blue">("dark");
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");
  const [windUnit, setWindUnit] = useState<"m/s" | "km/h" | "mph">("m/s");

  const [userThresholds, setUserThresholds] = useState({
    temperature: null as number | null,
    precipitation: null as number | null,
    windSpeed: null as number | null,
  });

  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [showReposModal, setShowReposModal] = useState(false);

  const API_BASE_URL = "https://api.sharkybytes.xyz";
  // const API_BASE_URL = "http://localhost:80";

  // Project repositories data
  const projectRepos = [
    {
      name: "smart-unity-backend",
      url: "https://github.com/NotSilverAsh/smart-unity-backend",
      description: "Backend API for the Smart Unity Weather Dashboard"
    },
    {
      name: "smart-unity-frontend",
      url: "https://github.com/NotSilverAsh/smart-unity-frontend", 
      description: "Frontend React application for the Smart Unity Weather Dashboard"
    }
  ];

  // Threshold input modal component - FIXED Z-INDEX
  const ThresholdModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]">
      <div className="bg-gray-800 p-6 rounded-lg w-96 max-w-90vw mx-4">
        <h3 className="text-xl mb-4 text-white">Set Weather Thresholds</h3>

        <div className="space-y-4">
          <div>
            <label className="text-white block mb-2">
              Temperature above (°{tempUnit})
            </label>
            <input
              type="number"
              className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder={`e.g., ${tempUnit === "C" ? "30" : "86"}`}
              value={userThresholds.temperature || ""}
              onChange={(e) =>
                setUserThresholds((prev) => ({
                  ...prev,
                  temperature: e.target.value
                    ? parseFloat(e.target.value)
                    : null,
                }))
              }
            />
          </div>

          <div>
            <label className="text-white block mb-2">
              Precipitation above (mm)
            </label>
            <input
              type="number"
              className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., 5"
              value={userThresholds.precipitation || ""}
              onChange={(e) =>
                setUserThresholds((prev) => ({
                  ...prev,
                  precipitation: e.target.value
                    ? parseFloat(e.target.value)
                    : null,
                }))
              }
            />
          </div>

          <div>
            <label className="text-white block mb-2">
              Wind Speed above ({windUnit})
            </label>
            <input
              type="number"
              className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., 10"
              value={userThresholds.windSpeed || ""}
              onChange={(e) =>
                setUserThresholds((prev) => ({
                  ...prev,
                  windSpeed: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition-colors"
            onClick={() => {
              setShowThresholdModal(false);
              getWeatherForecast();
            }}
          >
            Apply Thresholds
          </button>
          <button
            className="flex-1 bg-gray-600 text-white p-2 rounded hover:bg-gray-700 transition-colors"
            onClick={() => setShowThresholdModal(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  // Repositories modal component
  const ReposModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]">
      <div className="bg-gray-800 p-6 rounded-lg w-96 max-w-90vw mx-4 max-h-80vh overflow-y-auto">
        <h3 className="text-xl mb-4 text-white">Project Repositories</h3>
        
        <div className="space-y-4">
          {projectRepos.map((repo, index) => (
            <div key={index} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
              <h4 className="text-lg font-semibold text-white mb-2">{repo.name}</h4>
              <p className="text-gray-300 text-sm mb-3">{repo.description}</p>
              <a 
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                View on GitHub
              </a>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            className="flex-1 bg-gray-600 text-white p-2 rounded hover:bg-gray-700 transition-colors"
            onClick={() => setShowReposModal(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css";
    document.head.appendChild(link);

    const leafletScript = document.createElement("script");
    leafletScript.src = "https://unpkg.com/leaflet@1.7.1/dist/leaflet.js";
    leafletScript.onload = () => {
      const chartScript = document.createElement("script");
      chartScript.src = "https://cdn.jsdelivr.net/npm/chart.js";
      chartScript.onload = () => setScriptsLoaded(true);
      document.body.appendChild(chartScript);
    };
    document.body.appendChild(leafletScript);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      getWeatherForecast(location.lat, location.lon);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocation({ lat, lon, name: "Current location" });
        getWeatherForecast(lat, lon);
      },
      (err) => {
        console.warn("Geolocation error:", err.message);
        getWeatherForecast(location.lat, location.lon);
      },
      { maximumAge: 60_000, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    if (!scriptsLoaded || !window.L || mapRef.current) return;

    const map = window.L.map("map").setView([location.lat, location.lon], 10);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const marker = window.L.marker([location.lat, location.lon], {
      draggable: true,
    }).addTo(map);
    markerRef.current = marker;
    mapRef.current = map;

    let timer: NodeJS.Timeout | null = null;
    marker.on("dragend", () => {
      const latlng = marker.getLatLng();
      setLocation((prev) => ({ ...prev, lat: latlng.lat, lon: latlng.lng }));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        getWeatherForecast(latlng.lat, latlng.lng);
      }, 350);
    });

    map.on("click", (e: any) => {
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;
      setLocation((prev) => ({ ...prev, lat, lon }));
      markerRef.current?.setLatLng([lat, lon]);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        getWeatherForecast(lat, lon);
      }, 200);
    });

    map.setView([location.lat, location.lon], 10);
  }, [scriptsLoaded]);

  useEffect(() => {
    if (!mapRef.current) return;
    try {
      mapRef.current.setView([location.lat, location.lon], 10);
      markerRef.current?.setLatLng([location.lat, location.lon]);
    } catch (e) {
      // ignore
    }
  }, [location]);

  const getWeatherForecast = async (lat?: number, lon?: number) => {
    setLoading(true);
    setError("");
    const fetchLat = typeof lat === "number" ? lat : location.lat;
    const fetchLon = typeof lon === "number" ? lon : location.lon;

    try {
      // Build query parameters
      const params = new URLSearchParams({
        lat: fetchLat.toString(),
        lon: fetchLon.toString(),
      });

      // Add thresholds if any are set
      const activeThresholds = Object.fromEntries(
        Object.entries(userThresholds).filter(([_, value]) => value !== null)
      );

      if (Object.keys(activeThresholds).length > 0) {
        params.append("thresholds", JSON.stringify(activeThresholds));
      }

      const res = await fetch(
        `${API_BASE_URL}/api/v1/weather?${params.toString()}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      const payload = await res.json();

      const convertTemp = (temp: number) =>
        tempUnit === "F" ? (temp * 9) / 5 + 32 : temp;

      const convertWind = (wind: number) => {
        if (windUnit === "km/h") return wind * 3.6;
        if (windUnit === "mph") return wind * 2.237;
        return wind;
      };

      const convertedForecast = payload.forecast.map((day: any) => ({
        ...day,
        temperature: convertTemp(day.temperature),
        max_temp: convertTemp(day.max_temp),
        min_temp: convertTemp(day.min_temp),
        wind_speed: convertWind(day.wind_speed),
        humidity: day.humidity,
        feels_like: day.feels_like
          ? convertTemp(day.feels_like)
          : convertTemp(day.temperature),
      }));

      const convertedCurrent = {
        ...payload.current,
        temperature: convertTemp(payload.current.temperature),
        feels_like: payload.current.feels_like
          ? convertTemp(payload.current.feels_like)
          : convertTemp(payload.current.temperature),
        wind_speed: convertWind(payload.current.wind_speed),
        humidity: payload.current.humidity,
      };

      setWeatherData({
        current: convertedCurrent,
        forecast: convertedForecast,
        location: payload.location,
        data_source: payload.data_source,
        nasa_mission: payload.nasa_mission,
        probabilities: payload.probabilities,
        user_thresholds: payload.user_thresholds,
      });
      setError("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error("getWeatherForecast error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!weatherData?.forecast || !window.Chart || !scriptsLoaded) return;

    const canvas = document.getElementById(
      "forecastChart"
    ) as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const labels = weatherData.forecast.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    });

    const maxTemps = weatherData.forecast.map((d) => d.max_temp || 0);
    const minTemps = weatherData.forecast.map((d) => d.min_temp || 0);
    const precip = weatherData.forecast.map((d) => d.precipitation || 0);

    // Mobile detection and responsive settings
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth < 1024;

    chartRef.current = new window.Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `Max Temp (°${tempUnit})`,
            data: maxTemps,
            borderColor: "rgb(255, 99, 132)",
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            borderWidth: isMobile ? 3 : 2,
            yAxisID: "y",
            tension: 0.4,
            pointRadius: isMobile ? 4 : 3,
            pointHoverRadius: isMobile ? 6 : 5,
          },
          {
            label: `Min Temp (°${tempUnit})`,
            data: minTemps,
            borderColor: "rgb(54, 162, 235)",
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            borderWidth: isMobile ? 3 : 2,
            yAxisID: "y",
            tension: 0.4,
            pointRadius: isMobile ? 4 : 3,
            pointHoverRadius: isMobile ? 6 : 5,
          },
          {
            label: "Precipitation (mm)",
            data: precip,
            borderColor: "rgb(75, 192, 192)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            borderWidth: isMobile ? 3 : 2,
            yAxisID: "y1",
            tension: 0.4,
            type: "bar",
            barPercentage: isMobile ? 0.6 : 0.8,
            categoryPercentage: 0.8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // This is key for mobile!
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            labels: {
              color: theme === "light" ? "#000" : "#fff",
              font: {
                size: isMobile ? 12 : 14,
              },
            },
            position: isMobile ? "bottom" : "top",
          },
          title: {
            display: true,
            text: "7-Day Forecast",
            color: theme === "light" ? "#000" : "#fff",
            font: {
              size: isMobile ? 14 : 16,
            },
          },
          tooltip: {
            titleFont: {
              size: isMobile ? 12 : 14,
            },
            bodyFont: {
              size: isMobile ? 12 : 14,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: theme === "light" ? "#000" : "#fff",
              font: {
                size: isMobile ? 10 : 12,
              },
              maxRotation: isMobile ? 45 : 0,
              autoSkip: true,
              maxTicksLimit: isMobile ? 7 : 12,
            },
            grid: { color: "#444" },
          },
          y: {
            type: "linear",
            display: true,
            position: "left",
            ticks: {
              color: theme === "light" ? "#000" : "#fff",
              font: {
                size: isMobile ? 10 : 12,
              },
            },
            grid: { color: "#444" },
            title: {
              display: true,
              text: `Temperature (°${tempUnit})`,
              color: theme === "light" ? "#000" : "#fff",
              font: {
                size: isMobile ? 11 : 13,
              },
            },
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            ticks: {
              color: theme === "light" ? "#000" : "#fff",
              font: {
                size: isMobile ? 10 : 12,
              },
            },
            grid: { drawOnChartArea: false, color: "#444" },
            title: {
              display: true,
              text: "Precipitation (mm)",
              color: theme === "light" ? "#000" : "#fff",
              font: {
                size: isMobile ? 11 : 13,
              },
            },
          },
        },
        layout: {
          padding: isMobile ? 10 : 20,
        },
      },
    });
  }, [weatherData, tempUnit, scriptsLoaded, theme]);

  const downloadData = async (format: "csv" | "json") => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/weather/download?lat=${location.lat}&lon=${location.lon}&format=${format}`
      );

      if (!response.ok) throw new Error("Download failed");

      if (format === "csv") {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nasa_weather_${location.lat}_${location.lon}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nasa_weather_${location.lat}_${location.lon}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      setError("Download failed: " + (error as Error).message);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          searchQuery
        )}&format=json&limit=6`
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
    getWeatherForecast(l.lat, l.lon);
  };

  const getTodaysSuitability = () => {
    if (!weatherData?.forecast?.[0]) return null;

    const today = weatherData.forecast[0];

    // Helper to extract numeric humidity value
    const getHumidityValue = (humidity: string | number): number => {
      if (typeof humidity === "number") return humidity;
      if (typeof humidity === "string") {
        return parseFloat(humidity.replace("%", "")) || 0;
      }
      return 0;
    };

    const humidityValue = getHumidityValue(today.humidity);

    const result: { activity: string; suitable: boolean; reason?: string }[] =
      [];

    const hikingBad =
      (today.precipitation || 0) > 2 ||
      (today.wind_speed || 0) > 8 ||
      (today.max_temp || 0) > (tempUnit === "F" ? 95 : 35);
    result.push({
      activity: "Hiking",
      suitable: !hikingBad,
      reason: hikingBad
        ? (today.precipitation || 0) > 2
          ? "Rain expected"
          : (today.wind_speed || 0) > 8
          ? "Too windy"
          : "Too hot"
        : undefined,
    });

    const beachBad =
      (today.precipitation || 0) > 1 ||
      (today.max_temp || 0) < (tempUnit === "F" ? 70 : 21);
    result.push({
      activity: "Beach",
      suitable: !beachBad,
      reason: beachBad
        ? (today.precipitation || 0) > 1
          ? "Rain expected"
          : "Too cool"
        : undefined,
    });

    const cyclingBad =
      (today.precipitation || 0) > 2 || (today.wind_speed || 0) > 12;
    result.push({
      activity: "Cycling",
      suitable: !cyclingBad,
      reason: cyclingBad
        ? (today.precipitation || 0) > 2
          ? "Rain expected"
          : "Too windy"
        : undefined,
    });

    const eventBad = (today.precipitation || 0) > 3;
    result.push({
      activity: "Outdoor Event",
      suitable: !eventBad,
      reason: eventBad ? "High chance of rain" : undefined,
    });

    return result;
  };

  const suitability = getTodaysSuitability();

  const themeClass =
    theme === "light"
      ? "bg-gray-100 text-black"
      : theme === "blue"
      ? "bg-blue-900 text-white"
      : "bg-gray-900 text-white";

  const getWeatherIcon = (conditions: string) => {
    if (!conditions) return "🌈";
    if (conditions.includes("Clear")) return "☀️";
    if (conditions.includes("Cloud")) return "☁️";
    if (conditions.includes("Rain") || conditions.includes("Shower"))
      return "🌧️";
    if (conditions.includes("Thunderstorm")) return "⛈️";
    if (conditions.includes("Snow")) return "❄️";
    if (conditions.includes("Mist") || conditions.includes("Fog")) return "🌫️";
    if (conditions.includes("Drizzle")) return "🌦️";
    return "🌈";
  };

  return (
    <>
      <div
        className={`${themeClass} min-h-screen p-4 transition-colors duration-300`}
      >
        {showThresholdModal && <ThresholdModal />}
        {showReposModal && <ReposModal />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-8">
          <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg flex flex-col justify-start text-white">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl sm:text-2xl font-semibold text-blue-200">
                RainAware Weather Dashboard
              </h2>
              <button
                onClick={() => setShowReposModal(true)}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Source Code
              </button>
            </div>

            <input
              type="text"
              placeholder="Search city or location..."
              className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />

            <div className="flex gap-2 mb-3">
              <button
                className="flex-1 bg-blue-600 hover:bg-blue-700 p-2 rounded transition-colors text-sm sm:text-base"
                onClick={handleSearch}
              >
                Search
              </button>
              <button
                className="bg-gray-600 hover:bg-gray-500 p-2 rounded text-white transition-colors text-sm sm:text-base"
                onClick={() => {
                  if (!("geolocation" in navigator)) {
                    setError("Geolocation is not supported by your browser");
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const lat = pos.coords.latitude;
                      const lon = pos.coords.longitude;
                      setLocation({ lat, lon, name: "Current location" });
                      mapRef.current?.setView([lat, lon], 10);
                      markerRef.current?.setLatLng([lat, lon]);
                      getWeatherForecast(lat, lon);
                    },
                    (err) => {
                      setError(`Geolocation error: ${err.message}`);
                      console.warn("Geolocation error:", err.message);
                    }
                  );
                }}
              >
                Use my location
              </button>
            </div>

            {suggestions.length > 0 && (
              <div className="bg-gray-700 rounded mb-4 max-h-40 overflow-y-auto border border-gray-600">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="p-2 hover:bg-blue-600 cursor-pointer text-white border-b border-gray-600 last:border-b-0"
                    onClick={() => selectSuggestion(s)}
                  >
                    <div className="text-sm sm:text-base">{s.name}</div>
                    <div className="text-xs text-gray-300">
                      {s.lat.toFixed(4)}, {s.lon.toFixed(4)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-2 text-xs sm:text-sm">
              <p>Latitude: {location.lat.toFixed(4)}</p>
              <p>Longitude: {location.lon.toFixed(4)}</p>
              <br />
              <p className="mt-4 rounded bg-yellow-900 text-yellow-300 p-2 font-semibold text-center">
                Please note: Weather data combines NASA satellite observations
                with climate models and may not reflect real-time conditions.
              </p>
            </div>

            <div className="flex gap-2 mb-3 flex-col sm:flex-row">
              <button
                onClick={() => getWeatherForecast()}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 p-3 rounded disabled:bg-gray-600 transition-colors text-sm sm:text-base"
              >
                {loading ? "Fetching Data..." : "Get Weather"}
              </button>
              <button
                className="bg-purple-600 hover:bg-purple-700 p-3 rounded text-white transition-colors text-sm sm:text-base"
                onClick={() => setShowThresholdModal(true)}
              >
                Set Thresholds
              </button>
            </div>

            <div className="flex gap-2 flex-col sm:flex-row">
              <button
                className="flex-1 bg-green-600 hover:bg-green-700 p-2 rounded text-white transition-colors text-sm sm:text-base"
                onClick={() => downloadData("csv")}
              >
                Download CSV
              </button>
              <button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 p-2 rounded text-white transition-colors text-sm sm:text-base"
                onClick={() => downloadData("json")}
              >
                Download JSON
              </button>
            </div>
          </div>

          <div
            id="map"
            className="shadow-lg bg-gray-700 rounded-lg h-64 sm:h-80 lg:h-96 flex items-center justify-center relative z-0"
          >
            {!scriptsLoaded && <div className="text-white">Loading map...</div>}
          </div>
        </div>

        {error && (
          <div className="bg-red-700 p-3 rounded text-white mb-4 text-sm sm:text-base">
            {error}
          </div>
        )}

        {weatherData?.probabilities &&
          Object.keys(weatherData.probabilities).length > 0 && (
            <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg text-white mb-6">
              <h2 className="text-xl sm:text-2xl mb-4 text-blue-200">
                Probability Analysis
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {userThresholds.temperature !== null &&
                  weatherData.probabilities.temperature_above && (
                    <div className="bg-gray-700 p-3 sm:p-4 rounded-lg text-center">
                      <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">
                        Temperature &gt; {userThresholds.temperature}°{tempUnit}
                      </h3>
                      <div className="text-2xl sm:text-3xl font-bold text-orange-300">
                        {weatherData.probabilities.temperature_above}%
                      </div>
                      <p className="text-xs sm:text-sm text-gray-300 mt-2">
                        Historical probability based on NASA data
                      </p>
                    </div>
                  )}

                {userThresholds.precipitation !== null &&
                  weatherData.probabilities.precipitation_above && (
                    <div className="bg-gray-700 p-3 sm:p-4 rounded-lg text-center">
                      <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">
                        Precipitation &gt; {userThresholds.precipitation}mm
                      </h3>
                      <div className="text-2xl sm:text-3xl font-bold text-blue-300">
                        {weatherData.probabilities.precipitation_above}%
                      </div>
                      <p className="text-xs sm:text-sm text-gray-300 mt-2">
                        Chance of exceeding threshold
                      </p>
                    </div>
                  )}

                {userThresholds.windSpeed !== null &&
                  weatherData.probabilities.windspeed_above && (
                    <div className="bg-gray-700 p-3 sm:p-4 rounded-lg text-center">
                      <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">
                        Wind Speed &gt; {userThresholds.windSpeed}
                        {windUnit}
                      </h3>
                      <div className="text-2xl sm:text-3xl font-bold text-green-300">
                        {weatherData.probabilities.windspeed_above}%
                      </div>
                      <p className="text-xs sm:text-sm text-gray-300 mt-2">
                        Probability of windy conditions
                      </p>
                    </div>
                  )}
              </div>

              {Object.keys(userThresholds).filter(
                (k) => userThresholds[k as keyof typeof userThresholds] !== null
              ).length === 0 && (
                <div className="text-center text-gray-400 py-4 text-sm sm:text-base">
                  Set thresholds above to see probability analysis
                </div>
              )}
            </div>
          )}

        {weatherData?.current && (
          <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg text-white mb-6">
            <h2 className="text-xl sm:text-2xl mb-4 text-blue-200">
              Current Weather - {weatherData.location}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <div className="bg-gray-700 p-3 sm:p-4 rounded-lg text-center">
                <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">
                  Temperature
                </h3>
                <p className="text-xl sm:text-3xl font-bold text-blue-300">
                  {weatherData.current.temperature !== null &&
                  weatherData.current.temperature !== undefined
                    ? `${weatherData.current.temperature.toFixed(
                        1
                      )}°${tempUnit}`
                    : "N/A"}
                </p>
                <p className="text-xs sm:text-sm text-gray-300">
                  Feels like:{" "}
                  {weatherData.current.feels_like !== null &&
                  weatherData.current.feels_like !== undefined
                    ? `${weatherData.current.feels_like.toFixed(1)}°${tempUnit}`
                    : "N/A"}
                </p>
              </div>
              <div className="bg-gray-700 p-3 sm:p-4 rounded-lg text-center">
                <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">
                  Conditions
                </h3>
                <p className="text-lg sm:text-2xl font-bold text-green-300">
                  {getWeatherIcon(weatherData.current.conditions)}{" "}
                  {weatherData.current.conditions || "N/A"}
                </p>
              </div>
              <div className="bg-gray-700 p-3 sm:p-4 rounded-lg text-center">
                <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">
                  Wind
                </h3>
                <p className="text-xl sm:text-3xl font-bold text-yellow-300">
                  {weatherData.current.wind_speed !== null &&
                  weatherData.current.wind_speed !== undefined
                    ? `${weatherData.current.wind_speed.toFixed(1)} ${windUnit}`
                    : "N/A"}
                </p>
              </div>
              <div className="bg-gray-700 p-3 sm:p-4 rounded-lg text-center">
                <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">
                  Humidity
                </h3>
                <p className="text-xl sm:text-3xl font-bold text-purple-300">
                  {weatherData.current.humidity !== null &&
                  weatherData.current.humidity !== undefined
                    ? `${weatherData.current.humidity}`
                    : "N/A"}
                </p>
              </div>
            </div>

            {weatherData.data_source && (
              <div className="mt-4 p-3 bg-blue-900 rounded-lg">
                <p className="text-xs sm:text-sm text-blue-200">
                  <strong>NASA Data Source:</strong> {weatherData.data_source}
                  {weatherData.nasa_mission &&
                    ` | Mission: ${weatherData.nasa_mission}`}
                </p>
              </div>
            )}
          </div>
        )}

        {suitability && (
          <div className="mt-6 bg-gray-700 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">
              Today's Activity Suitability
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {suitability.map((s) => (
                <div
                  key={s.activity}
                  className={`p-3 rounded transition-colors ${
                    s.suitable
                      ? "bg-green-900 text-green-200 hover:bg-green-800"
                      : "bg-red-900 text-red-200 hover:bg-red-800"
                  }`}
                >
                  <div className="font-semibold text-sm sm:text-base">
                    {s.activity}
                  </div>
                  <div className="text-xs sm:text-sm">
                    {s.suitable
                      ? "✅ Suitable"
                      : `❌ Not suitable — ${
                          s.reason ?? "conditions unfavorable"
                        }`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {weatherData?.forecast && (
          <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg text-white mb-6">
            <h2 className="text-xl sm:text-2xl mb-4 text-blue-200">
              7-Day Forecast
            </h2>

            <div className="mb-6 bg-gray-700 p-4 rounded-lg">
              <div className="h-64 sm:h-80 md:h-96">
                <canvas id="forecastChart" className="w-full h-full"></canvas>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-4">
              {weatherData.forecast.map((day, index) => (
                <div
                  key={index}
                  className="bg-gray-700 p-3 sm:p-4 rounded-lg text-center hover:bg-gray-600 transition-colors"
                >
                  <div className="font-semibold mb-2 text-sm sm:text-base">
                    {new Date(day.date).toLocaleDateString("en-US", {
                      weekday: "short",
                    })}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-300 mb-2">
                    {new Date(day.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div className="text-xl sm:text-2xl mb-2">
                    {getWeatherIcon(day.conditions)}
                  </div>
                  <div className="text-base sm:text-lg font-bold text-blue-300">
                    {day.max_temp !== null && day.max_temp !== undefined
                      ? `${day.max_temp.toFixed(0)}°${tempUnit}`
                      : "N/A"}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-300">
                    {day.min_temp !== null && day.min_temp !== undefined
                      ? `${day.min_temp.toFixed(0)}°${tempUnit}`
                      : "N/A"}
                  </div>
                  <div className="text-xs sm:text-sm mt-2">
                    💧{" "}
                    {day.precipitation !== null &&
                    day.precipitation !== undefined
                      ? `${day.precipitation.toFixed(1)}mm`
                      : "N/A"}
                  </div>
                  <div className="text-xs sm:text-sm">
                    💨{" "}
                    {day.wind_speed !== null && day.wind_speed !== undefined
                      ? `${day.wind_speed.toFixed(1)}${windUnit}`
                      : "N/A"}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    {day.conditions || "N/A"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}