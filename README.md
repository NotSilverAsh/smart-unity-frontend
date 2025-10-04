# ⚠️ WARNING: Weather Data May Not Be Accurate

> This frontend uses the NASA Weather Forecast API. The data may not always be up-to-date or accurate.  
> Intended for educational and research purposes only. **Do not rely on it for safety-critical decisions.**

---

# NASA Weather Forecast Frontend 🌤️

A frontend interface that fetches weather forecast data from the NASA Weather Forecast API.  
Built to display real-time weather, 7-day forecasts, and probability calculations.

---

## 🚀 Features

- Fetch current weather conditions  
- 7-day weather forecast  
- Probability calculations for temperature, precipitation, and wind  
- Desert-specific climate detection  
- Download data in CSV or JSON format  

---

## 🎯 API Usage

### Get Weather Forecast

\```javascript
const lat = 40.7128; // Latitude
const lon = -74.0060; // Longitude

async function getWeather(lat, lon, thresholds = null) {
  try {
    let url = `/api/v1/weather?lat=${lat}&lon=${lon}`;
    if (thresholds) url += `&thresholds=${JSON.stringify(thresholds)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather data fetch failed');
    
    const data = await response.json();
    console.log('Weather Data:', data);
    return data;
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    return null;
  }
}

// Example call
getWeather(lat, lon);
\```

### Download Weather Data

\```javascript
const format = 'json'; // or 'csv'
const downloadUrl = `/api/v1/weather/download?lat=${lat}&lon=${lon}&format=${format}`;
window.open(downloadUrl);
\```

---

## 🏜️ Desert Regions

Automatically provides specialized calculations for:  
- Sahara, Arabian, Gobi  
- Australian, North American  
- Kalahari, Thar, Syrian  

---

## 📈 Probability Calculations

\```javascript
const thresholds = {
  temperature: 25,
  precipitation: 5,
  windSpeed: 10
};

getWeather(lat, lon, thresholds);
\```

---

## 🔧 Notes

- Designed **only for frontend integration**  
- Relies on the NASA Weather Forecast API  
- Color-coded console logs (for debugging):
  - 🔵 API attempts  
  - 🟡 Warnings/fallbacks  
  - 🟢 Success  
  - 🔴 Errors  
  - 🟣 Debug info