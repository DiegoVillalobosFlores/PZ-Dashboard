require "PZDashboard/PZDashboard_Categories"

PZDashboard = PZDashboard or {}
PZDashboard.Options = { enabled = {}, interval = {} }

-- Registered from Options > Mods > PZ Dashboard rather than Sandbox Options,
-- so streaming can be toggled live mid-session instead of only at world
-- creation. Values persist globally in Zomboid/Lua/ModOptions.ini; the
-- engine handles loading/saving them, we just read getValue() at tick time.
local page = PZAPI.ModOptions:create("PZDashboard", "PZ Dashboard")

for _, category in ipairs(PZDashboard.Categories) do
    PZDashboard.Options.enabled[category.id] = page:addTickBox(
        category.optionName,
        "Stream " .. category.label,
        true,
        "Send " .. category.label .. " data to the dashboard server"
    )
    PZDashboard.Options.interval[category.id] = page:addSlider(
        category.intervalOption,
        category.label .. " interval (seconds)",
        0.5,
        category.maxInterval,
        0.5,
        category.defaultInterval,
        "How often " .. category.label .. " is sent - higher is lighter on performance"
    )
end

return PZDashboard.Options
