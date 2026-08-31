import { GlassPanel } from './GlassPanel';
import { useGameSubscription } from '../lib/gameSocket';
import { useDrivingHud, useDrivingHudCollapsed } from '../lib/settings';
import { useNavTarget } from '../lib/navTarget';
import type { VehicleSnapshot, VehiclesSnapshot } from '../lib/liveTypes';
import { useEffect, useRef, useState } from 'react';

export const DRIVING_HUD_EXPECTED_INTERVAL_MS = 500;
export const DRIVING_HUD_STALE_AFTER_MS = DRIVING_HUD_EXPECTED_INTERVAL_MS * 4;
export const LOW_FUEL_THRESHOLD = 15;
export const LOW_PRESSURE_THRESHOLD = 60;
export const WORN_PART_THRESHOLD = 70;
export const SQUARES_PER_KM = 1000;
const FUEL_SAMPLE_MIN_KM = 0.05;
const ETA_MIN_SPEED_KMH = 5;

export interface FuelTrend {
  fuelPercent: number;
  x: number;
  y: number;
  perKm?: number;
}

export function getCurrentVehicle(snapshot: VehiclesSnapshot): VehicleSnapshot | null {
  return snapshot.vehicles.find((vehicle) => vehicle.current) ?? null;
}

export function isLowFuel(fuelPercent: number | undefined): boolean {
  return fuelPercent !== undefined && Number.isFinite(fuelPercent) && fuelPercent < LOW_FUEL_THRESHOLD;
}

export function isVehicleStale(receivedAt: number | undefined, now = Date.now()): boolean {
  return receivedAt === undefined || now - receivedAt > DRIVING_HUD_STALE_AFTER_MS;
}

export function vehicleDisplayName(name: string | undefined): string | null {
  if (!name) return null;
  const bare = name.replace(/^[A-Za-z0-9]+\./, '');
  const words = bare.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  return words || null;
}

export function updateFuelTrend(previous: FuelTrend | null, sample: FuelTrend): FuelTrend {
  if (!previous) return sample;
  const km = Math.hypot(sample.x - previous.x, sample.y - previous.y) / SQUARES_PER_KM;
  if (km < FUEL_SAMPLE_MIN_KM) return previous;
  const burned = previous.fuelPercent - sample.fuelPercent;
  if (burned <= 0) return { ...sample, perKm: previous.perKm };
  const measured = burned / km;
  return { ...sample, perKm: previous.perKm === undefined ? measured : previous.perKm * 0.7 + measured * 0.3 };
}

export function rangeKm(fuelPercent: number | undefined, perKm: number | undefined): number | null {
  if (fuelPercent === undefined || perKm === undefined || perKm <= 0) return null;
  return fuelPercent / perKm;
}

export function etaSeconds(remainingKm: number | null, speedKmh: number | undefined): number | null {
  if (remainingKm === null || speedKmh === undefined || speedKmh < ETA_MIN_SPEED_KMH) return null;
  return (remainingKm / speedKmh) * 3600;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function worstTire(vehicle: VehicleSnapshot | null): { condition?: number; pressure?: number } {
  const tires = vehicle?.tires;
  if (!tires) return {};
  const values = Object.values(tires);
  const conditions = values.map((tire) => tire?.condition).filter((value): value is number => Number.isFinite(value));
  const pressures = values.map((tire) => tire?.pressure).filter((value): value is number => Number.isFinite(value));
  return {
    condition: conditions.length ? Math.min(...conditions) : undefined,
    pressure: pressures.length ? Math.min(...pressures) : undefined,
  };
}

export function climateLabel(vehicle: VehicleSnapshot | null): string | null {
  if (!vehicle || vehicle.heaterActive === undefined) return null;
  if (!vehicle.heaterActive) return 'OFF';
  const setting = vehicle.heaterSetting;
  if (setting === undefined || setting === 0) return 'ON';
  return setting > 0 ? 'HEAT' : 'AC';
}

function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function partColor(value: number | undefined, threshold = WORN_PART_THRESHOLD): string {
  if (!isFiniteNumber(value)) return 'var(--color-text-tertiary)';
  if (value < threshold / 2) return 'var(--color-danger)';
  if (value < threshold) return 'var(--color-warning)';
  return 'var(--color-text-primary)';
}

function Readout({
  label,
  value,
  unit,
  color,
  size = 15,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  size?: number;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="pz-label" style={{ marginBottom: 3, color: 'var(--color-text-secondary)', fontSize: 11 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span
          style={{
            overflow: 'hidden',
            color: color ?? 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: size,
            fontWeight: 700,
            lineHeight: 1,
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

export function useInVehicle(): boolean {
  const [enabled] = useDrivingHud();
  const inVehicle =
    useGameSubscription('driving:inVehicle', (msg) => (msg.category === 'map' ? msg.data.inVehicle : undefined)) ?? false;
  return enabled && inVehicle;
}

export function DrivingHud({ compact = false }: { compact?: boolean }) {
  const active = useInVehicle();
  const [collapsed, setCollapsed] = useDrivingHudCollapsed();
  const navTarget = useNavTarget();
  const vehicleState = useGameSubscription('driving:vehicle', (msg) =>
    msg.category === 'vehicles' ? { vehicle: getCurrentVehicle(msg.data), receivedAt: Date.now() } : undefined,
  );
  const [now, setNow] = useState(() => Date.now());
  const fuelTrend = useRef<FuelTrend | null>(null);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const vehicle = vehicleState?.vehicle ?? null;
  useEffect(() => {
    if (!active) {
      fuelTrend.current = null;
      return;
    }
    if (!vehicle || !isFiniteNumber(vehicle.fuelPercent)) return;
    fuelTrend.current = updateFuelTrend(fuelTrend.current, {
      fuelPercent: vehicle.fuelPercent,
      x: vehicle.x,
      y: vehicle.y,
      perKm: fuelTrend.current?.perKm,
    });
  }, [active, vehicle]);

  if (!active) return null;

  const stale = isVehicleStale(vehicleState?.receivedAt, now);
  const stopped = vehicle?.engineRunning === false;
  const speed = stale || stopped ? undefined : vehicle?.speedKmh;
  const speedValue = isFiniteNumber(speed) ? String(Math.round(speed)) : '--';
  const fuelPercent = vehicle?.fuelPercent;
  const lowFuel = isLowFuel(fuelPercent);
  const fuelValue = isFiniteNumber(fuelPercent) ? String(Math.round(fuelPercent)) : '--';
  const fuelWidth = isFiniteNumber(fuelPercent) ? Math.max(0, Math.min(100, fuelPercent)) : 0;
  const perKm = fuelTrend.current?.perKm;
  const remainingRange = rangeKm(fuelPercent, perKm);
  const remainingKm = navTarget ? navTarget.remainingSquares / SQUARES_PER_KM : null;
  const eta = etaSeconds(remainingKm, speed);
  const tire = worstTire(vehicle);
  const climate = climateLabel(vehicle);
  const cabinTemp = vehicle?.cabinTemp;
  const brakes = vehicle?.parts?.brakes;
  const engine = vehicle?.parts?.engine ?? vehicle?.engineCondition;
  const hood = vehicle?.parts?.hood;
  const suspension = vehicle?.parts?.suspension;
  const name = vehicleDisplayName(vehicle?.name);

  return (
    <div
      role="region"
      aria-label="Driving HUD"
      style={{ width: '100%', padding: compact ? '0 12px' : '0 24px', pointerEvents: 'auto' }}
    >
      <GlassPanel
        style={{ padding: compact ? '8px 12px' : '10px 16px' }}
        cornerBrackets={{ length: 12, thickness: 2, inset: 4, opacity: 0.9 }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: compact ? 14 : 24,
          }}
        >
          <div style={{ minWidth: compact ? 96 : 132 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <strong
              style={{
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: compact ? 34 : 44,
                lineHeight: 1,
              }}
            >
              {speedValue}
            </strong>
            <span className="pz-label" style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>
              KM/H
            </span>
          </div>
            {name && (
              <div
                className="pz-label"
                style={{
                  overflow: 'hidden',
                  marginTop: 4,
                  color: 'var(--color-text-tertiary)',
                  fontSize: 10,
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </div>
            )}
          </div>

          <div style={{ minWidth: 118 }}>
            <Readout
              label="FUEL"
              value={fuelValue}
              unit={remainingRange !== null ? `% · ${Math.round(remainingRange)} KM LEFT` : '%'}
              color={lowFuel ? 'var(--color-danger)' : undefined}
            />
            <div
              role="meter"
              aria-label="Fuel level"
              aria-valuemin={0}
              aria-valuemax={100}
              {...(isFiniteNumber(fuelPercent) ? { 'aria-valuenow': fuelPercent, 'aria-valuetext': `${Math.round(fuelPercent)} percent` } : {})}
              style={{ height: 4, marginTop: 6, overflow: 'hidden', background: 'var(--color-glass-inset)' }}
            >
              {isFiniteNumber(fuelPercent) && (
                <div
                  style={{
                    width: `${fuelWidth}%`,
                    height: '100%',
                    background: lowFuel ? 'var(--color-danger)' : 'var(--color-accent)',
                  }}
                />
              )}
            </div>
          </div>

          {navTarget && (
            <Readout
              label={navTarget.isDirect ? 'ETA (DIRECT)' : 'ETA'}
              value={eta === null ? '--' : formatDuration(eta)}
              unit={remainingKm === null ? undefined : `${remainingKm.toFixed(1)} KM`}
              color="var(--color-accent)"
            />
          )}

          {!collapsed && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: compact ? 14 : 24, marginLeft: 'auto' }}>
              <Readout label="BRAKES" value={isFiniteNumber(brakes) ? String(Math.round(brakes)) : '--'} unit="%" color={partColor(brakes)} />
              <Readout
                label="TIRES"
                value={isFiniteNumber(tire.condition) ? String(Math.round(tire.condition)) : '--'}
                unit={isFiniteNumber(tire.pressure) ? `% · ${Math.round(tire.pressure)}% PSI` : '%'}
                color={
                  isFiniteNumber(tire.pressure) && tire.pressure < LOW_PRESSURE_THRESHOLD
                    ? 'var(--color-danger)'
                    : partColor(tire.condition)
                }
              />
              <Readout label="ENGINE" value={isFiniteNumber(engine) ? String(Math.round(engine)) : '--'} unit="%" color={partColor(engine)} />
              <Readout label="HOOD" value={isFiniteNumber(hood) ? String(Math.round(hood)) : '--'} unit="%" color={partColor(hood)} />
              {isFiniteNumber(suspension) && suspension < WORN_PART_THRESHOLD && (
                <Readout label="SUSPENSION" value={String(Math.round(suspension))} unit="%" color={partColor(suspension)} />
              )}
              <Readout
                label="CABIN"
                value={isFiniteNumber(cabinTemp) ? `${cabinTemp > 0 ? '+' : ''}${Math.round(cabinTemp)}°` : '--'}
                unit={climate ?? undefined}
                color={climate === 'HEAT' ? 'var(--color-warning)' : climate === 'AC' ? 'var(--color-accent)' : undefined}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Show full driving readouts' : 'Show speed and fuel only'}
            aria-expanded={!collapsed}
            className="pz-label"
            style={{
              minWidth: 44,
              minHeight: 44,
              marginLeft: 'auto',
              padding: '0 10px',
              border: '1px solid var(--color-accent-border-medium)',
              borderRadius: 'var(--radius-sharp)',
              background: 'transparent',
              color: 'var(--color-accent)',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            {collapsed ? 'MORE' : 'LESS'}
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
