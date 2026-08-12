PZDashboard = PZDashboard or {}

PZDashboard.Categories = {
    { id = "status",    optionName = "StatusEnabled",    intervalOption = "StatusInterval",    defaultInterval = 1.0, maxInterval = 30, label = "Status" },
    { id = "map",       optionName = "MapEnabled",       intervalOption = "MapInterval",       defaultInterval = 0.25, maxInterval = 30, label = "Map Position" },
    { id = "vehicles", optionName = "VehiclesEnabled", intervalOption = "VehiclesInterval", defaultInterval = 2.0, maxInterval = 60, label = "Tracked Vehicles" },
    { id = "fog",       optionName = "FogEnabled",       intervalOption = "FogInterval",       defaultInterval = 2.0, maxInterval = 60, label = "Explored Map" },
    { id = "annotations", optionName = "AnnotationsEnabled", intervalOption = "AnnotationsInterval", defaultInterval = 5.0, maxInterval = 60, label = "Map Annotations" },
    { id = "containers", optionName = "ContainersEnabled", intervalOption = "ContainersInterval", defaultInterval = 2.0, maxInterval = 60, label = "Containers" },
    { id = "skills",    optionName = "SkillsEnabled",    intervalOption = "SkillsInterval",    defaultInterval = 5.0, maxInterval = 60, label = "Skills" },
    { id = "toolbar",   optionName = "ToolbarEnabled",   intervalOption = "ToolbarInterval",    defaultInterval = 1.0, maxInterval = 30, label = "Toolbar" },
    { id = "equipment", optionName = "EquipmentEnabled", intervalOption = "EquipmentInterval",  defaultInterval = 1.0, maxInterval = 30, label = "Equipment" },
    { id = "appearance", optionName = "AppearanceEnabled", intervalOption = "AppearanceInterval", defaultInterval = 2.0, maxInterval = 60, label = "Character Model" },
}

return PZDashboard.Categories
