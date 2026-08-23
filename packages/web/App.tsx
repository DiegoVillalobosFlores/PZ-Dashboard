import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { HudShell } from './components/HudShell';
import { HomeScreen } from './screens/HomeScreen';
import { HealthScreen } from './screens/HealthScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { SkillsScreen } from './screens/SkillsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

// Opened from disk, location.pathname is the file's path on the filesystem,
// so no route ever matches and the dashboard renders empty. The hash router
// keeps its own path after the "#", which is the only thing a file:// URL
// lets us vary. Served over HTTP nothing changes: apps/server has an SPA
// fallback, so real paths stay real paths there.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

export function App() {
  return (
    <Router>
      <Routes>
        {/* HudShell is a layout route, so it (and its live map/vitals/hotbar)
            stays mounted while only the screen inside its <Outlet /> changes. */}
        <Route element={<HudShell />}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/health" element={<HealthScreen />} />
          <Route path="/inventory" element={<InventoryScreen />} />
          <Route path="/skills" element={<SkillsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
      </Routes>
    </Router>
  );
}
