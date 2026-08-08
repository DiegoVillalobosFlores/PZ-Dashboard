PZDashboard = PZDashboard or {}

-- Registry of streamable data categories. Adding a new category means adding
-- an entry here, and a matching collector function in
-- PZDashboard_Collectors.lua with the same id - PZDashboard_Options.lua
-- derives its Options > Mods entries from this list directly.
PZDashboard.Categories = {
    { id = "status",    optionName = "StatusEnabled",    intervalOption = "StatusInterval",    defaultInterval = 1.0, maxInterval = 30, label = "Status" },
    -- Fastest category on purpose: this one drives a marker that's meant to
    -- track the player continuously, so it runs at the slider's floor (0.5s)
    -- rather than the 1s used for stats that only drift slowly.
    { id = "map",       optionName = "MapEnabled",       intervalOption = "MapInterval",       defaultInterval = 0.5, maxInterval = 30, label = "Map Position" },
    { id = "annotations", optionName = "AnnotationsEnabled", intervalOption = "AnnotationsInterval", defaultInterval = 5.0, maxInterval = 60, label = "Map Annotations" },
    { id = "inventory", optionName = "InventoryEnabled", intervalOption = "InventoryInterval", defaultInterval = 3.0, maxInterval = 60, label = "Inventory" },
    { id = "nearbyContainers", optionName = "NearbyContainersEnabled", intervalOption = "NearbyContainersInterval", defaultInterval = 3.0, maxInterval = 60, label = "Nearby Containers" },
    { id = "skills",    optionName = "SkillsEnabled",    intervalOption = "SkillsInterval",    defaultInterval = 5.0, maxInterval = 60, label = "Skills" },
    { id = "toolbar",   optionName = "ToolbarEnabled",   intervalOption = "ToolbarInterval",    defaultInterval = 1.0, maxInterval = 30, label = "Toolbar" },
    -- Same 1s cadence as the toolbar: both back the same equipment tiles in
    -- the HUD, and a swap the player makes in-game should show up on the
    -- second screen at the same speed either way.
    { id = "equipment", optionName = "EquipmentEnabled", intervalOption = "EquipmentInterval",  defaultInterval = 1.0, maxInterval = 30, label = "Equipment" },
    -- Only reports which models and textures make up the character, which
    -- changes when they dress or cut their hair and never on its own, so it
    -- runs slowly on purpose - the dashboard rebuilds a 3D figure from it.
    { id = "appearance", optionName = "AppearanceEnabled", intervalOption = "AppearanceInterval", defaultInterval = 2.0, maxInterval = 60, label = "Character Model" },
}

return PZDashboard.Categories
