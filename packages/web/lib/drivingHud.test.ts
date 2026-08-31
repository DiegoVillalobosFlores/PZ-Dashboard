import { expect, test } from 'bun:test';
import type { VehiclesSnapshot } from './liveTypes';
import {
  climateLabel,
  DRIVING_HUD_STALE_AFTER_MS,
  etaSeconds,
  formatDuration,
  getCurrentVehicle,
  isLowFuel,
  isVehicleStale,
  LOW_FUEL_THRESHOLD,
  rangeKm,
  SQUARES_PER_KM,
  updateFuelTrend,
  vehicleDisplayName,
  worstTire,
} from '../components/DrivingHud';
import { polylineLength } from './navTarget';

const snapshot = (current: boolean): VehiclesSnapshot => ({
  vehicles: [
    { id: 1, name: 'Parked', x: 0, y: 0, z: 0, current: false },
    { id: 2, name: 'Current', x: 1, y: 1, z: 0, current },
  ],
});

test('derives current vehicle from vehicles snapshot', () => {
  expect(getCurrentVehicle(snapshot(true))?.name).toBe('Current');
  expect(getCurrentVehicle(snapshot(false))).toBeNull();
});

test('uses vanilla low-fuel warning threshold', () => {
  expect(LOW_FUEL_THRESHOLD).toBe(15);
  expect(isLowFuel(14.99)).toBe(true);
  expect(isLowFuel(15)).toBe(false);
  expect(isLowFuel(undefined)).toBe(false);
});

test('marks vehicle readings stale after several expected intervals', () => {
  expect(isVehicleStale(1000, 1000 + DRIVING_HUD_STALE_AFTER_MS)).toBe(false);
  expect(isVehicleStale(1000, 1001 + DRIVING_HUD_STALE_AFTER_MS)).toBe(true);
  expect(isVehicleStale(undefined, 1000)).toBe(true);
});

test('turns a script id into a readable vehicle name', () => {
  expect(vehicleDisplayName('Base.ModernCarLightsMeadeSheriff')).toBe('Modern Car Lights Meade Sheriff');
  expect(vehicleDisplayName(undefined)).toBeNull();
});

test('measures fuel burn per kilometre once the vehicle has moved far enough', () => {
  const start = updateFuelTrend(null, { fuelPercent: 90, x: 0, y: 0 });
  expect(updateFuelTrend(start, { fuelPercent: 89.9, x: 10, y: 0 }).perKm).toBeUndefined();

  const trend = updateFuelTrend(start, { fuelPercent: 89, x: SQUARES_PER_KM, y: 0 });
  expect(trend.perKm).toBeCloseTo(1, 6);
  expect(rangeKm(89, trend.perKm)).toBeCloseTo(89, 6);

  const refuelled = updateFuelTrend(trend, { fuelPercent: 100, x: 2 * SQUARES_PER_KM, y: 0 });
  expect(refuelled.perKm).toBeCloseTo(1, 6);
});

test('derives ETA from remaining route distance, but not while crawling', () => {
  expect(polylineLength([{ x: 0, y: 0 }, { x: 300, y: 400 }])).toBe(500);
  expect(etaSeconds(30, 60)).toBeCloseTo(1800, 6);
  expect(etaSeconds(30, 4)).toBeNull();
  expect(etaSeconds(null, 60)).toBeNull();
  expect(formatDuration(1800)).toBe('30:00');
  expect(formatDuration(3725)).toBe('1:02:05');
});

test('reports the worst tire and the climate state', () => {
  const vehicle = {
    id: 1,
    name: 'x',
    x: 0,
    y: 0,
    z: 0,
    current: true,
    tires: {
      FrontLeft: { condition: 90, pressure: 100 },
      RearRight: { condition: 40, pressure: 55 },
    },
    heaterActive: true,
    heaterSetting: -8,
  };
  expect(worstTire(vehicle)).toEqual({ condition: 40, pressure: 55 });
  expect(climateLabel(vehicle)).toBe('AC');
  expect(climateLabel({ ...vehicle, heaterSetting: 8 })).toBe('HEAT');
  expect(climateLabel({ ...vehicle, heaterActive: false })).toBe('OFF');
  expect(climateLabel({ ...vehicle, heaterActive: undefined })).toBeNull();
});
