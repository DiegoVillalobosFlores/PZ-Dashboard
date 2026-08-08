import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HudShell } from './components/HudShell';
import { HomeScreen } from './screens/HomeScreen';
import { HealthScreen } from './screens/HealthScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { SkillsScreen } from './screens/SkillsScreen';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* HudShell is a layout route, so it (and its live map/vitals/hotbar)
            stays mounted while only the screen inside its <Outlet /> changes. */}
        <Route element={<HudShell />}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/health" element={<HealthScreen />} />
          <Route path="/inventory" element={<InventoryScreen />} />
          <Route path="/skills" element={<SkillsScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
