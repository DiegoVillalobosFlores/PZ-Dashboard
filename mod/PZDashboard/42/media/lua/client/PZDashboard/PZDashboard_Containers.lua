require "PZDashboard/PZDashboard_Util"

PZDashboard = PZDashboard or {}
PZDashboard.Containers = {}

local safe = PZDashboard.Util.safe
local itemCategory = PZDashboard.Util.itemCategory

local SCAN_RADIUS = 1

local function containerName(container, fallback)
    local kind = safe(function() return container:getType() end, "", "containers.type")
    if kind ~= "" then
        local label = safe(function() return getTextOrNull("IGUI_ContainerTitle_" .. kind) end, nil, "containers.title")
        if label then return label end
    end
    return fallback
end

local function itemIcon(item, label)
    local icon = safe(function()
        local texture = item:getTex()
        return texture and texture:getName() or ""
    end, "", label)
    return icon or ""
end

local function subInventory(item)
    if not instanceof(item, "InventoryContainer") then return nil end
    return safe(function() return item:getInventory() end, nil, "containers.bagInventory")
end

local function vehicleContainers(vehicle, px, py, pz)
    local records = {}
    local globalContainer = safe(function() return vehicle:getInventory() end, nil, "containers.vehicleGlobalContainer")
    if globalContainer then
        table.insert(records, {
            id = "vehicle:" .. tostring(safe(function() return vehicle:getId() end, 0, "containers.vehicleId")) .. ":global",
            kind = "vehicle",
            name = "Vehicle inventory",
            type = "vehicle",
            icon = "",
            x = px, y = py, z = pz,
            locked = false,
            container = globalContainer,
        })
    end
    local parts = safe(function() return vehicle:getPartCount() end, 0, "containers.vehiclePartCount")
    for i = 0, parts - 1 do
        local part = safe(function() return vehicle:getPartByIndex(i) end, nil, "containers.vehiclePart")
        local container = part and safe(function() return part:getItemContainer() end, nil, "containers.vehicleItemContainer")
        if container then
            local id = safe(function() return vehicle:getId() end, 0, "containers.vehicleId")
            local partId = safe(function() return part:getId() end, tostring(i), "containers.vehiclePartId")
            table.insert(records, {
                id = "vehicle:" .. tostring(id) .. ":" .. tostring(partId),
                kind = "vehicle",
                name = safe(function() return part:getInventoryItem() and part:getInventoryItem():getDisplayName() end, partId, "containers.vehicleName"),
                type = safe(function() return container:getType() end, "vehicle", "containers.vehicleType"),
                icon = safe(function()
                    local item = part:getInventoryItem()
                    return item and itemIcon(item, "containers.vehicleIcon") or ""
                end, "", "containers.vehicleIcon"),
                x = px, y = py, z = pz,
                locked = false,
                container = container,
            })
        end
    end
    return records
end

function PZDashboard.Containers.enumerate(player)
    local records = {}
    local px = math.floor(safe(function() return player:getX() end, 0, "containers.playerX"))
    local py = math.floor(safe(function() return player:getY() end, 0, "containers.playerY"))
    local pz = math.floor(safe(function() return player:getZ() end, 0, "containers.playerZ"))

    local inventory = player:getInventory()
    table.insert(records, {
        id = "player",
        kind = "player",
        name = safe(function() return getText("IGUI_InventoryTooltip") end, "Inventory", "containers.playerName"),
        type = "player",
        icon = "",
        x = px, y = py, z = pz,
        locked = false,
        container = inventory,
    })

    local carried = inventory:getItems()
    for i = 0, carried:size() - 1 do
        local item = carried:get(i)
        local bag = subInventory(item)
        if bag then
            table.insert(records, {
                id = "bag:" .. tostring(item:getID()),
                kind = "bag",
                name = safe(function() return item:getDisplayName() end, "Bag", "containers.bagName"),
                type = safe(function() return item:getFullType() end, "", "containers.bagType"),
                icon = itemIcon(item, "containers.bagIcon"),
                x = px, y = py, z = pz,
                locked = false,
                container = bag,
            })
        end
    end

    local vehicle = safe(function() return player:getVehicle() end, nil, "containers.vehicle")
    if vehicle then
        for _, record in ipairs(vehicleContainers(vehicle, px, py, pz)) do
            table.insert(records, record)
        end
    end

    local cell = getCell()
    local floorItems = {}
    local worldObjects = {}

    for dx = -SCAN_RADIUS, SCAN_RADIUS do
        for dy = -SCAN_RADIUS, SCAN_RADIUS do
            local square = cell and cell:getGridSquare(px + dx, py + dy, pz) or nil
            if square then
                local sx, sy, sz = px + dx, py + dy, pz

                local objects = square:getObjects()
                for i = 0, objects:size() - 1 do
                    local object = objects:get(i)
                    local container = safe(function() return object:getContainer() end, nil, "containers.objectContainer")
                    if container then
                        table.insert(records, {
                            id = string.format("obj:%d:%d:%d:%d", sx, sy, sz, i),
                            kind = "object",
                            name = containerName(container, safe(function() return object:getName() end, "Container", "containers.objectName")),
                            type = safe(function() return container:getType() end, "", "containers.objectType"),
                            icon = "",
                            x = sx, y = sy, z = sz,
                            locked = instanceof(object, "IsoThumpable") and safe(function() return object:isLocked() end, false, "containers.objectLocked") == true,
                            container = container,
                        })
                    end
                end

                local bodies = safe(function() return square:getDeadBodys() end, nil, "containers.bodies")
                if bodies then
                    for i = 0, bodies:size() - 1 do
                        local body = bodies:get(i)
                        local container = safe(function() return body:getContainer() end, nil, "containers.bodyContainer")
                        if container then
                            table.insert(records, {
                                id = string.format("body:%d:%d:%d:%d", sx, sy, sz, i),
                                kind = "deadBody",
                                name = safe(function() return getText("ContextMenu_Corpse") end, "Corpse", "containers.bodyName"),
                                type = "deadBody",
                                icon = "",
                                x = sx, y = sy, z = sz,
                                locked = false,
                                container = container,
                            })
                        end
                    end
                end

                local world = safe(function() return square:getWorldObjects() end, nil, "containers.worldObjects")
                if world then
                    for i = 0, world:size() - 1 do
                        local worldObject = world:get(i)
                        local item = safe(function() return worldObject:getItem() end, nil, "containers.worldItem")
                        if item then
                            local bag = subInventory(item)
                            if bag then
                                table.insert(records, {
                                    id = "floorBag:" .. tostring(item:getID()),
                                    kind = "floorBag",
                                    name = safe(function() return item:getDisplayName() end, "Bag", "containers.floorBagName"),
                                    type = safe(function() return item:getFullType() end, "", "containers.floorBagType"),
                                    icon = itemIcon(item, "containers.floorBagIcon"),
                                    x = sx, y = sy, z = sz,
                                    locked = false,
                                    container = bag,
                                })
                            else
                                table.insert(floorItems, { item = item })
                                worldObjects[item:getID()] = worldObject
                            end
                        end
                    end
                end
            end
        end
    end

    table.insert(records, {
        id = "floor",
        kind = "floor",
        name = safe(function() return getText("IGUI_InventoryFloor") end, "Floor", "containers.floorName"),
        type = "floor",
        icon = "",
        x = px, y = py, z = pz,
        locked = false,
        container = nil,
        floorItems = floorItems,
        worldObjects = worldObjects,
    })

    return records
end

function PZDashboard.Containers.itemsOf(entry, label)
    local list = {}
    if entry.floorItems then
        for _, floorEntry in ipairs(entry.floorItems) do
            table.insert(list, floorEntry.item)
        end
    elseif entry.container then
        local items = entry.container:getItems()
        for i = 0, items:size() - 1 do
            table.insert(list, items:get(i))
        end
    end

    local snapshots = {}
    local player = getSpecificPlayer(0)
    for _, item in ipairs(list) do
        local displayCategory, categoryLabel = itemCategory(item)
        table.insert(snapshots, {
            id = safe(function() return item:getID() end, -1, label .. ".id"),
            name = safe(function() return item:getDisplayName() end, "", label .. ".name"),
            type = safe(function() return item:getFullType() end, "", label .. ".type"),
            count = 1,
            condition = safe(function() return item:getCondition() end, -1, label .. ".condition"),
            conditionMax = safe(function() return item:getConditionMax() end, -1, label .. ".conditionMax"),
            weight = safe(function() return item:getActualWeight() end, 0, label .. ".weight"),
            icon = itemIcon(item, label .. ".icon"),
            category = safe(function() return item:getCategory() end, "", label .. ".category"),
            displayCategory = displayCategory,
            categoryLabel = categoryLabel,
            equipped = safe(function() return item:isEquipped() end, false, label .. ".equipped")
                or (player ~= nil and safe(function() return player:isEquipped(item) end, false, label .. ".handEquipped"))
                or (player ~= nil and safe(function() return player:isAttachedItem(item) end, false, label .. ".attached"))
                or false,
            bodyLocation = safe(function()
                if not instanceof(item, "Clothing") then return "" end
                return item:getBodyLocation()
            end, "", label .. ".bodyLocation"),
        })
    end
    return snapshots
end

return PZDashboard.Containers
