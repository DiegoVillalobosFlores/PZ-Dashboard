import { expect, test } from 'bun:test';
import {
  DEFAULT_AUTO_ROTATE,
  DEFAULT_AUTO_ZOOM_ON_SPEED,
  DEFAULT_CLUSTER_SETTINGS,
  DEFAULT_FOG_OF_WAR,
  DEFAULT_SHOW_SUMMARY,
  DEFAULT_SHOW_TRAITS,
  settingMatchesFilter,
} from './settings';

test('keeps documented setting defaults', () => {
  expect({
    fogOfWar: DEFAULT_FOG_OF_WAR,
    showTraits: DEFAULT_SHOW_TRAITS,
    showSummary: DEFAULT_SHOW_SUMMARY,
    autoZoomOnSpeed: DEFAULT_AUTO_ZOOM_ON_SPEED,
    autoRotate: DEFAULT_AUTO_ROTATE,
    cluster: DEFAULT_CLUSTER_SETTINGS,
  }).toEqual({
    fogOfWar: true,
    showTraits: true,
    showSummary: true,
    autoZoomOnSpeed: false,
    autoRotate: true,
    cluster: {
      showCluster: true,
      health: true,
      hunger: true,
      thirst: true,
      fatigue: true,
      stamina: true,
      stress: true,
      panic: true,
      pain: true,
      boredom: true,
      infected: true,
      bleeding: true,
    },
  });
});

test('matches setting title and hint text', () => {
  expect(settingMatchesFilter('Fog of war', 'Hide unexplored map areas', 'fog')).toBe(true);
  expect(settingMatchesFilter('Fog of war', 'Hide unexplored map areas', 'map areas')).toBe(true);
});

test('matches filters case-insensitively', () => {
  expect(settingMatchesFilter('Character rotation', 'Spin the character', 'CHARACTER')).toBe(true);
});

test('matches empty and whitespace filters', () => {
  expect(settingMatchesFilter('Any setting', 'Any hint', '')).toBe(true);
  expect(settingMatchesFilter('Any setting', 'Any hint', '   ')).toBe(true);
});

test('rejects filters absent from title and hint', () => {
  expect(settingMatchesFilter('Fog of war', 'Hide unexplored map areas', 'inventory')).toBe(false);
});
