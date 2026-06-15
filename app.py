import os
from flask import Flask, jsonify, render_template, request
import requests

app = Flask(__name__)

API_KEY = "c32d73d45ad7139089fdbe987acfd295"
CURRENT_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"

def get_ui_condition(weather_id, icon, is_night):
    if 200 <= weather_id < 300:
        return 'stormy'
    elif 300 <= weather_id < 600:
        return 'rainy'
    elif 600 <= weather_id < 700:
        return 'snowy'
    elif 700 <= weather_id < 800:
        return 'cloudy'  # Fog/Mist/Haze
    elif weather_id == 800:
        return 'night' if is_night else 'sunny'
    elif 800 < weather_id < 900:
        return 'cloudy'
    return 'sunny'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/weather')
def get_weather():
    city = request.args.get('q')
    lat = request.args.get('lat')
    lon = request.args.get('lon')

    if not city and (not lat or not lon):
        return jsonify({"success": False, "error": "Missing query parameter 'q' or coordinates 'lat' and 'lon'"}), 400

    params = {
        "appid": API_KEY,
        "units": "metric"
    }
    if city:
        params["q"] = city
    else:
        params["lat"] = lat
        params["lon"] = lon

    try:
        # Fetch current weather
        curr_resp = requests.get(CURRENT_WEATHER_URL, params=params)
        if curr_resp.status_code == 404:
            return jsonify({"success": False, "error": "City not found. Please check spelling."}), 404
        elif curr_resp.status_code != 200:
            return jsonify({"success": False, "error": f"Weather API error: {curr_resp.reason}"}), curr_resp.status_code

        current_data = curr_resp.json()

        # Fetch forecast weather
        fore_resp = requests.get(FORECAST_URL, params=params)
        forecast_data = None
        if fore_resp.status_code == 200:
            forecast_data = fore_resp.json()

    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": f"Network error: {str(e)}"}), 500

    # Process Current Weather
    try:
        dt = current_data.get('dt', 0)
        sys = current_data.get('sys', {})
        sunrise = sys.get('sunrise', 0)
        sunset = sys.get('sunset', 0)
        
        # Determine if it's night at target location
        is_night = dt < sunrise or dt > sunset

        weather_info = current_data.get('weather', [{}])[0]
        weather_id = weather_info.get('id', 800)
        icon = weather_info.get('icon', '01d')
        condition = get_ui_condition(weather_id, icon, is_night)

        processed_current = {
            "city": current_data.get('name'),
            "country": sys.get('country'),
            "temp": current_data.get('main', {}).get('temp'),
            "feels_like": current_data.get('main', {}).get('feels_like'),
            "temp_min": current_data.get('main', {}).get('temp_min'),
            "temp_max": current_data.get('main', {}).get('temp_max'),
            "humidity": current_data.get('main', {}).get('humidity'),
            "pressure": current_data.get('main', {}).get('pressure'),
            "wind_speed": current_data.get('wind', {}).get('speed'),
            "wind_deg": current_data.get('wind', {}).get('deg'),
            "clouds": current_data.get('clouds', {}).get('all', 0),
            "description": weather_info.get('description', '').title(),
            "condition": condition,
            "is_night": is_night,
            "sunrise": sunrise,
            "sunset": sunset,
            "timezone": current_data.get('timezone', 0),
            "dt": dt
        }

        # Process Forecast
        processed_forecast = []
        if forecast_data and 'list' in forecast_data:
            for item in forecast_data['list']:
                f_weather_info = item.get('weather', [{}])[0]
                f_weather_id = f_weather_info.get('id', 800)
                f_icon = f_weather_info.get('icon', '01d')
                
                # Check night for forecast times
                f_dt = item.get('dt', 0)
                f_is_night = f_dt < sunrise or f_dt > sunset # Approximated based on current day sunrise/sunset
                f_condition = get_ui_condition(f_weather_id, f_icon, f_is_night)

                processed_forecast.append({
                    "dt": f_dt,
                    "temp": item.get('main', {}).get('temp'),
                    "description": f_weather_info.get('description', '').title(),
                    "condition": f_condition,
                    "icon": f_icon,
                    "is_night": f_is_night,
                    "pop": item.get('pop', 0)  # Probability of precipitation
                })

        return jsonify({
            "success": True,
            "current": processed_current,
            "forecast": processed_forecast
        })

    except KeyError as e:
        return jsonify({"success": False, "error": f"Data processing error: missing key {str(e)}"}), 500

if __name__ == '__main__':
    # Listen on all interfaces so it's easy to access if needed
    app.run(host='0.0.0.0', port=5000, debug=True)
