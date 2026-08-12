import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { env } from '@/config/env.js';

import type { RegisteredTool } from './tool.types.js';

const NAME = 'get_weather';
const DESCRIPTION =
  'Gets the current weather (temperature, humidity, wind, conditions) for a city or place name.';

const schema = z.object({
  location: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe('A city or place name, e.g. "Tokyo" or "London, UK".'),
});

type WeatherArgs = z.infer<typeof schema>;

/** A handful of common WMO weather codes (the forecast API's `weather_code`) — not exhaustive, just enough for a readable summary. */
const WMO_CONDITIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
};

interface GeocodingResult {
  results?: { name: string; country?: string; latitude: number; longitude: number }[];
}

interface ForecastResult {
  current?: {
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API request failed with status ${response.status}.`);
  }
  return (await response.json()) as T;
}

/**
 * Two-step call to Open-Meteo — free and keyless, unlike most weather APIs
 * (no `WEATHER_API_KEY`-style secret to provision). First resolves the
 * place name to coordinates (geocoding), then fetches the current
 * conditions at those coordinates (forecast).
 */
async function execute({ location }: WeatherArgs): Promise<{
  location: string;
  country?: string;
  temperatureC: number;
  humidityPercent: number;
  windSpeedKmh: number;
  conditions: string;
}> {
  const geocoding = await fetchJson<GeocodingResult>(
    `${env.TOOLS_WEATHER_GEOCODING_URL}?name=${encodeURIComponent(location)}&count=1`,
  );
  const match = geocoding.results?.[0];

  if (!match) {
    throw new Error(`Could not find a location matching "${location}".`);
  }

  const forecast = await fetchJson<ForecastResult>(
    `${env.TOOLS_WEATHER_FORECAST_URL}?latitude=${match.latitude}&longitude=${match.longitude}` +
      '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
  );

  if (!forecast.current) {
    throw new Error(`Weather data is unavailable for "${location}" right now.`);
  }

  return {
    location: match.name,
    ...(match.country ? { country: match.country } : {}),
    temperatureC: forecast.current.temperature_2m,
    humidityPercent: forecast.current.relative_humidity_2m,
    windSpeedKmh: forecast.current.wind_speed_10m,
    conditions: WMO_CONDITIONS[forecast.current.weather_code] ?? 'Unknown conditions',
  };
}

export function createWeatherTool(): RegisteredTool {
  return {
    name: NAME,
    description: DESCRIPTION,
    schema,
    execute,
    structuredTool: tool(execute, { name: NAME, description: DESCRIPTION, schema }),
  } as unknown as RegisteredTool;
}
