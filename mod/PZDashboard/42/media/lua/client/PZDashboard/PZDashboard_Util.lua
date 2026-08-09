PZDashboard = PZDashboard or {}
PZDashboard.Util = {}

local reported = {}

function PZDashboard.Util.safe(fn, default, label)
    local ok, result = pcall(fn)
    if not ok or result == nil then
        if label and not reported[label] then
            reported[label] = true
            print("PZDashboard: " .. tostring(label) .. " failed: " .. tostring(result))
        end
        return default
    end
    return result
end

local safe = PZDashboard.Util.safe

function PZDashboard.Util.itemCategory(item)
    local key = safe(function() return item:getDisplayCategory() end, "", "item.displayCategory")
    if key == nil or key == "" then
        key = safe(function() return item:getCategory() end, "", "item.category")
    end
    if key == nil or key == "" then return "", "" end
    local label = safe(function() return getTextOrNull("IGUI_ItemCat_" .. key) end, nil, "item.categoryLabel")
    return key, label or key
end

return PZDashboard.Util
