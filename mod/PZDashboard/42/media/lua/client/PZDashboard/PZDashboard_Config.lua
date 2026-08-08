require "PZDashboard/PZDashboard_Categories"
require "PZDashboard/PZDashboard_Options"

PZDashboard = PZDashboard or {}
PZDashboard.Config = {}

function PZDashboard.Config.isEnabled(category)
    local option = PZDashboard.Options.enabled[category.id]
    if not option then return true end
    return option:getValue()
end

function PZDashboard.Config.getIntervalSeconds(category)
    local option = PZDashboard.Options.interval[category.id]
    local value = option and option:getValue()
    if value == nil or value <= 0 then
        return category.defaultInterval
    end
    return value
end

return PZDashboard.Config
